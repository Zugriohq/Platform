using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace Zugrio.CBot.Core
{
    public enum SubmissionState { Reserved, Submitted, Acknowledged, Rejected, SubmissionUnknown }
    public enum ProtectionState { None, ProtectionPending, Protected, ProtectionFailed }

    /// <summary>One journal line. Append-only; the boundary is rebuilt from these on restart (SB-6).</summary>
    public sealed record BoundaryEvent(string Kind, string AccountId, string FireEventId, string ClientOrderId, string Instrument, long Volume, DateTimeOffset At);

    public interface IBoundaryJournal
    {
        /// <summary>Must be durable before it returns (SB-1: RESERVED is journalled before submission).</summary>
        void Append(BoundaryEvent e);
        IReadOnlyList<BoundaryEvent> ReadAll();
    }

    public sealed class InMemoryJournal : IBoundaryJournal
    {
        private readonly List<BoundaryEvent> _events = new();
        public void Append(BoundaryEvent e) => _events.Add(e);
        public IReadOnlyList<BoundaryEvent> ReadAll() => _events.ToList();
    }

    /// <summary>JSON-lines journal flushed to disk on every append.</summary>
    public sealed class FileJournal : IBoundaryJournal
    {
        private readonly string _path;
        public FileJournal(string path) { _path = path; }
        public void Append(BoundaryEvent e)
        {
            using var fs = new FileStream(_path, FileMode.Append, FileAccess.Write, FileShare.Read);
            var line = System.Text.Encoding.UTF8.GetBytes(JsonSerializer.Serialize(e) + "\n");
            fs.Write(line, 0, line.Length);
            fs.Flush(flushToDisk: true);
        }
        public IReadOnlyList<BoundaryEvent> ReadAll() =>
            File.Exists(_path) ? File.ReadAllLines(_path).Where(l => l.Length > 0).Select(l => JsonSerializer.Deserialize<BoundaryEvent>(l) ?? throw new InvalidDataException("corrupt journal line")).ToList() : new List<BoundaryEvent>();
    }

    public sealed class EntryRecord
    {
        public string AccountId { get; init; } = "";
        public string FireEventId { get; init; } = "";
        public string ClientOrderId { get; init; } = "";
        public string Instrument { get; init; } = "";
        public SubmissionState Submission { get; set; }
        public ProtectionState Protection { get; set; } = ProtectionState.None;
        public long FilledVolume { get; set; }
        public DateTimeOffset? ProtectionDeadline { get; set; }
    }

    /// <summary>
    /// The cBot's half of the frozen Broker Execution Boundary (§10.10) for entries.
    /// Every transition is journalled. Illegal transitions throw, so the bot fails
    /// closed. <c>maxProtectionPendingInterval</c> comes from the signed Broker
    /// Execution Policy; this class has no default (it is [UNSET] until Gate 5A/7).
    /// </summary>
    public sealed class EntryBoundary
    {
        private readonly IBoundaryJournal _journal;
        private readonly TimeSpan _maxProtectionPending;
        private readonly Dictionary<(string, string), EntryRecord> _byFire = new();
        private readonly HashSet<(string, string)> _lockedAccountInstrument = new();

        public EntryBoundary(IBoundaryJournal journal, TimeSpan maxProtectionPendingInterval)
        {
            if (maxProtectionPendingInterval <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(maxProtectionPendingInterval));
            _journal = journal;
            _maxProtectionPending = maxProtectionPendingInterval;
            foreach (var e in journal.ReadAll()) Apply(e, replay: true);
        }

        public EntryRecord? Get(string accountId, string fireEventId) => _byFire.TryGetValue((accountId, fireEventId), out var r) ? r : null;

        /// <summary>SB-10: a PROTECTION_FAILED locks further risk-increasing entries for that account and instrument.</summary>
        public bool IsLocked(string accountId, string instrument) => _lockedAccountInstrument.Contains((accountId, instrument));

        /// <summary>SB-1, SB-5, SB-7: reserve once per (fireEventId, accountId), ever.</summary>
        public EntryRecord Reserve(string accountId, string fireEventId, string clientOrderId, string instrument, DateTimeOffset now)
        {
            if (_byFire.ContainsKey((accountId, fireEventId))) throw new BoundaryException("this FIRE event already has an entry on this account (SB-5/SB-7)");
            if (IsLocked(accountId, instrument)) throw new BoundaryException("risk-increasing entries are locked after PROTECTION_FAILED (SB-10)");
            if (_byFire.Values.Any(r => r.ClientOrderId == clientOrderId)) throw new BoundaryException("clientOrderId already used");
            Record("RESERVED", accountId, fireEventId, clientOrderId, instrument, 0, now);
            return _byFire[(accountId, fireEventId)];
        }

        /// <summary>The broker call may happen only while this returns true. Never true after SUBMISSION_UNKNOWN (SB-3).</summary>
        public bool MaySubmit(string accountId, string fireEventId) => Get(accountId, fireEventId)?.Submission == SubmissionState.Reserved;

        public void MarkSubmitted(string a, string f, DateTimeOffset now) => Step(a, f, SubmissionState.Reserved, "SUBMITTED", now);
        public void OnAcknowledged(string a, string f, DateTimeOffset now) => Step(a, f, SubmissionState.Submitted, "ACKNOWLEDGED", now);
        /// <summary>SB-7: terminal for that FIRE event.</summary>
        public void OnRejected(string a, string f, DateTimeOffset now) => Step(a, f, SubmissionState.Submitted, "REJECTED", now);
        /// <summary>SB-2/SB-3: an ambiguous result is a hard lock until reconciliation.</summary>
        public void OnSubmissionUnknown(string a, string f, DateTimeOffset now) => Step(a, f, SubmissionState.Submitted, "SUBMISSION_UNKNOWN", now);

        /// <summary>SB-4: resolve an unknown state only from broker truth looked up by clientOrderId.</summary>
        public void ResolveUnknown(string a, string f, bool brokerHasOrderOrPosition, long filledVolume, DateTimeOffset now)
        {
            var r = Require(a, f);
            if (r.Submission != SubmissionState.SubmissionUnknown) throw new BoundaryException("not in SUBMISSION_UNKNOWN");
            if (!brokerHasOrderOrPosition) { Record("RESOLVED_ABSENT", a, f, r.ClientOrderId, r.Instrument, 0, now); return; }
            Record("RESOLVED_PRESENT", a, f, r.ClientOrderId, r.Instrument, 0, now);
            if (filledVolume > 0) OnFilled(a, f, filledVolume, now);
        }

        /// <summary>SB-9: any non-zero fill without confirmed protection starts the protection deadline.</summary>
        public void OnFilled(string a, string f, long volume, DateTimeOffset now)
        {
            var r = Require(a, f);
            if (r.Submission != SubmissionState.Acknowledged) throw new BoundaryException("fill before acknowledgement");
            if (volume <= 0) throw new BoundaryException("fill volume must be positive");
            Record("FILLED", a, f, r.ClientOrderId, r.Instrument, volume, now);
        }

        /// <summary>SB-11: only a broker-confirmed stop counts as protection.</summary>
        public void OnProtectionConfirmed(string a, string f, DateTimeOffset now)
        {
            var r = Require(a, f);
            if (r.Protection != ProtectionState.ProtectionPending) throw new BoundaryException("no protection pending");
            Record("PROTECTED", a, f, r.ClientOrderId, r.Instrument, 0, now);
        }

        /// <summary>SB-9A: past the deadline, PROTECTION_PENDING becomes PROTECTION_FAILED. Returns records that just failed.</summary>
        public IReadOnlyList<EntryRecord> Tick(DateTimeOffset now)
        {
            var failed = _byFire.Values.Where(r => r.Protection == ProtectionState.ProtectionPending && r.ProtectionDeadline is { } d && now >= d).ToList();
            foreach (var r in failed) Record("PROTECTION_FAILED", r.AccountId, r.FireEventId, r.ClientOrderId, r.Instrument, 0, now);
            return failed;
        }

        private EntryRecord Require(string a, string f) => Get(a, f) ?? throw new BoundaryException("unknown entry");

        private void Step(string a, string f, SubmissionState from, string kind, DateTimeOffset now)
        {
            var r = Require(a, f);
            if (r.Submission != from) throw new BoundaryException("illegal transition " + r.Submission + " -> " + kind);
            Record(kind, a, f, r.ClientOrderId, r.Instrument, 0, now);
        }

        private void Record(string kind, string a, string f, string coid, string instrument, long volume, DateTimeOffset now)
        {
            var e = new BoundaryEvent(kind, a, f, coid, instrument, volume, now);
            _journal.Append(e);
            Apply(e, replay: false);
        }

        private void Apply(BoundaryEvent e, bool replay)
        {
            var key = (e.AccountId, e.FireEventId);
            switch (e.Kind)
            {
                case "RESERVED":
                    _byFire[key] = new EntryRecord { AccountId = e.AccountId, FireEventId = e.FireEventId, ClientOrderId = e.ClientOrderId, Instrument = e.Instrument, Submission = SubmissionState.Reserved };
                    break;
                case "SUBMITTED": _byFire[key].Submission = SubmissionState.Submitted; break;
                case "ACKNOWLEDGED": _byFire[key].Submission = SubmissionState.Acknowledged; break;
                case "REJECTED": _byFire[key].Submission = SubmissionState.Rejected; break;
                case "SUBMISSION_UNKNOWN": _byFire[key].Submission = SubmissionState.SubmissionUnknown; break;
                case "RESOLVED_ABSENT": _byFire[key].Submission = SubmissionState.Rejected; break;
                case "RESOLVED_PRESENT": _byFire[key].Submission = SubmissionState.Acknowledged; break;
                case "FILLED":
                    var r = _byFire[key];
                    r.FilledVolume += e.Volume;
                    if (r.Protection is ProtectionState.None)
                    {
                        r.Protection = ProtectionState.ProtectionPending;
                        r.ProtectionDeadline = e.At + _maxProtectionPending;
                    }
                    break;
                case "PROTECTED": _byFire[key].Protection = ProtectionState.Protected; _byFire[key].ProtectionDeadline = null; break;
                case "PROTECTION_FAILED":
                    _byFire[key].Protection = ProtectionState.ProtectionFailed;
                    _lockedAccountInstrument.Add((e.AccountId, e.Instrument));
                    break;
                default:
                    throw new InvalidDataException("unknown journal event " + e.Kind + (replay ? " during replay" : ""));
            }
        }
    }

    public sealed class BoundaryException : Exception
    {
        public BoundaryException(string message) : base(message) { }
    }
}

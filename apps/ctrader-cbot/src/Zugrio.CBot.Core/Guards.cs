using System;
using System.Collections.Generic;

namespace Zugrio.CBot.Core
{
    public enum RiskEffect { RiskIncreasing, RiskReducing }

    public sealed record PositionView(string PositionId, string Instrument, Side Side, long Volume, decimal? StopLoss, decimal? TakeProfit, string Label);

    public abstract record ManagementAction(string PositionId);
    public sealed record ClosePosition(string PositionId) : ManagementAction(PositionId);
    public sealed record PartialClose(string PositionId, long Volume) : ManagementAction(PositionId);
    public sealed record SetStopLoss(string PositionId, decimal? NewStop) : ManagementAction(PositionId);
    public sealed record SetTakeProfit(string PositionId, decimal? NewTarget) : ManagementAction(PositionId);
    public sealed record AddVolume(string PositionId, long Volume) : ManagementAction(PositionId);

    /// <summary>
    /// Frozen spec §10.11. Classification is computed from economic effect, never from a
    /// label or caller (OC-3). RISK_REDUCING must strictly and monotonically decrease
    /// maximum loss with no new exposure (OC-2). Anything that does not provably do so
    /// is RISK_INCREASING, fail closed (OC-4, RR-4).
    /// </summary>
    public static class OrderClassifier
    {
        public static RiskEffect Classify(PositionView p, ManagementAction a)
        {
            if (a.PositionId != p.PositionId) throw new ArgumentException("action does not refer to this position");
            switch (a)
            {
                case ClosePosition:
                    return RiskEffect.RiskReducing;
                case PartialClose pc:
                    return pc.Volume > 0 && pc.Volume < p.Volume ? RiskEffect.RiskReducing : RiskEffect.RiskIncreasing;
                case SetStopLoss s:
                    if (s.NewStop is null) return RiskEffect.RiskIncreasing;      // removing protection
                    if (p.StopLoss is null) return RiskEffect.RiskReducing;       // unbounded -> bounded loss
                    var tighter = p.Side == Side.Buy ? s.NewStop.Value > p.StopLoss.Value : s.NewStop.Value < p.StopLoss.Value;
                    return tighter ? RiskEffect.RiskReducing : RiskEffect.RiskIncreasing; // equal is not a strict decrease
                case SetTakeProfit:
                    // A target change does not decrease maximum loss, so it is not RISK_REDUCING.
                    return RiskEffect.RiskIncreasing;
                case AddVolume:
                    return RiskEffect.RiskIncreasing;
                default:
                    return RiskEffect.RiskIncreasing;
            }
        }
    }

    /// <summary>
    /// Local limits fixed in the cBot build or its signed configuration. A remote
    /// message can never loosen them (ADR-0008 §8). There are no numeric defaults:
    /// the values come from the signed Broker Execution and Risk/Sizing Policies.
    /// </summary>
    public sealed record LocalLimits(
        bool AllowLiveAccounts, long MaxVolumeUnits, TimeSpan MaxQuoteAge, TimeSpan MaxClockSkew,
        string PinnedBrokerExecutionPolicyHash, string PinnedExecutionAuthorityManifestHash, int ClientOrderIdLength);

    /// <summary>What the cBot observes about the account at the moment of the check (§10.8 BrokerSafetySnapshot).</summary>
    public sealed record BrokerSafetySnapshot(string AccountId, string BrokerVenueId, bool IsLiveAccount, bool Connected, decimal Bid, decimal Ask, DateTimeOffset QuoteAt, TimeSpan ClockSkew, DateTimeOffset CapturedAt);

    public sealed record GuardResult(bool Allowed, IReadOnlyList<string> AbortReasons)
    {
        public static readonly GuardResult Allow = new(true, Array.Empty<string>());
    }

    /// <summary>
    /// Pre-submission checks for a RISK_INCREASING entry. They may only abort (§10.8).
    /// The order: signature, identity, account, kill switch, pins, size, freshness, price.
    /// </summary>
    public sealed class EntryGuard
    {
        private readonly TrustRoot _trust;
        private readonly LocalLimits _limits;
        private readonly HashSet<string> _seenEnvelopes = new(StringComparer.Ordinal);
        public bool KillSwitch { get; set; }

        public EntryGuard(TrustRoot trust, LocalLimits limits) { _trust = trust; _limits = limits; }

        public GuardResult Check(ExecutionInstruction i, BrokerSafetySnapshot s, EntryBoundary boundary)
        {
            var reasons = new List<string>();
            try { _trust.Verify(i.Signed, s.CapturedAt); }
            catch (TrustException e) { return new GuardResult(false, new[] { "SIGNATURE: " + e.Message }); }

            if (s.CapturedAt > i.ExpiresAt) reasons.Add("EXPIRED");
            if (_seenEnvelopes.Contains(i.Envelope.SubmissionEnvelopeId)) reasons.Add("REPLAYED_ENVELOPE");
            if (i.Envelope.AccountId != s.AccountId || i.Envelope.BrokerVenueId != s.BrokerVenueId) reasons.Add("ACCOUNT_MISMATCH");
            if (s.IsLiveAccount && !_limits.AllowLiveAccounts) reasons.Add("LIVE_ACCOUNT_NOT_ALLOWED");
            if (KillSwitch) reasons.Add("KILL_SWITCH");
            if (i.Envelope.BrokerExecutionPolicyHash != _limits.PinnedBrokerExecutionPolicyHash) reasons.Add("BROKER_EXECUTION_POLICY_MISMATCH");
            if (i.ExecutionAuthorityManifestHash != _limits.PinnedExecutionAuthorityManifestHash) reasons.Add("EXECUTION_AUTHORITY_MANIFEST_MISMATCH");
            if (i.Entry.VolumeUnits > _limits.MaxVolumeUnits) reasons.Add("VOLUME_ABOVE_LOCAL_CAP");
            if (boundary.IsLocked(s.AccountId, i.Entry.Instrument)) reasons.Add("PROTECTION_FAILED_LOCK");
            if (boundary.Get(s.AccountId, i.Envelope.FireEventId) != null) reasons.Add("FIRE_EVENT_ALREADY_HAS_ENTRY");
            if (!s.Connected) reasons.Add("BROKER_DISCONNECTED");
            if (s.CapturedAt - s.QuoteAt > _limits.MaxQuoteAge || s.QuoteAt > s.CapturedAt) reasons.Add("QUOTE_STALE");
            if (s.ClockSkew.Duration() > _limits.MaxClockSkew) reasons.Add("CLOCK_SKEW");
            var price = i.Entry.Side == Side.Buy ? s.Ask : s.Bid;
            var adverse = i.Entry.Side == Side.Buy ? price > i.Envelope.AdverseExecutionPriceLimit : price < i.Envelope.AdverseExecutionPriceLimit;
            if (adverse) reasons.Add("ADVERSE_PRICE_LIMIT");

            if (reasons.Count > 0) return new GuardResult(false, reasons);
            _seenEnvelopes.Add(i.Envelope.SubmissionEnvelopeId);
            return GuardResult.Allow;
        }
    }

    /// <summary>
    /// Frozen spec §10.7. A genuinely RISK_REDUCING action needs only position identity,
    /// adapter integrity and broker reachability. The kill switch, admission failures and
    /// entitlement never block it (RR-3). Without integrity or reachability, the outcome
    /// is MANUAL_EXIT_REQUIRED (RR-6), never a silent drop.
    /// </summary>
    public static class RiskReducingGate
    {
        public const string OwnershipTagPrefix = "zugrio:";

        public static GuardResult Check(PositionView p, ManagementAction a, string expectedAccountId, string accountId, bool adapterIntegrityOk, bool brokerReachable)
        {
            if (OrderClassifier.Classify(p, a) != RiskEffect.RiskReducing) return new GuardResult(false, new[] { "NOT_RISK_REDUCING" });
            var reasons = new List<string>();
            if (accountId != expectedAccountId) reasons.Add("POSITION_IDENTITY_ACCOUNT");
            if (string.IsNullOrEmpty(p.PositionId)) reasons.Add("POSITION_IDENTITY_ID");
            if (!p.Label.StartsWith(OwnershipTagPrefix, StringComparison.Ordinal)) reasons.Add("POSITION_IDENTITY_OWNERSHIP_TAG");
            if (!adapterIntegrityOk || !brokerReachable) reasons.Add("MANUAL_EXIT_REQUIRED");
            return reasons.Count == 0 ? GuardResult.Allow : new GuardResult(false, reasons);
        }
    }
}

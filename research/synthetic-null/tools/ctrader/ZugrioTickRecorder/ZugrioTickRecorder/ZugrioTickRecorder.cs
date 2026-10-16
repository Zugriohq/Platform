using System;
using System.Globalization;
using System.IO;
using System.Text;
using cAlgo.API;
using cAlgo.API.Internals;

namespace cAlgo.Robots
{
    /// <summary>
    /// Exports historical bid/ask ticks in MT5 tick-export format for the #118 cTrader feed check.
    /// Places no orders. Runs with AccessRights.None: on .NET 6, cTrader resolves relative file
    /// paths to the sandbox folder Documents\cAlgo\Data\cBots\ZugrioTickRecorder\.
    /// </summary>
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.None)]
    public class ZugrioTickRecorder : Robot
    {
        [Parameter("Days back", DefaultValue = 7, MinValue = 1)]
        public int DaysBack { get; set; }

        protected override void OnStart()
        {
            var ticks = MarketData.GetTicks(SymbolName);
            var cutoff = Server.Time.AddDays(-DaysBack); // UTC: robot TimeZone is UTC

            while (ticks.Count == 0 || ticks[0].Time > cutoff)
            {
                if (ticks.LoadMoreHistory() == 0)
                    break; // server history limit reached
            }

            if (ticks.Count == 0)
            {
                Print("No ticks available for {0}.", SymbolName);
                Stop();
                return;
            }

            var fileName = string.Format(CultureInfo.InvariantCulture, "{0}_ctrader_{1}d.csv",
                SymbolName.Replace(" ", "_"), DaysBack);
            var priceFormat = "F" + Symbol.Digits.ToString(CultureInfo.InvariantCulture);

            var sb = new StringBuilder();
            sb.Append("<DATE>\t<TIME>\t<BID>\t<ASK>\t<LAST>\t<VOLUME>\t<FLAGS>\n");

            int written = 0;
            DateTime first = DateTime.MinValue, last = DateTime.MinValue;
            for (int i = 0; i < ticks.Count; i++)
            {
                var tick = ticks[i];
                if (tick.Time < cutoff)
                    continue;

                sb.Append(tick.Time.ToString("yyyy.MM.dd\tHH:mm:ss.fff", CultureInfo.InvariantCulture))
                  .Append('\t').Append(tick.Bid.ToString(priceFormat, CultureInfo.InvariantCulture))
                  .Append('\t').Append(tick.Ask.ToString(priceFormat, CultureInfo.InvariantCulture))
                  .Append("\t\t\t6\n");

                if (written == 0)
                    first = tick.Time;
                last = tick.Time;
                written++;
            }

            System.IO.File.WriteAllText(fileName, sb.ToString(), new UTF8Encoding(false));

            Print("Ticks written: {0}", written);
            Print("First tick: {0:yyyy.MM.dd HH:mm:ss.fff} UTC, last tick: {1:yyyy.MM.dd HH:mm:ss.fff} UTC", first, last);
            Print("File: Documents\\cAlgo\\Data\\cBots\\ZugrioTickRecorder\\{0}", fileName);
            if (ticks[0].Time > cutoff)
                Print("WARNING: history ran out before the requested start. Earliest available tick: {0:yyyy.MM.dd HH:mm:ss.fff} UTC",
                    ticks[0].Time);

            Stop();
        }
    }
}

using System;
using cAlgo.API;

namespace Zugrio.CBot.DemoEA
{
    /// <summary>
    /// The only place in this repository that calls cTrader order or position APIs
    /// (ADR-0009). Every call is preceded by <see cref="RequireDemo"/>, which stops the
    /// robot and refuses if the account is live. The test NoOrderApiOutsideDemoExecution
    /// enforces both: order calls only in this file, and only directly after RequireDemo().
    /// </summary>
    internal sealed class DemoExecution
    {
        private readonly Robot _robot;
        public DemoExecution(Robot robot) { _robot = robot; }

        public void RequireDemo()
        {
            if (_robot.Account.IsLive)
            {
                _robot.Stop();
                throw new InvalidOperationException("LIVE ACCOUNT DETECTED: the Zugrio demo EA never trades a live account (ADR-0009).");
            }
        }

        public TradeResult MarketOrder(TradeType side, double units, string label, double stopLossPips, double takeProfitPips)
        {
            RequireDemo();
            return _robot.ExecuteMarketOrder(side, _robot.SymbolName, units, label, stopLossPips, takeProfitPips);
        }

        /// <summary>Absolute stop and target. Callers use it only when OrderClassifier says RISK_REDUCING, or to attach missing protection.</summary>
        public TradeResult SetProtection(Position position, double? stopLoss, double? takeProfit)
        {
            RequireDemo();
            return _robot.ModifyPosition(position, stopLoss, takeProfit, ProtectionType.Absolute);
        }

        public TradeResult Close(Position position)
        {
            RequireDemo();
            return _robot.ClosePosition(position);
        }
    }
}

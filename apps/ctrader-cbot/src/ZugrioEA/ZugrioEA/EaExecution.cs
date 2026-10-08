using System;
using cAlgo.API;

namespace Zugrio.CBot.EA
{
    /// <summary>
    /// The only place in this repository that calls cTrader order or position APIs
    /// (ADR-0010). Every call is preceded by <see cref="RequireBoundAccount"/>, which stops
    /// the robot and refuses if the account is no longer the one the EA started on. The test
    /// NoOrderApiOutsideEaExecution enforces both: order calls only in this file, and only
    /// directly after RequireBoundAccount().
    /// </summary>
    internal sealed class EaExecution
    {
        private readonly Robot _robot;
        private readonly long _accountNumber;
        private readonly bool _isLive;

        /// <summary>Binds to the account the EA started on (number and live/demo type).</summary>
        public EaExecution(Robot robot)
        {
            _robot = robot;
            _accountNumber = robot.Account.Number;
            _isLive = robot.Account.IsLive;
        }

        public bool IsLive => _isLive;

        public void RequireBoundAccount()
        {
            if (_robot.Account.Number != _accountNumber || _robot.Account.IsLive != _isLive)
            {
                _robot.Stop();
                throw new InvalidOperationException("ACCOUNT CHANGED: the Zugrio EA trades only the account it started on (ADR-0010).");
            }
        }

        public TradeResult MarketOrder(TradeType side, double units, string label, double stopLossPips, double takeProfitPips, string comment)
        {
            RequireBoundAccount();
            return _robot.ExecuteMarketOrder(side, _robot.SymbolName, units, label, stopLossPips, takeProfitPips, comment);
        }

        /// <summary>Absolute stop and target. Callers use it only when OrderClassifier says RISK_REDUCING, or to attach missing protection.</summary>
        public TradeResult SetProtection(Position position, double? stopLoss, double? takeProfit)
        {
            RequireBoundAccount();
            return _robot.ModifyPosition(position, stopLoss, takeProfit, ProtectionType.Absolute);
        }

        public TradeResult Close(Position position)
        {
            RequireBoundAccount();
            return _robot.ClosePosition(position);
        }
    }
}

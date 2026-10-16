# ZugrioTickRecorder (cTrader cBot)

A data-capture tool for #118. It exports historical **bid/ask ticks** from Deriv's cTrader feed in the MT5 tick-export format, so `synthnull.data.load_mt5_ticks` and `synthnull.feed_check` read it unchanged. It is the cTrader leg of the feed check in [DATA_SOURCE.md](../../DATA_SOURCE.md).

**It places no orders.** The source contains no trading calls, and CI greps for them. It has no sizing, stops or risk values. It runs with `AccessRights.None`.

## Build

The recorder is compiled against Spotware's official SDK, `cTrader.Automate` 1.0.21 (author: cTrader Team), with warnings treated as errors:

```bash
cd ZugrioTickRecorder/ZugrioTickRecorder
dotnet build -c Release        # -> bin/Release/net6.0/ZugrioTickRecorder.algo
```

Do **not** use the NuGet package `cAlgo.API` 1.0.0. Its author field is the template placeholder "YourNameOrOrganization", so it is not Spotware's.

## Use (Windows cTrader, Deriv demo account)

Either:
- double-click `ZugrioTickRecorder.algo`; or
- in cTrader, go to **Algo → New cBot**, paste `ZugrioTickRecorder.cs`, and click **Build**.

Then:
1. Add an instance on the symbol, e.g. **Boom 1000 Index**, set **Days back** (start with 7), and press **Start**. No permission prompt is expected: the cBot only writes inside its own sandbox folder.
2. The log shows the tick count, the first and last tick (UTC), and a warning if the server history ran out early.
3. The file is written to `Documents\cAlgo\Data\cBots\ZugrioTickRecorder\<Symbol>_ctrader_<N>d.csv`.

## Notes

- **File access.** On .NET 6, `AccessRights.FileSystem` is a compile error ("not supported in .NET 6.0 and higher"). The cBot uses cTrader's [file operations](https://help.ctrader.com/ctrader-algo/guides/file-operations/) sandbox instead: with `AccessRights.None`, a relative path resolves to the cBot's own folder.
- **The `File` name clash.** `File` is ambiguous between `System.IO.File` and `cAlgo.API.File`, so the source writes `System.IO.File` in full.
- **Memory.** The whole file is built in memory before it is written. Thirty days of a 1-second index is about 2.6 million rows, a few hundred MB while running. Start with 7 days.
- **Unverified until first run.** `LoadMoreHistory()` returning 0 at the history limit is the documented contract, but nobody has observed it on Deriv's server yet. The same goes for tick timestamps being UTC under `TimeZone = UTC`. Check the logged first/last times against the MT5 export.

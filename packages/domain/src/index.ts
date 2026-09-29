export interface VersionRef {
  readonly id: string;
  readonly version: string;
}

export interface MethodProfileRef extends VersionRef {
  readonly kind: "METHOD_PROFILE";
}

export interface TradeBundleRef extends VersionRef {
  readonly kind: "TRADE_BUNDLE";
}

export interface RegimeModelRef extends VersionRef {
  readonly kind: "REGIME_MODEL";
}

export interface TimeframeMapRef extends VersionRef {
  readonly kind: "TIMEFRAME_MAP";
}

export interface FixtureScope {
  readonly market: "FX";
  readonly instrument: string;
  readonly horizon: "Intraday";
  readonly admission: "NON_ADMITTED_FIXTURE";
  readonly liveData: false;
  readonly liveCapital: false;
}

export interface BundleIdentity {
  readonly methodProfile: MethodProfileRef;
  readonly tradeBundle: TradeBundleRef;
  readonly regimeModel: RegimeModelRef;
  readonly timeframeMap: TimeframeMapRef;
  readonly scope: FixtureScope;
}

export function versionKey(ref: VersionRef): string {
  return `${ref.id}@${ref.version}`;
}

export function bundleIdentityKey(identity: BundleIdentity): string {
  return [
    versionKey(identity.methodProfile),
    versionKey(identity.tradeBundle),
    versionKey(identity.regimeModel),
    versionKey(identity.timeframeMap),
    identity.scope.market,
    identity.scope.instrument,
    identity.scope.horizon,
    identity.scope.admission,
  ].join("|");
}

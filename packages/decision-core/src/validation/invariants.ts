/** Research utilities: no clock, network, account lookup or execution authority. */
export function instant(value: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Invalid UTC timestamp');
  return Date.parse(value);
}
export function finite(value: number, label: string, minimum = 0): void {
  if (!Number.isFinite(value) || value < minimum) throw new Error(`Invalid ${label}`);
}
export function nonempty(value: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing identity');
}
export function exact(value: object, keys: readonly string[]): void {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error('Unexpected field at canonical boundary');
}
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => inner && typeof inner === 'object' && !Array.isArray(inner)
    ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : inner);
}
export function immutable<T>(value: T): T {
  const copy: T = structuredClone(value);
  const freeze = (v: unknown): void => {
    if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
  };
  freeze(copy);
  return copy;
}
export interface VersionRef { readonly id: string; readonly version: string }
export function version(ref: VersionRef): void { nonempty(ref.id); nonempty(ref.version); }
export function causal(sourceAt: string, knownAt: string, evaluatedAt: string): void {
  if (instant(sourceAt) > instant(knownAt) || instant(knownAt) > instant(evaluatedAt)) throw new Error('Future-known or reordered evidence');
}
export const RESEARCH_AUTHORITY = Object.freeze({ authority: 'RESEARCH_ONLY', liveCapitalAuthority: false } as const);

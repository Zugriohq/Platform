import type { EngineChartPrimitive } from "@zugrio/decision-core";

/**
 * The single mapping from engine semantic style tokens to visual treatment.
 * Presentation only: a token never becomes trading meaning, and concept names
 * are not styled ad hoc anywhere else.
 */
export interface TokenStyle {
  readonly className: string;
  readonly strokeWidth: number;
  readonly dash: string | undefined;
  readonly fillOpacity: number;
}

export const STYLE_TOKENS: Readonly<Record<EngineChartPrimitive["styleToken"], TokenStyle>> = {
  STRUCTURE_PRIMARY: { className: "tok-structure-primary", strokeWidth: 1.6, dash: undefined, fillOpacity: 0.1 },
  STRUCTURE_SECONDARY: { className: "tok-structure-secondary", strokeWidth: 1.1, dash: "4 3", fillOpacity: 0.07 },
  LIQUIDITY: { className: "tok-liquidity", strokeWidth: 1.2, dash: "1 3", fillOpacity: 0.08 },
  IMBALANCE: { className: "tok-imbalance", strokeWidth: 1, dash: undefined, fillOpacity: 0.12 },
  SETUP: { className: "tok-setup", strokeWidth: 1.3, dash: "6 3", fillOpacity: 0.09 },
  PATTERN: { className: "tok-pattern", strokeWidth: 1, dash: "2 2", fillOpacity: 0.06 },
  ENTRY: { className: "tok-entry", strokeWidth: 1.4, dash: undefined, fillOpacity: 0.1 },
  ADVISORY: { className: "tok-advisory", strokeWidth: 0.9, dash: "1 4", fillOpacity: 0.05 },
};

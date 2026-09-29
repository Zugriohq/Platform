/**
 * Deterministic label / callout placement. Pure: same requests and bounds give
 * the same boxes. Greedy in request order over a fixed ring of candidate offsets;
 * a label that cannot be placed without leaving the bounds or overlapping an
 * already placed box is reported as not placed (the fact itself is still drawn).
 */

export interface LabelRequest {
  readonly id: string;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly text: string;
}

export interface LabelBox {
  readonly id: string;
  readonly text: string;
  readonly truncated: boolean;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly placed: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LayoutBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface LayoutOptions {
  readonly maxChars: number;
  readonly charWidth: number;
  readonly height: number;
  readonly paddingX: number;
  readonly gap: number;
  readonly maxPlaced: number;
  /** Keep-out radius around every request's anchor (markers), not just a label's own. */
  readonly anchorClearance: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  maxChars: 30,
  charWidth: 7.2,
  height: 20,
  paddingX: 7,
  gap: 3,
  maxPlaced: 12,
  anchorClearance: 5,
};

// Unit directions tried at each distance, in fixed order.
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, -1], [-1, -1], [1, 1], [-1, 1], [1, 0], [-1, 0], [0, -1], [0, 1],
];
const DISTANCES = [10, 22, 38, 58, 84];

export function truncateLabel(text: string, maxChars: number): { text: string; truncated: boolean } {
  const chars = [...text];
  if (chars.length <= maxChars) return { text, truncated: false };
  return { text: chars.slice(0, Math.max(1, maxChars - 1)).join("") + "…", truncated: true };
}

function coversPoint(box: { x: number; y: number; width: number; height: number }, px: number, py: number, radius: number): boolean {
  const nearestX = Math.min(Math.max(px, box.x), box.x + box.width);
  const nearestY = Math.min(Math.max(py, box.y), box.y + box.height);
  return (px - nearestX) ** 2 + (py - nearestY) ** 2 < radius * radius;
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a, gap: number): boolean {
  return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
}

export function layoutLabels(
  requests: readonly LabelRequest[],
  bounds: LayoutBounds,
  options: LayoutOptions = DEFAULT_LAYOUT,
): readonly LabelBox[] {
  const placed: LabelBox[] = [];
  const anchors = requests.filter(request => Number.isFinite(request.anchorX) && Number.isFinite(request.anchorY));
  const result: LabelBox[] = [];
  for (const request of requests) {
    const label = truncateLabel(request.text, options.maxChars);
    const width = Math.min(bounds.right - bounds.left, [...label.text].length * options.charWidth + options.paddingX * 2);
    const height = options.height;
    let chosen: LabelBox | undefined;
    if (placed.length < options.maxPlaced && Number.isFinite(request.anchorX) && Number.isFinite(request.anchorY)) {
      search: for (const distance of DISTANCES) {
        for (const [dx, dy] of DIRECTIONS) {
          const x = dx > 0 ? request.anchorX + distance : dx < 0 ? request.anchorX - distance - width : request.anchorX - width / 2;
          const y = dy > 0 ? request.anchorY + distance : dy < 0 ? request.anchorY - distance - height : request.anchorY - height / 2;
          const box = { x, y, width, height };
          if (x < bounds.left || y < bounds.top || x + width > bounds.right || y + height > bounds.bottom) continue;
          // never cover any anchor or marker (its own included)
          if (anchors.some(other => coversPoint(box, other.anchorX, other.anchorY, options.anchorClearance))) continue;
          if (placed.some(other => overlaps(box, other, options.gap))) continue;
          chosen = { id: request.id, text: label.text, truncated: label.truncated, anchorX: request.anchorX, anchorY: request.anchorY, placed: true, ...box };
          break search;
        }
      }
    }
    const box = chosen ?? {
      id: request.id, text: label.text, truncated: label.truncated, anchorX: request.anchorX, anchorY: request.anchorY,
      placed: false, x: 0, y: 0, width, height,
    };
    if (box.placed) placed.push(box);
    result.push(box);
  }
  return result;
}

/**
 * Report chart colours. Validated categorical palette (light surface):
 * passes lightness, chroma, CVD (worst adjacent ΔE 9.1) and normal-vision
 * floors. Slots 3–5 are below 3:1 against the surface, so every chart that
 * uses them keeps a legend and a table view.
 */
export const SERIES_COLORS = [
  "#5b5bf0", // indigo (brand)
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#2a78d6", // blue
  "#e34948", // red
] as const;

/** Accounts past the eighth slot are drawn neutral rather than reusing a hue. */
export const OVERFLOW_SERIES_COLOR = "var(--muted-foreground)";

/**
 * Colour for an entity by its stable position in the full list (never its
 * rank in a filtered view), so the same account keeps its colour everywhere.
 */
export function seriesColor(stableIndex: number) {
  return stableIndex >= 0 && stableIndex < SERIES_COLORS.length
    ? SERIES_COLORS[stableIndex]
    : OVERFLOW_SERIES_COLOR;
}

/** Credit / debit / net flows: brand indigo vs amber (not red/green). */
export const FLOW_COLORS = {
  credits: "var(--chart-1)",
  debits: "var(--chart-2)",
  net: "var(--chart-4)",
} as const;

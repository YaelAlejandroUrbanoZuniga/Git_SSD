import type { ChartOptions } from 'chart.js';
import { colors } from './colors';
import { fontFamily } from './typography';

/**
 * ============================================================================
 * CHARTS — Nexteer UI Kit v7 (Chart.js 4 + react-chartjs-2 5)
 * ============================================================================
 * Chart.js is the only chart library (it replaced Recharts in the reference
 * implementation for bundle size). Register ONLY the pieces a screen draws —
 * never `chart.js/auto`:
 *
 *   ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip);
 *
 * Legends are HTML (ChartCard's `legend` slot), so the Legend plugin is not
 * registered: an HTML legend stays put while a long bar list scrolls under it.
 * ============================================================================
 */

export const chart = {
  /** Tick labels on both axes. */
  tickFontSize: 11,
  /** Grid lines: canvas grey, dashed 3/3 (in Chart.js v4 the dash lives on `border.dash`). */
  gridColor: colors.core.canvas,
  gridDash: [3, 3] as number[],
  /** Bars: rounded 4. */
  barRadius: 4,
  /** Doughnut hole, in px. */
  doughnutCutout: 50,
  /** Horizontal bar lists grow with their rows, then the card scrolls (CARD_SCROLL_MAX_HEIGHT). */
  barListRowPx: 24,
  barListAxisPx: 32,
  /** Legend swatch. */
  swatchSize: 10,
  swatchRadius: 2,
  /** Longest category label on an axis before it is truncated with "…" (full text in the tooltip). */
  labelMaxChars: 24,
  /** Device-pixel ratio used when a chart is captured for PDF export. */
  exportDpr: 3,
} as const;

/** Height of a horizontal bar list with `rows` categories. */
export const barListHeight = (rows: number, rowPx: number = chart.barListRowPx) => rows * rowPx + chart.barListAxisPx;

/** Truncates an axis label; the tooltip keeps the full text. */
export const truncateLabel = (text: string, max: number = chart.labelMaxChars) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/**
 * N distinct colors for OPEN-ENDED categories (commodities, countries…).
 * Hues step by the golden angle so a hue is never reused, and lightness cycles
 * through three bands so neighbouring hues also differ in value.
 *
 * Categories that already own a color in the system (a stage, a status, a
 * module) MUST use that color instead — reuse rule, UI_STANDARD.md §3.5.
 */
export function categoricalPalette(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const h = (193 + i * 137.508) % 330;
    const hue = h < 225 ? h : h + 30; // skips the blue-violet band, as the reference implementation does
    return `hsl(${hue.toFixed(1)}, 70%, ${[42, 55, 34][i % 3]}%)`;
  });
}

const baseFont = { family: fontFamily, size: chart.tickFontSize };

/** Options for a horizontal bar list (categories on Y, counts on X). */
export function horizontalBarOptions(): ChartOptions<'bar'> {
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { font: baseFont, precision: 0 },
        grid: { color: chart.gridColor },
        border: { dash: chart.gridDash },
      },
      y: {
        ticks: { font: baseFont, autoSkip: false },
        grid: { display: false },
        border: { dash: chart.gridDash },
      },
    },
  };
}

/** Options for a vertical bar chart (categories on X, counts on Y). */
export function verticalBarOptions(): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { font: baseFont },
        grid: { display: false },
        border: { dash: chart.gridDash },
      },
      y: {
        ticks: { font: baseFont, precision: 0 },
        grid: { color: chart.gridColor },
        border: { dash: chart.gridDash },
      },
    },
  };
}

/** Options for a doughnut. Its legend is HTML, next to it. */
export function doughnutOptions(): ChartOptions<'doughnut'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: chart.doughnutCutout,
    plugins: { legend: { display: false } },
  };
}

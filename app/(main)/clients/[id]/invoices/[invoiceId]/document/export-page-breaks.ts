const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const SPACER_ATTR = "data-export-pagebreak-spacer";
/** Matches Tailwind `pt-10` (2.5rem). */
const CONTINUATION_TOP_GAP_REM = 2.5;

function relativeBounds(paper: HTMLElement, el: HTMLElement) {
  const paperRect = paper.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return {
    top: elRect.top - paperRect.top,
    bottom: elRect.bottom - paperRect.top,
    height: elRect.height,
  };
}

function pageHeightPx(paper: HTMLElement) {
  const width = paper.getBoundingClientRect().width;
  if (width <= 0) return 0;
  return (A4_HEIGHT_MM / A4_WIDTH_MM) * width;
}

function continuationTopGapPx() {
  const rootFontSize =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return CONTINUATION_TOP_GAP_REM * rootFontSize;
}

function collectKeepTogetherUnits(paper: HTMLElement): HTMLElement[] {
  const units: HTMLElement[] = [];

  const table = paper.querySelector<HTMLTableElement>("[data-invoice-table]");
  const headerRow = table?.querySelector<HTMLElement>("thead tr");
  if (headerRow) units.push(headerRow);

  paper
    .querySelectorAll<HTMLElement>("[data-invoice-table-row]")
    .forEach((row) => units.push(row));

  const totals = paper.querySelector<HTMLElement>("[data-invoice-totals]");
  if (totals) units.push(totals);

  const closing = paper.querySelector<HTMLElement>("[data-invoice-closing]");
  if (closing) units.push(closing);

  return units.sort(
    (a, b) => relativeBounds(paper, a).top - relativeBounds(paper, b).top,
  );
}

function insertSpacerBefore(el: HTMLElement, heightPx: number) {
  if (el instanceof HTMLTableRowElement) {
    const spacer = document.createElement("tr");
    spacer.setAttribute(SPACER_ATTR, "true");
    const cell = document.createElement("td");
    cell.colSpan = Math.max(el.cells.length, 1);
    cell.style.height = `${heightPx}px`;
    cell.style.padding = "0";
    cell.style.border = "none";
    cell.style.lineHeight = "0";
    cell.style.fontSize = "0";
    spacer.appendChild(cell);
    el.parentElement?.insertBefore(spacer, el);
    return;
  }

  const spacer = document.createElement("div");
  spacer.setAttribute(SPACER_ATTR, "true");
  spacer.style.height = `${heightPx}px`;
  spacer.style.width = "100%";
  spacer.style.flexShrink = "0";
  el.parentElement?.insertBefore(spacer, el);
}

/** Removes spacers inserted for PDF page-break alignment. */
export function clearExportPageBreaks(paper: HTMLElement) {
  paper
    .querySelectorAll(`[${SPACER_ATTR}]`)
    .forEach((node) => node.parentElement?.removeChild(node));
}

/**
 * Inserts spacers so A4 image slices do not cut through:
 * - individual table body rows (overflowing rows move to the next page)
 * - the totals block (kept as one unit)
 * - the closing note + signing block (kept as one unit)
 *
 * Continuation pages always start with a `pt-10` top gap.
 */
export function applyExportPageBreaks(paper: HTMLElement) {
  clearExportPageBreaks(paper);

  const pageH = pageHeightPx(paper);
  if (pageH <= 0) return;

  const topGap = continuationTopGapPx();
  const continuationPageCapacity = pageH - topGap;
  const maxIterations = 200;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const units = collectKeepTogetherUnits(paper);
    let inserted = false;

    for (const unit of units) {
      const { top, bottom, height } = relativeBounds(paper, unit);
      const pageIndex = Math.floor(top / pageH);
      const pageTop = pageIndex * pageH;
      const pageBottom = pageTop + pageH;
      const minContentTop = pageIndex === 0 ? pageTop : pageTop + topGap;

      // Keep content below the continuation-page top gap.
      if (pageIndex > 0 && top < minContentTop - 0.5) {
        const spacerHeight = minContentTop - top;
        if (spacerHeight >= 1) {
          insertSpacerBefore(unit, spacerHeight);
          inserted = true;
          break;
        }
      }

      // Units that cannot fit on a continuation page cannot be kept together.
      if (height > continuationPageCapacity - 1) continue;

      if (top < pageBottom - 0.5 && bottom > pageBottom + 0.5) {
        const nextContentTop = pageBottom + topGap;
        const spacerHeight = nextContentTop - top;
        if (spacerHeight >= 1) {
          insertSpacerBefore(unit, spacerHeight);
          inserted = true;
          break;
        }
      }
    }

    if (!inserted) break;
  }
}

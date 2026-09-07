// Shared numbered-pagination helper - used by both OrderPicker and
// TicketsView so a windowed page-number list (with ellipsis gaps) is
// computed identically everywhere it's needed, rather than each
// component re-deriving its own version that could silently drift.

/**
 * Windowed page-number list with ellipsis gaps, e.g. for current=5,
 * total=12: [1, '…', 3, 4, 5, 6, 7, '…', 12]. Always includes page 1
 * and the last page so a viewer can jump straight to either end of a
 * long list without stepping through every page.
 *
 * @param {number} current
 * @param {number} total
 * @returns {(number|'…')[]}
 */
export function windowedPageNumbers(current, total) {
  const delta = 2;
  const pages = [];
  for (let p = 1; p <= total; p += 1) {
    if (p === 1 || p === total || (p >= current - delta && p <= current + delta)) {
      pages.push(p);
    }
  }
  const withEllipsis = [];
  let previous = 0;
  for (const p of pages) {
    if (previous && p - previous > 1) withEllipsis.push('…');
    withEllipsis.push(p);
    previous = p;
  }
  return withEllipsis;
}

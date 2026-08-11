import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Intelligent report paginator.
 *
 * Instead of letting the browser break a long document wherever it likes (which
 * produced orphaned headings, clipped rows and near-empty pages), this measures
 * every top-level block once it has been laid out and packs the blocks into real
 * A4 pages. Each page then renders its own running header and a numbered footer,
 * so "Page 3 of 11" is correct and the identity band repeats on every sheet.
 *
 * Safety rule: a page is `min-height`, never a fixed height, and never clips.
 * If a single block is taller than one page (a very long table), the page simply
 * grows and the browser breaks inside it naturally — content is never cut off.
 */

/** A4 geometry in millimetres — the single source of truth for the layout. */
export const A4 = {
  widthMm: 210,
  heightMm: 297,
  /** Outer page padding. */
  padXMm: 14,
  padTopMm: 10,
  padBottomMm: 8,
  /** Vertical space reserved for the running header / numbered footer. */
  headerMm: 18,
  footerMm: 10,
};

const MM_TO_PX = 96 / 25.4;
const mm = (v: number) => v * MM_TO_PX;

/** Usable content height on one page, in CSS pixels. */
const CONTENT_HEIGHT_PX =
  mm(A4.heightMm - A4.padTopMm - A4.padBottomMm - A4.headerMm - A4.footerMm);

/** Content width on one page, in CSS pixels. */
export const CONTENT_WIDTH_PX = mm(A4.widthMm - A4.padXMm * 2);

export interface ReportBlock {
  key: string;
  /** Start this block on a fresh page (used for major section boundaries). */
  breakBefore?: boolean;
  node: React.ReactNode;
}

interface ReportPaginatorProps {
  blocks: ReportBlock[];
  /** Rendered at the top of every page. Receives the 1-based page number. */
  renderHeader: (pageNumber: number, totalPages: number) => React.ReactNode;
  /** Rendered at the bottom of every page. */
  renderFooter: (pageNumber: number, totalPages: number) => React.ReactNode;
  /** Rendered once, above the first block on page 1 (the report masthead). */
  cover?: React.ReactNode;
}

export const ReportPaginator: React.FC<ReportPaginatorProps> = ({
  blocks,
  renderHeader,
  renderFooter,
  cover,
}) => {
  const measureRef = useRef<HTMLDivElement>(null);
  // Page assignment: pages[i] = array of block indexes on that page.
  const [pages, setPages] = useState<number[][]>([]);
  const [measured, setMeasured] = useState(false);

  // Re-measure whenever the block set changes (different sections selected).
  const signature = blocks.map((b) => b.key).join('|');

  useLayoutEffect(() => {
    setMeasured(false);
    setPages([]);
  }, [signature]);

  useEffect(() => {
    if (measured) return;
    const host = measureRef.current;
    if (!host) return;

    // Measure after the browser has laid out (and web fonts have settled) so the
    // heights we pack with are the heights that will actually print.
    const run = () => {
      const children = Array.from(host.children) as HTMLElement[];
      if (children.length === 0) {
        setPages([]);
        setMeasured(true);
        return;
      }

      const coverEl = cover ? children[0] : null;
      const blockEls = cover ? children.slice(1) : children;

      const next: number[][] = [];
      let current: number[] = [];
      // Page 1 also carries the masthead, so it starts with less free space.
      let used = coverEl ? coverEl.offsetHeight : 0;

      blockEls.forEach((el, i) => {
        const style = window.getComputedStyle(el);
        const height =
          el.offsetHeight +
          parseFloat(style.marginTop || '0') +
          parseFloat(style.marginBottom || '0');

        const forceBreak = blocks[i]?.breakBefore && current.length > 0;
        const overflows = current.length > 0 && used + height > CONTENT_HEIGHT_PX;

        if (forceBreak || overflows) {
          next.push(current);
          current = [i];
          used = height;
        } else {
          current.push(i);
          used += height;
        }
      });

      if (current.length > 0) next.push(current);
      setPages(next.length > 0 ? next : [[]]);
      setMeasured(true);
    };

    // Two rAFs: first lets React commit, second lets layout/fonts settle.
    const raf = requestAnimationFrame(() => requestAnimationFrame(run));
    return () => cancelAnimationFrame(raf);
  }, [measured, signature, blocks, cover]);

  // ── Measuring pass ─────────────────────────────────────────────────────────
  // Rendered off-screen at the exact printable width so measurements match.
  if (!measured) {
    return (
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: 'absolute',
          left: -99999,
          top: 0,
          width: CONTENT_WIDTH_PX,
          visibility: 'hidden',
        }}
      >
        {cover}
        {blocks.map((b) => (
          // Same wrapper class as the final render, so the measured height
          // includes the identical margins and the packing stays accurate.
          <div key={b.key} className="kvj-block">
            {b.node}
          </div>
        ))}
      </div>
    );
  }

  // ── Paginated pass ─────────────────────────────────────────────────────────
  const totalPages = Math.max(pages.length, 1);

  return (
    <div className="kvj-report">
      {pages.map((blockIdxs, pageIdx) => (
        <section
          className="kvj-page"
          key={pageIdx}
          style={{
            width: `${A4.widthMm}mm`,
            minHeight: `${A4.heightMm}mm`,
            padding: `${A4.padTopMm}mm ${A4.padXMm}mm ${A4.padBottomMm}mm`,
            boxSizing: 'border-box',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            margin: '0 auto 16px',
            position: 'relative',
            overflow: 'visible',
          }}
        >
          <header
            className="kvj-page-header"
            style={{ minHeight: `${A4.headerMm}mm`, flexShrink: 0 }}
          >
            {renderHeader(pageIdx + 1, totalPages)}
          </header>

          <div className="kvj-page-body" style={{ flex: '1 1 auto', minWidth: 0 }}>
            {pageIdx === 0 && cover}
            {blockIdxs.map((i) => (
              <div key={blocks[i].key} className="kvj-block">
                {blocks[i].node}
              </div>
            ))}
          </div>

          <footer
            className="kvj-page-footer"
            style={{ minHeight: `${A4.footerMm}mm`, flexShrink: 0, marginTop: 'auto' }}
          >
            {renderFooter(pageIdx + 1, totalPages)}
          </footer>
        </section>
      ))}
    </div>
  );
};

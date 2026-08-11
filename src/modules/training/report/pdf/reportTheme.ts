/**
 * Centralized PDF design system for the training reports.
 * One source of truth for A4 geometry, typography, spacing and colour so the
 * vector builder never hardcodes styling in multiple places.
 *
 * Units: millimetres for geometry (jsPDF unit 'mm'), points for font sizes.
 */

export const PDF_THEME = {
  page: {
    format: 'a4' as const,
    orientation: 'portrait' as const,
    widthMm: 210,
    heightMm: 297,
    margin: { top: 22, right: 14, bottom: 16, left: 14 },
    headerBaselineMm: 12,   // running header text baseline from page top
    footerBaselineMm: 289,  // footer text baseline from page top
  },

  font: {
    family: 'helvetica' as const,
    title: 17,
    h2: 12,
    h3: 10.5,
    body: 9,
    small: 8,
    table: 8.5,
    tableHead: 8.5,
    footer: 7.5,
    kpiValue: 15,
    kpiLabel: 7.5,
  },

  space: {
    section: 8,     // gap before a new section heading
    afterHeading: 3,
    paragraph: 4,
    kpiGap: 3,
  },

  // RGB triples. Restrained, print-safe, readable in grayscale.
  color: {
    ink: [15, 23, 42] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    faint: [148, 163, 184] as [number, number, number],
    accent: [30, 64, 175] as [number, number, number],       // deep blue
    rule: [203, 213, 225] as [number, number, number],
    tableHeadBg: [30, 64, 175] as [number, number, number],
    tableHeadText: [255, 255, 255] as [number, number, number],
    zebra: [246, 248, 251] as [number, number, number],
    good: [22, 101, 52] as [number, number, number],
    goodBg: [220, 252, 231] as [number, number, number],
    bad: [153, 27, 27] as [number, number, number],
    badBg: [254, 226, 226] as [number, number, number],
    warnText: [146, 64, 14] as [number, number, number],
    kpiBoxBg: [248, 250, 252] as [number, number, number],
  },
} as const;

/** Usable content width in millimetres. */
export const CONTENT_W =
  PDF_THEME.page.widthMm - PDF_THEME.page.margin.left - PDF_THEME.page.margin.right;

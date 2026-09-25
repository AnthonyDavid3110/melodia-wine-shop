import { StyleSheet } from "@react-pdf/renderer";

/**
 * Phase 12 Gate 12B — shared print styling. Restrained use of the
 * approved Programme V2 palette (`docs/07-DESIGN-SYSTEM.md` §72,
 * `TBD-DESIGN-001 — RESOLVED`): white page (never the tinted `paper`
 * background — a full-page tint wastes toner and lowers printed
 * contrast), `ink` for all information-bearing text, `oxblood` used
 * only for the small decorative wordmark/rule — never for anything
 * that must survive black-and-white printing. Built-in Helvetica only
 * (no embedded fonts, no downloaded assets — approved Step 2 scope).
 */
export const INK = "#1B1712";
export const OXBLOOD = "#7A2E2E";

export const pdfStyles = StyleSheet.create({
  page: {
    // `fixed` elements (the footer below) render absolutely-positioned
    // OUTSIDE the normal content-flow height calculation react-pdf
    // uses to decide where to break a page — without reserving extra
    // bottom padding, flowing content and the fixed footer visually
    // collide at the bottom of every page. paddingBottom is
    // deliberately larger than the other three sides to give the
    // footer (anchored at bottom: 24) clear space above it.
    paddingTop: 48,
    paddingBottom: 64,
    paddingLeft: 48,
    paddingRight: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: INK,
  },
  brandHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: OXBLOOD,
    paddingBottom: 6,
    marginBottom: 16,
  },
  brandLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: OXBLOOD,
  },
  campaignLabel: {
    fontSize: 9,
    color: INK,
  },
  documentTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    marginBottom: 4,
  },
  orderNumber: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    marginBottom: 10,
  },
  section: {
    marginBottom: 18,
  },
  block: {
    marginBottom: 10,
  },
  blockLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1,
    color: OXBLOOD,
    marginBottom: 3,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  bodyBold: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginBottom: 1,
  },
  bodyItalic: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 9,
    marginTop: 2,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 3,
    marginBottom: 4,
  },
  tableHeaderCellArticle: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tableHeaderCellQty: {
    width: 70,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CFC9BC",
    paddingVertical: 4,
  },
  tableCellArticle: {
    flex: 1,
  },
  tableCellQty: {
    width: 70,
    textAlign: "right",
    fontSize: 10,
  },
  compositionLine: {
    fontSize: 8.5,
    color: INK,
    marginTop: 1,
    marginLeft: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingTop: 5,
    marginTop: 2,
  },
  totalLabel: {
    fontSize: 9,
  },
  totalAmount: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  checkboxRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 6,
  },
  checkboxItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxBox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: INK,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxMark: {
    width: 8,
    height: 8,
    backgroundColor: INK,
  },
  checkboxLabel: {
    fontSize: 9.5,
  },
  coverSection: {
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 8,
  },
  summaryItem: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  orderSeparator: {
    borderTopWidth: 1,
    borderTopColor: "#CFC9BC",
    paddingTop: 14,
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: INK,
  },

  // Phase 12 Gate 12C — customer-facing commercial documents
  // (order confirmation / receipt). Adds a 4-column priced item table
  // (the preparation sheet's 2-column table has no price columns) and
  // an organisation-identity block; everything else above is reused
  // unchanged.
  orgBlock: {
    marginBottom: 14,
  },
  priceTableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 3,
    marginBottom: 4,
  },
  priceTableHeaderCellArticle: {
    flex: 1,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  priceTableHeaderCellQty: {
    width: 50,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  priceTableHeaderCellPrice: {
    width: 80,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  priceTableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CFC9BC",
    paddingVertical: 4,
  },
  priceTableCellArticle: {
    flex: 1,
  },
  priceTableCellQty: {
    width: 50,
    textAlign: "right",
    fontSize: 10,
  },
  priceTableCellPrice: {
    width: 80,
    textAlign: "right",
    fontSize: 10,
  },
});

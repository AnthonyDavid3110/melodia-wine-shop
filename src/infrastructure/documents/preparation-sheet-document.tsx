import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { PreparationSheetContent } from "@/domain/documents/build-preparation-sheet-content";
import type { SellerPreparationSummaryContent } from "@/domain/documents/build-seller-preparation-summary-content";
import { pdfStyles } from "./pdf-styles";

/**
 * Phase 12 Gate 12B — the React-PDF component layer. Takes only the
 * plain content models from `src/domain/documents/` as props — never
 * DB rows, never an HTTP request, never performs auth. This is the
 * one place `@react-pdf/renderer` JSX is used outside `pdf-renderer.ts`
 * itself.
 *
 * Pagination is deliberately simple (approved Step 2 §10): the page-
 * level brand header/footer use `fixed` (the library's own safe,
 * standard idiom for repeating page furniture), but per-order content
 * does NOT use `fixed` — nesting a "repeat this order's identity on
 * continuation pages" fixed element inside a wrapping per-order
 * section risks that element leaking onto unrelated pages of a multi-
 * order seller document. Instead, each order's identity/client block
 * is kept `wrap={false}` (always rendered intact, never split — it is
 * small enough to always fit) and each table row is `wrap={false}` too
 * (a single row is never split awkwardly); the table itself and the
 * overall section still flow naturally across a page break via the
 * default `wrap` behaviour if a genuinely long order requires it.
 * Correct, readable pagination over clever pagination.
 */

function BrandHeader({ campaignName }: { campaignName: string }) {
  return (
    <View style={pdfStyles.brandHeader} fixed>
      <Text style={pdfStyles.brandLabel}>LES VINS DE MÉLODIA</Text>
      <Text style={pdfStyles.campaignLabel}>{campaignName}</Text>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={pdfStyles.footer} fixed>
      <Text>Les Vins de Mélodia — document de préparation interne</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Checkbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={pdfStyles.checkboxItem}>
      <View style={pdfStyles.checkboxBox}>
        {checked ? <View style={pdfStyles.checkboxMark} /> : null}
      </View>
      <Text style={pdfStyles.checkboxLabel}>{label}</Text>
    </View>
  );
}

function PreparationSheetSection({ content }: { content: PreparationSheetContent }) {
  // The entire order section is kept unbreakable (approved Step 2 §10:
  // "correct readable pagination > clever pagination"). Splitting a
  // section mid-way collided with the fixed footer's reserved space in
  // early testing (visually verified, see the Gate 12B Step 3 report's
  // manual-inspection findings) — at ECM's realistic order sizes
  // (a handful of wines/bundles), moving a whole order to a fresh page
  // when it doesn't fit the remainder of the current one is simple,
  // robust, and never produces a confusing mid-order break.
  return (
    <View style={pdfStyles.section} wrap={false}>
      <Text style={pdfStyles.orderNumber}>{content.orderNumber}</Text>

      <View style={pdfStyles.block}>
        <Text style={pdfStyles.blockLabel}>CLIENT</Text>
        <Text style={pdfStyles.bodyBold}>{content.customerName}</Text>
        <Text style={pdfStyles.body}>{content.address}</Text>
        <Text style={pdfStyles.body}>
          {content.postalCode} {content.city}
        </Text>
        <Text style={pdfStyles.body}>{content.phone}</Text>
        {content.deliveryNote ? (
          <Text style={pdfStyles.bodyItalic}>{content.deliveryNote}</Text>
        ) : null}
      </View>

      <View style={pdfStyles.block}>
        <Text style={pdfStyles.blockLabel}>VENDEUR</Text>
        <Text style={pdfStyles.body}>{content.sellerName ?? "Non attribuée"}</Text>
      </View>

      <View style={pdfStyles.block}>
        <Text style={pdfStyles.blockLabel}>ARTICLES</Text>
        <View style={pdfStyles.tableHeaderRow}>
          <Text style={pdfStyles.tableHeaderCellArticle}>Article</Text>
          <Text style={pdfStyles.tableHeaderCellQty}>Quantité</Text>
        </View>
        {content.items.map((item, index) => (
          <View key={index} style={pdfStyles.tableRow} wrap={false}>
            <View style={pdfStyles.tableCellArticle}>
              <Text style={pdfStyles.body}>{item.name}</Text>
              {item.composition.map((component, componentIndex) => (
                <Text key={componentIndex} style={pdfStyles.compositionLine}>
                  {component.quantityPerBundle} × {component.name}
                </Text>
              ))}
            </View>
            <Text style={pdfStyles.tableCellQty}>{item.quantity}</Text>
          </View>
        ))}
        <View style={pdfStyles.totalRow} wrap={false}>
          <Text style={pdfStyles.totalLabel}>
            Total ({content.totalBottles} bouteille{content.totalBottles !== 1 ? "s" : ""})
          </Text>
          <Text style={pdfStyles.totalAmount}>{content.totalAmountFormatted}</Text>
        </View>
      </View>

      <View style={pdfStyles.block} wrap={false}>
        <Text style={pdfStyles.blockLabel}>PAIEMENT</Text>
        <Text style={pdfStyles.body}>
          {content.paymentMethodLabel || "—"} — {content.customerPaymentStatusLabel}
        </Text>
      </View>

      <View style={pdfStyles.checkboxRow} wrap={false}>
        <Checkbox checked={content.isPrepared} label="Préparée" />
        <Checkbox checked={content.isHandedToSeller} label="Remise au vendeur" />
      </View>
    </View>
  );
}

export function IndividualPreparationDocument({
  content,
  campaignName,
}: {
  content: PreparationSheetContent;
  campaignName: string;
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <BrandHeader campaignName={campaignName} />
        <Text style={pdfStyles.documentTitle}>Bon de préparation</Text>
        <PreparationSheetSection content={content} />
        <PageFooter />
      </Page>
    </Document>
  );
}

export function SellerPreparationDocument({
  content,
}: {
  content: SellerPreparationSummaryContent;
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <BrandHeader campaignName={content.campaignName} />
        <View style={pdfStyles.coverSection} wrap={false}>
          <Text style={pdfStyles.documentTitle}>Bon de préparation — {content.sellerName}</Text>
          <View style={pdfStyles.summaryRow}>
            <Text style={pdfStyles.summaryItem}>
              {content.orderCount} commande{content.orderCount !== 1 ? "s" : ""}
            </Text>
            <Text style={pdfStyles.summaryItem}>
              {content.totalBottles} bouteille{content.totalBottles !== 1 ? "s" : ""}
            </Text>
            <Text style={pdfStyles.summaryItem}>{content.totalSalesFormatted}</Text>
          </View>
        </View>
        {content.orders.map((order, index) => (
          <View key={index} style={index > 0 ? pdfStyles.orderSeparator : undefined}>
            <PreparationSheetSection content={order} />
          </View>
        ))}
        <PageFooter />
      </Page>
    </Document>
  );
}

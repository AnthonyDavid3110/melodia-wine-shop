import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { OrderDocumentContent } from "@/domain/documents/build-order-document-content";
import { pdfStyles } from "./pdf-styles";

/**
 * Phase 12 Gate 12C — the React-PDF component for BOTH customer-facing
 * commercial documents (order confirmation, receipt). Shared, not
 * duplicated: it renders whatever `OrderDocumentContent` it receives —
 * the title and the optional payment-status line already encode which
 * variant this is, decided entirely by the domain layer
 * (`build-order-document-content.ts`). This component performs no
 * variant branching of its own and holds no business rule — it is a
 * pure display of already-decided content, matching the same
 * separation already established for `preparation-sheet-document.tsx`
 * (Gate 12B).
 */

function BrandHeader() {
  return (
    <View style={pdfStyles.brandHeader} fixed>
      <Text style={pdfStyles.brandLabel}>LES VINS DE MÉLODIA</Text>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={pdfStyles.footer} fixed>
      <Text>Les Vins de Mélodia</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function OrderDocument({ content }: { content: OrderDocumentContent }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <BrandHeader />
        <Text style={pdfStyles.documentTitle}>{content.title}</Text>

        <View style={pdfStyles.orgBlock} wrap={false}>
          <Text style={pdfStyles.bodyBold}>{content.organisationName}</Text>
          {content.organisationAddressLines.map((line, index) => (
            <Text key={index} style={pdfStyles.body}>
              {line}
            </Text>
          ))}
        </View>

        <View style={pdfStyles.block} wrap={false}>
          <Text style={pdfStyles.blockLabel}>RÉFÉRENCE</Text>
          <Text style={pdfStyles.body}>Référence de commande : {content.orderReference}</Text>
          <Text style={pdfStyles.body}>Date : {content.orderDate}</Text>
        </View>

        <View style={pdfStyles.block} wrap={false}>
          <Text style={pdfStyles.blockLabel}>CLIENT</Text>
          <Text style={pdfStyles.bodyBold}>{content.customerName}</Text>
          <Text style={pdfStyles.body}>{content.customerAddress}</Text>
          <Text style={pdfStyles.body}>
            {content.customerPostalCode} {content.customerCity}
          </Text>
        </View>

        <View style={pdfStyles.block}>
          <Text style={pdfStyles.blockLabel}>ARTICLES</Text>
          <View style={pdfStyles.priceTableHeaderRow}>
            <Text style={pdfStyles.priceTableHeaderCellArticle}>Article</Text>
            <Text style={pdfStyles.priceTableHeaderCellQty}>Quantité</Text>
            <Text style={pdfStyles.priceTableHeaderCellPrice}>Prix unitaire</Text>
            <Text style={pdfStyles.priceTableHeaderCellPrice}>Total</Text>
          </View>
          {content.items.map((item, index) => (
            <View key={index} style={pdfStyles.priceTableRow} wrap={false}>
              <View style={pdfStyles.priceTableCellArticle}>
                <Text style={pdfStyles.body}>{item.name}</Text>
                {item.composition.map((component, componentIndex) => (
                  <Text key={componentIndex} style={pdfStyles.compositionLine}>
                    {component.quantityPerBundle} × {component.name}
                  </Text>
                ))}
              </View>
              <Text style={pdfStyles.priceTableCellQty}>{item.quantity}</Text>
              <Text style={pdfStyles.priceTableCellPrice}>{item.unitPriceFormatted}</Text>
              <Text style={pdfStyles.priceTableCellPrice}>{item.lineTotalFormatted}</Text>
            </View>
          ))}
          <View style={pdfStyles.totalRow} wrap={false}>
            <Text style={pdfStyles.totalLabel}>Total</Text>
            <Text style={pdfStyles.totalAmount}>{content.totalAmountFormatted}</Text>
          </View>
        </View>

        <View style={pdfStyles.block} wrap={false}>
          <Text style={pdfStyles.blockLabel}>PAIEMENT</Text>
          <Text style={pdfStyles.body}>{content.paymentMethodLabel || "—"}</Text>
          {content.paymentStatusLine ? (
            <Text style={pdfStyles.bodyBold}>{content.paymentStatusLine}</Text>
          ) : null}
        </View>

        <PageFooter />
      </Page>
    </Document>
  );
}

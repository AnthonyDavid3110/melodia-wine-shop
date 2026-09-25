import { renderToBuffer } from "@react-pdf/renderer";
import type { PreparationSheetContent } from "@/domain/documents/build-preparation-sheet-content";
import type { SellerPreparationSummaryContent } from "@/domain/documents/build-seller-preparation-summary-content";
import type { OrderDocumentContent } from "@/domain/documents/build-order-document-content";
import {
  IndividualPreparationDocument,
  SellerPreparationDocument,
} from "./preparation-sheet-document";
import { OrderDocument } from "./order-document";

/**
 * Phase 12 Gate 12B — the only module outside
 * `preparation-sheet-document.tsx` that imports `@react-pdf/renderer`.
 * Route Handlers call these two functions and never touch the PDF
 * library or its JSX components directly, so a future library swap
 * only touches this file and `preparation-sheet-document.tsx`, never
 * the domain content builders or the routes themselves.
 *
 * `renderToBuffer` (buffered, not streamed) is the right choice at
 * ECM's scale (§16 of the approved Step 1/Step 2 plan) — no seller is
 * expected to have enough orders to make buffering a real memory
 * concern, and buffering keeps the Route Handler trivially simple.
 */
export async function renderPreparationSheetPdf(
  content: PreparationSheetContent,
  campaignName: string,
): Promise<Buffer> {
  return renderToBuffer(
    <IndividualPreparationDocument content={content} campaignName={campaignName} />,
  );
}

export async function renderSellerPreparationSummaryPdf(
  content: SellerPreparationSummaryContent,
): Promise<Buffer> {
  return renderToBuffer(<SellerPreparationDocument content={content} />);
}

/**
 * Phase 12 Gate 12C — used by BOTH the order-confirmation and receipt
 * Route Handlers; which variant it renders is entirely decided by the
 * `OrderDocumentContent` it receives (`build-order-document-content.ts`),
 * never by this function or `OrderDocument` itself.
 */
export async function renderOrderDocumentPdf(content: OrderDocumentContent): Promise<Buffer> {
  return renderToBuffer(<OrderDocument content={content} />);
}

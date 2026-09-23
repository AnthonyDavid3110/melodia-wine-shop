/**
 * Minimal HTML-escaping for interpolating text into a raw HTML string
 * built without a template/rendering framework (Phase 11 Gate 11A —
 * no React Email/MJML, docs/10-IMPLEMENTATION-PLAN.md §4). Applies
 * docs/09-SECURITY.md §13's "customer-provided text is never trusted
 * HTML" principle to email HTML specifically: order-confirmation-
 * content.ts escapes every dynamic value (customer name, address,
 * delivery note, item names) through this function before it reaches
 * the HTML output, never through `dangerouslySetInnerHTML` or
 * unescaped string interpolation.
 *
 * Escapes the five characters that matter for breaking out of HTML
 * text content or a double-quoted attribute. This module never builds
 * an HTML attribute from untrusted input, so that coverage is
 * sufficient — it is not a general-purpose sanitizer.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

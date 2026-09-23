import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escape-html";

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("Bonjour & bienvenue")).toBe("Bonjour &amp; bienvenue");
  });

  it("escapes angle brackets so tags cannot be injected", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("escapes double and single quotes", () => {
    expect(escapeHtml(`He said "hi" and 'bye'`)).toBe("He said &quot;hi&quot; and &#39;bye&#39;");
  });

  it("leaves plain text with French accents unchanged", () => {
    expect(escapeHtml("Merci pour votre commande, à bientôt !")).toBe(
      "Merci pour votre commande, à bientôt !",
    );
  });

  it("treats input as raw text, escaping a literal ampersand even inside what looks like an entity", () => {
    // The function has no entity awareness — it escapes every literal
    // "&" in the raw input exactly once, left to right. Callers must
    // never pre-escape their input before calling this.
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });

  it("returns an empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });
});

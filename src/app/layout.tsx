import type { Metadata } from "next";
import { fraunces, ibmPlexSans } from "@/lib/fonts";
import { CartProvider } from "@/components/cart/cart-context";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Les vins de Mélodia",
    template: "%s — Les vins de Mélodia",
  },
  description: "Vente de vins au profit de l'Ensemble de Cuivres Mélodia.",
  openGraph: {
    siteName: "Les vins de Mélodia",
    locale: "fr_CH",
    type: "website",
  },
};

/**
 * `CartProvider` lives here (Phase 6) so `/` and `/panier` share one
 * cart state — it owns localStorage hydration/persistence only, and
 * deliberately does not query the database or know the current
 * campaign (see `cart-context.tsx`'s own doc comment and
 * `CartCampaignSync` for why that split is deliberate). Wrapping
 * `/admin/**` too is harmless — the admin tree never calls `useCart()`.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className={`${fraunces.variable} ${ibmPlexSans.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}

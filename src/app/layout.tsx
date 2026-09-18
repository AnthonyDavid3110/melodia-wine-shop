import type { Metadata } from "next";
import { fraunces, ibmPlexSans } from "@/lib/fonts";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className={`${fraunces.variable} ${ibmPlexSans.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}

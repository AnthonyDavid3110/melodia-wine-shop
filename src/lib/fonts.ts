import { Fraunces, IBM_Plex_Sans } from "next/font/google";

/**
 * Production typography foundation — approved direction (Programme V2):
 * Fraunces for display/editorial roles, IBM Plex Sans for interface roles.
 * Exposed as CSS variables and wired to the `font-display` / `font-sans`
 * theme tokens in globals.css.
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display-raw",
  display: "swap",
});

export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-interface-raw",
  display: "swap",
});

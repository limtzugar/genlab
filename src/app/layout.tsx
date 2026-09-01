import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Bricolage_Grotesque,
  JetBrains_Mono,
  Instrument_Serif,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/lab/theme-provider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* ---- 2026 typography upgrade (splash page only) ----
 * Bricolage Grotesque — defining display face of 2024-2026 (Mathieu Triay).
 *   Loaded as a VARIABLE font (no `weight` array) so the `opsz` optical-size
 *   axis is available. At the giant wordmark size (clamp up to 12rem) we set
 *   `opsz: 96` which engages the inktrap styling — sharp corners, stronger
 *   contrast, more architectural stance.
 * JetBrains Mono — standard for technical / AI tooling UI (Cursor, GitHub
 *   Copilot). Distinctive `g`/`a`/`0` for the splash tagline + labels.
 * Instrument Serif — italic accent face. Used to italicize the word
 *   "invention" in the tagline, giving it editorial warmth against the
 *   otherwise technical mono/sans pairing.
 * Body text on splash + all of /lab keeps using Geist Sans/Mono so the
 * interior of the app stays visually consistent.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Enter — Gene-Driven Invention & Patent Pipeline",
  description:
    "Enter odkrywa DNA nowych wynalazków i patentów. Repo-first: szuka konkretnych rozwiązań open-source na GitHub, łączy je jak geny w nowe wynalazki, teoria jest jedną z warstw krytycznych pipeline.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${jetbrains.variable} ${instrumentSerif.variable} antialiased`}
      >
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" theme="system" />
        </ThemeProvider>
      </body>
    </html>
  );
}

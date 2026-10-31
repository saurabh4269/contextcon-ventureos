import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "./globals.css";
import { Providers } from "@port/components/providers";
import { DataModeProvider } from "@/components/datamode";
import { resolveDataMode } from "@/lib/datamode";

// Read DEALDESK_DATA_MODE per request (no rebuild needed to switch modes).
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Deal Desk — mockups" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body><DataModeProvider mode={resolveDataMode()}><Providers>{children}</Providers></DataModeProvider></body>
    </html>
  );
}

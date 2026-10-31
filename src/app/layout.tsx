import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "./globals.css";
import { Providers } from "@port/components/providers";
import { MemoryDock } from "@/live/memory";
import { FloatingVoice } from "@/live/voice/FloatingVoice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deal Desk",
  description: "An agentic desk for VCs, built on live Crustdata signals. Every number cites its source.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f8f8f7" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body><Providers>{children}</Providers><MemoryDock /><FloatingVoice /></body>
    </html>
  );
}

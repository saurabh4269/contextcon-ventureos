import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "./globals.css";
import { Providers } from "@port/components/providers";
import { MemoryDock } from "@/live/memory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Deal Desk" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body><Providers>{children}</Providers><MemoryDock /></body>
    </html>
  );
}

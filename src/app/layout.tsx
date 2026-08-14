import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { RiskBanner } from "@/components/RiskBanner";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";

export const metadata: Metadata = {
  title: "PiPulse — PIUSDT Dashboard",
  description:
    "Live PIUSDT price from multiple exchanges, automated daily market reports, and a transparent, immutable trading-signals record. Educational information — not financial advice.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  applicationName: "PiPulse",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0f14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <Nav />
          <RiskBanner />
          <main className="mx-auto max-w-5xl px-4 pt-4">{children}</main>
          <DisclaimerFooter />
        </Providers>
      </body>
    </html>
  );
}

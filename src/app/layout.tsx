import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { RiskBanner } from "@/components/RiskBanner";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Cyberekt · PIUSDT Dashboard",
  description:
    "Live PIUSDT prices reported by public exchanges, with automatic daily market summaries and a permanent report archive. Informational and educational; no forecasts, no recommendations, not financial advice.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  applicationName: "Cyberekt",
  appleWebApp: { capable: true, title: "Cyberekt", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0f14" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
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

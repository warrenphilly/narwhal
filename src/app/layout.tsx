import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { LiquidScene } from "@/components/liquid-scene";
import { Providers } from "@/components/providers";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Narwhal — Jellyfin for your laptop",
  description:
    "An Apple TV-style Jellyfin client that streams your library and downloads titles to this computer.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.toggle('dark',localStorage.getItem('cinema-theme')==='dark')`,
          }}
        />
      </head>
      <body className="min-h-full font-sans text-[var(--page-fg)]">
        <LiquidScene />
        <div className="relative z-10 min-h-full">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}

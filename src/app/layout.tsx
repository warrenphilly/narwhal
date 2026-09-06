import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Cinema — Jellyfin for your laptop",
  description:
    "An Apple TV-style Jellyfin client that streams your library and downloads movies to this computer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.toggle('dark',localStorage.getItem('cinema-theme')==='dark')`,
          }}
        />
      </head>
      <body className="min-h-full bg-[var(--page-bg)] font-sans text-[var(--page-fg)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

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
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f5f5f7] font-sans text-zinc-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

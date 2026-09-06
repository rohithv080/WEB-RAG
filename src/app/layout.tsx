import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Web RAG",
  description: "Scrape a page, embed chunks, chat with Groq over retrieved context",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        style={
          {
            "--font-sans": "var(--font-plex-sans), IBM Plex Sans, sans-serif",
            "--font-mono": "var(--font-plex-mono), IBM Plex Mono, monospace",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}

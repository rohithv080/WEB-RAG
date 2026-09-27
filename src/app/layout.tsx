import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

const sansFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Web RAG — Production AI Knowledge Engine",
  description:
    "Autonomous Web & Document RAG engine with hybrid search, reranking, and live embeddable widgets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${sansFont.variable} ${monoFont.variable}`}
        suppressHydrationWarning
      >
        <body
          suppressHydrationWarning
          style={
            {
              fontFamily: "var(--font-sans), -apple-system, BlinkMacSystemFont, sans-serif",
            } as React.CSSProperties
          }
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

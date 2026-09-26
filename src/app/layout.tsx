import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
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

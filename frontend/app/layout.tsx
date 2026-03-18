import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Github } from "lucide-react";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clariva AI",
  description:
    "Feed it videos, documents, or websites. Ask anything. Get answers that actually cite their source.",
  icons: {
    icon: "/clariva_logo.png",
    apple: "/clariva_logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${instrumentSerif.variable} ${inter.variable} font-body antialiased relative`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          
          <div className="fixed bottom-4 right-4 z-[99]" style={{ pointerEvents: 'auto' }}>
            <div className="flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
              <span className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">
                Made by Pritam
              </span>
              <a
                href="https://github.com/Pritam16345/Clariva-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-transform"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          <Toaster richColors position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}

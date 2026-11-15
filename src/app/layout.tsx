import type { Metadata, Viewport } from "next";
import { Anton, DM_Sans, JetBrains_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MotionProvider } from "@/components/motion/motion-provider";
import { Backdrop } from "@/components/shell/backdrop";

/** Editorial: Anton poster titles, JetBrains Mono labels, DM Sans for reading. */
const poster = Anton({ subsets: ["latin"], weight: "400", variable: "--font-poster", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });
const inter = DM_Sans({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "9raya", template: "%s · 9raya" },
  description:
    "Cours universitaires interactifs (S1) : leçons courtes, démonstrations pas à pas, quiz corrigés, séries et progression.",
  applicationName: "9raya",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efede6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" suppressHydrationWarning data-scroll-behavior="smooth" className={`${poster.variable} ${mono.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <MotionProvider>
            <Backdrop />
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster position="top-center" richColors closeButton />
            </TooltipProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

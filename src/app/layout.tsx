import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Adois",
    template: "%s · Adois",
  },
  description: "Finanças a dois, sem complicação.",
  applicationName: "Adois",
  appleWebApp: {
    capable: true,
    title: "Adois",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes sets the class on <html> before hydration
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${montserrat.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) add attributes to <body> */}
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
          <OfflineBanner />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}

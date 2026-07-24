import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Ignivox ERP — Industrial ERP & CRM",
    template: "%s | Ignivox ERP",
  },
  description:
    "Ignivox ERP is a customizable, multi-tenant ERP and CRM platform tailored for modern Indian manufacturing businesses.",
  keywords: ["ERP", "CRM", "manufacturing", "job shop", "make-to-order", "Ignivox", "SaaS"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <TooltipProvider delay={200}>
          {children}
        </TooltipProvider>
        <Toaster
          position="top-right"
          richColors
          expand={false}
          duration={4000}
        />
      </body>
    </html>
  );
}

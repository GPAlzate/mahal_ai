import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DM_Sans, DM_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { BottomTabBar } from "@/components/BottomTabBar";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { ApiClientConfigurator } from "@/components/ApiClientConfigurator";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "mahal ai ❤️",
  description: "kkb with friends",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "mahal ai",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <meta name="theme-color" content="#FFD700" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        </head>
        <body className={`${dmSans.variable} ${dmMono.variable}`}>
          <ApiClientConfigurator />
          {children}
          <BottomTabBar />
          <ServiceWorkerRegistrar />
        </body>
      </html>
    </ClerkProvider>
  );
}

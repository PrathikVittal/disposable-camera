import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/app/components/Providers";
import ServiceWorkerRegistrar from "@/app/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Digital Disposable Events",
  description: "A digital disposable camera for every event. No app, no login for guests.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Disposable",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#ffffff" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <Providers>
          <ServiceWorkerRegistrar />
          {children}
        </Providers>
      </body>
    </html>
  );
}

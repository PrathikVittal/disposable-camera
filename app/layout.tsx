import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Nunito } from "next/font/google";
import "./globals.css";
import Providers from "@/app/components/Providers";
import ServiceWorkerRegistrar from "@/app/components/ServiceWorkerRegistrar";

// Site-wide type system: Bebas Neue for headings/display/numbers/labels
// (class `font-bebas`), Nunito for everything else (the body default — see
// globals.css). Exposed as CSS variables so both are usable anywhere.
const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const nunito = Nunito({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

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
    <html lang="en" className={`${bebasNeue.variable} ${nunito.variable}`}>
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

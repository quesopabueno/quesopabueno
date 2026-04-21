import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  metadataBase: new URL("https://www.quesopabueno.com"),
  title: "Queso Pa' Bueno",
  description: "El auténtico sabor venezolano, del llano a tu mesa. Pide aquí tus quesos frescos artesanales.",
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "Queso Pa' Bueno",
    description: "El auténtico sabor venezolano, del llano a tu mesa. Pide aquí tus quesos.",
    url: "https://www.quesopabueno.com",
    siteName: "Queso Pa' Bueno",
    images: ["/logo.png"],
    locale: "es_US",
    type: "website",
  },
  verification: {
    google: "GfK7WExXzax1dO4V_fJ91XbECh1S8ayFnyZDVWB1p74",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

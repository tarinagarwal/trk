import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Patch BigInt serialization for the entire app
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import { Providers } from "./providers";
import Navbar from "../components/Navbar";

const inter = Inter({ subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "REAL CASH GAME ECOSYSTEM",
  description: "Real Cash Game Ecosystem - BSC BEP20 based dApp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}

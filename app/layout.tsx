import type { Metadata } from "next";
import { SuiProviders } from "@/lib/sui-provider";
import "./globals.css";
import "@mysten/dapp-kit/dist/index.css";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/layout/navbar";

export const metadata: Metadata = {
  title: "VeritasLog",
  description: "Truth. Verified. Transparent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <Toaster richColors position="top-center" />
        <SuiProviders>
          <main className="p-6 space-y-6">
            <Navbar />
            {children}
          </main>
        </SuiProviders>
      </body>
    </html>
  );
}

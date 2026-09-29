import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { AvisoToast } from "@/components/aviso-toast";

const poppins = Poppins({
  subsets: ["latin"],
  weight: "700",
  display: "swap",
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Rent & Trippin",
  description: "Panel de reservas de Rent & Trippin",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={cn("h-full antialiased", poppins.variable, inter.variable)}>
      <body className="min-h-full flex flex-col bg-white">
        <header className="flex w-full justify-center border-b border-gray-100 px-4 py-3">
          <div className="flex w-full max-w-5xl items-center">
            <Image
              src="/logo-rent-and-trippin.png"
              alt="Rent & Trippin"
              width={585}
              height={177}
              priority
              className="h-9 w-auto"
            />
          </div>
        </header>
        {children}
        <Toaster position="top-center" />
        <Suspense fallback={null}>
          <AvisoToast />
        </Suspense>
      </body>
    </html>
  );
}

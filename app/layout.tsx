import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rent & Trippin",
  description: "Panel de reservas de Rent & Trippin",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white">
        <header className="flex w-full justify-center border-b border-gray-100 px-4 py-3">
          <div className="flex w-full max-w-3xl items-center">
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
      </body>
    </html>
  );
}

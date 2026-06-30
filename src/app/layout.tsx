import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { InitStore } from "@/components/InitStore";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PontoObra - Apontamento de Presença",
  description: "Controle de frequência de funcionários em obras da construção civil.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground">
        <InitStore />
        <div className="flex min-h-screen w-full">
          <Sidebar />
          <div className="flex flex-col flex-1 pb-16 md:pb-0 min-w-0">
            <main className="flex-1 overflow-y-auto p-3 md:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

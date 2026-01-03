import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// IMPORTAR O PROVIDER
import { AppConfigProvider } from "@/app/contexts/AppConfigContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Emissor NFS-e",
  description: "Emissor de Nota Fiscal de Serviço Eletrônica",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {/* ENVOLVER TUDO COM O PROVIDER */}
        <AppConfigProvider>
            {children}
        </AppConfigProvider>
      </body>
    </html>
  );
}
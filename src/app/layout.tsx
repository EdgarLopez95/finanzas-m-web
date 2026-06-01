import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanzas M Web",
  description: "Finanzas personales y de hogar para Finanzas M.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

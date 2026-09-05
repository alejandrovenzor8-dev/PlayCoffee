import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlayCoffee OS",
  description:
    "Sistema operativo profesional para cafeterías con área infantil",
  applicationName: "PlayCoffee OS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PlayCoffee",
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/archivo/800-italic.css";
import "@fontsource/archivo/900-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Trustry", template: "%s - Trustry" },
  description: "Le pilotage de vos marketplaces : profit réel par canal, pays et SKU, alertes priorisées et 7 piliers.",
  applicationName: "Trustry",
  appleWebApp: { capable: true, title: "Trustry", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#111214",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

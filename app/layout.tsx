import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { BridgeProvider } from "@/components/BridgeProvider";

export const metadata: Metadata = {
  title: "VC TestBench",
  description: "Plan test flows, run them on a VersaClimber tablet, and see exactly what happened.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <BridgeProvider>
          <AppShell>{children}</AppShell>
        </BridgeProvider>
      </body>
    </html>
  );
}

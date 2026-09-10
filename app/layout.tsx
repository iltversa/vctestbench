import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VC TestBench",
  description: "Live, readable automation reporting for the VersaClimber Sandbox app.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

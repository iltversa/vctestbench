"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useBridge } from "@/components/BridgeProvider";

const NAV = [
  { href: "/", label: "Tests", active: (path: string) => path === "/" || path.startsWith("/test/") },
  { href: "/runs", label: "Runs", active: (path: string) => path.startsWith("/runs") },
];

// Where the tablet stands, in a few words. Always visible, so nobody has to
// open a screen to find out why Run is unavailable.
function DeviceStatus() {
  const { online, connected, state, running } = useBridge();

  let dot = "bg-red-600";
  let label = "Bridge not running";

  if (online && !connected) {
    dot = "bg-amber-500";
    label = "No tablet connected";
  } else if (connected && running) {
    dot = "bg-blue-600 animate-pulse";
    label = "Running a test";
  } else if (connected && !state?.sandboxForeground) {
    dot = "bg-amber-500";
    label = `${state?.model ?? "Tablet"} · Sandbox closed`;
  } else if (connected) {
    dot = "bg-emerald-600";
    label = `${state?.model ?? "Tablet"} connected`;
  }

  return (
    <Link
      href="/#device"
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
      aria-label={`Device status: ${label}`}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="max-w-[9.5rem] truncate sm:max-w-none">{label}</span>
    </Link>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6fa] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="VC TestBench home">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#a30f0f] text-sm font-bold text-white">
              VC
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[11px] font-semibold tracking-[0.12em] text-slate-600">
                VERSACLIMBER
              </span>
              <span className="block text-base font-semibold">TestBench</span>
            </span>
          </Link>

          <nav aria-label="Main" className="flex gap-1">
            {NAV.map((item) => {
              const current = item.active(pathname);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm font-semibold ${
                    current ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto">
            <DeviceStatus />
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

export type LightboxItem = {
  src: string;
  // Shown under the picture.
  title: string;
  subtitle?: string;
};

// A picture shown large, over the page. Arrow keys (or the buttons) move
// between the pictures, Escape or a click outside closes it, and focus is kept
// inside while it is open and handed back to where it came from afterwards.
export default function Lightbox({
  items,
  index,
  onChange,
  onClose,
}: {
  items: LightboxItem[];
  // null: closed.
  index: number | null;
  onChange: (index: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const open = index !== null && index >= 0 && index < items.length;

  // Keyboard: arrows and Escape, and Tab stays inside the dialog.
  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft" && index! > 0) {
        event.preventDefault();
        onChange(index! - 1);
      } else if (event.key === "ArrowRight" && index! < items.length - 1) {
        event.preventDefault();
        onChange(index! + 1);
      } else if (event.key === "Tab") {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
    // Only when it opens or closes: moving between pictures keeps the focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const item = items[index!];
  const step = "min-h-[44px] min-w-[44px] rounded-lg bg-white/10 px-3 text-lg font-semibold text-white hover:bg-white/20 disabled:opacity-30";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950/90 p-3 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`Screenshot, ${item.title}`}
        className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 pb-3 text-white">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{item.title}</p>
            {item.subtitle && <p className="truncate text-sm text-slate-300">{item.subtitle}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm text-slate-300" aria-live="polite">
              {index! + 1} / {items.length}
            </span>
            <button
              type="button"
              className={step}
              onClick={() => onChange(index! - 1)}
              disabled={index === 0}
              aria-label="Previous screenshot"
            >
              ←
            </button>
            <button
              type="button"
              className={step}
              onClick={() => onChange(index! + 1)}
              disabled={index === items.length - 1}
              aria-label="Next screenshot"
            >
              →
            </button>
            <button ref={closeButton} type="button" className={step} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.src}
            alt={`The tablet screen: ${item.title}`}
            className="max-h-full max-w-full rounded-lg border border-slate-700 bg-slate-900 object-contain"
          />
        </div>
      </div>
    </div>
  );
}

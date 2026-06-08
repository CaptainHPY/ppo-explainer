"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type DiagnosticsModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export default function DiagnosticsModal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: DiagnosticsModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open || !mounted) {
      return;
    }

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    const previousHtmlOverscroll = documentElement.style.overscrollBehavior;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";
    documentElement.style.overscrollBehavior = "contain";

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [mounted, open]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/38 p-4 backdrop-blur-md">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-base-300/70 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-base-content">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-sm text-base-content/65">{subtitle}</div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-base-300 bg-base-100 px-3 py-1 text-xs font-semibold text-base-content/70 transition hover:bg-base-200"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

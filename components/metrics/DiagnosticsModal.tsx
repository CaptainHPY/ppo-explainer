"use client";

import type { ReactNode } from "react";

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
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/20 p-4 backdrop-blur-sm">
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

        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

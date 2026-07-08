"use client";

import React from "react";
import { createPortal } from "react-dom";

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onClose?.()}
      />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white border border-border p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            className="text-sm px-3 py-1 rounded-lg hover:bg-muted"
            onClick={() => onClose?.()}
          >
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}


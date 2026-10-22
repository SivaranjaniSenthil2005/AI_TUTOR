"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  widthClass?: string;
  id?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  widthClass = "max-w-xl",
  id = "app-settings-drawer",
}: DrawerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id={id}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-[9980] bg-slate-950/70 backdrop-blur-sm flex justify-end"
    >
      {/* Click outside to close */}
      <div
        className="flex-1 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Drawer Panel (Does not alter document layout behind it) */}
      <div
        className={`w-full ${widthClass} h-full bg-[var(--bg-surface)] border-l-4 border-[var(--border-subtle)] shadow-2xl flex flex-col relative calm-fade`}
      >
        {/* Drawer Header */}
        <div className="h-18 px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between flex-shrink-0">
          <div>
            <h2 id="drawer-title" className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>

          <button
            id="close-settings-btn"
            type="button"
            onClick={(e) => {
              e.currentTarget.focus({ preventScroll: true });
              onClose();
            }}
            aria-label="Close Drawer"
            className="w-10 h-10 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] hover:border-[var(--primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer calm-fade focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Drawer Content */}
        <div className="flex-1 stable-scroll-region p-6 space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}

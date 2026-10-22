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
        className={`w-full ${widthClass} h-full bg-[#0b1120] border-l-4 border-slate-700 shadow-2xl flex flex-col relative calm-fade`}
      >
        {/* Drawer Header */}
        <div className="h-18 px-6 py-4 border-b-2 border-slate-800 bg-[#0d1527] flex items-center justify-between flex-shrink-0">
          <div>
            <h2 id="drawer-title" className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs font-semibold text-amber-300 mt-0.5">
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
            className="w-12 h-12 rounded-xl bg-[#070b14] border-2 border-slate-700 hover:border-amber-400 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center justify-center cursor-pointer calm-fade focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400"
          >
            <X className="w-6 h-6" />
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

import React from "react";
import { Link } from "react-router-dom";
import BrandMark from "@/components/layout/BrandMark";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="h-[100dvh] min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background px-4 py-2 sm:py-6 overflow-hidden select-none">
      <div className="w-full max-w-[420px] flex flex-col my-auto">
        <div className="text-center mb-3 sm:mb-6 shrink-0 flex flex-col items-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-2 hover:opacity-90 transition-opacity">
            <BrandMark className="h-10 w-10 sm:h-11 sm:w-11" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-xs sm:text-sm mt-1 sm:mt-1.5">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl sm:rounded-3xl shadow-sm border border-border p-4 sm:p-7 md:p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-xs sm:text-sm text-muted-foreground mt-2.5 sm:mt-5">{footer}</p>
        )}
      </div>
    </div>
  );
}

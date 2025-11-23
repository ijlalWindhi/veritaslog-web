"use client";

import { useState } from "react";
import { Shield, Menu, X } from "lucide-react";

import ConnectWalletButton from "./connect-wallet";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useUserStore } from "@/stores/use-user";

function Navbar() {
  const { role } = useUserStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 border-b border-border/50 bg-card/50 backdrop-blur-sm">
      <div
        className="
          mx-auto flex max-w-7xl flex-col gap-3
          px-4 py-3
          sm:flex-row sm:items-center sm:justify-between
          md:px-6 md:py-4
        "
      >
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-2">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-foreground sm:text-lg">
              VeritasLog
            </h1>
            <p className="text-xs text-muted-foreground">
              Selective Disclosure. Truth. Verified. Transparent.
            </p>
          </div>
        </div>

        {/* Right: Role + Actions */}
        <div className="flex items-center justify-between gap-3 sm:gap-4 md:gap-6">
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground sm:text-xs">Role</p>
            <p className="text-sm font-semibold text-primary">
              {role?.replace("_", " ") || "AUDITOR"}
            </p>
          </div>

          {/* Desktop / Tablet actions */}
          <div className="hidden items-center gap-3 sm:flex sm:gap-4 md:gap-6">
            <AnimatedThemeToggler />
            <ConnectWalletButton />
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="
              inline-flex items-center justify-center
              rounded-md border border-border/60 bg-background/60
              p-2 text-sm text-foreground
              sm:hidden
            "
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu content */}
      {isMobileMenuOpen && (
        <div className="border-t border-border/50 bg-card/95 backdrop-blur-sm sm:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3">
            <div>
              <p className="text-[11px] text-muted-foreground">Theme</p>
              <div className="mt-1">
                <AnimatedThemeToggler />
              </div>
            </div>

            <div>
              <p className="text-[11px] text-muted-foreground">
                Wallet Connection
              </p>
              <div className="mt-1">
                <ConnectWalletButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;

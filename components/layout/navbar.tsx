"use client";
import { Shield } from "lucide-react";

import ConnectWalletButton from "./connect-wallet";
import { useUserStore } from "@/stores/use-user";

function Navbar() {
  const { role } = useUserStore();

  return (
    // <div className="flex justify-between items-center">
    //   <div>
    //     <h1 className="text-2xl font-bold">VeritasLog Dashboard</h1>
    //     <p className="text-muted-foreground">Truth. Verified. Transparent.</p>
    //   </div>
    //   <ConnectWalletButton />
    // </div>
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">VeritasLog</h1>
            <p className="text-xs text-muted-foreground">
              Selective Disclosure. Truth. Verified. Transparent.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="text-sm font-semibold text-primary">
              {role?.replace("_", " ") || "AUDITOR"}
            </p>
          </div>
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}

export default Navbar;

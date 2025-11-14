"use client";
import { AlertCircle, ArrowRight } from "lucide-react";

import UploadLogForm from "@/components/forms/upload-log-form";
import { useUserStore } from "@/stores/use-user";

export default function UploadPage() {
  const { role } = useUserStore();

  return (
    <main className="h-full bg-background max-w-6xl mx-auto px-6 py-2 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {[
          { label: "Describe", icon: "📋" },
          { label: "Encrypt", icon: "🔐" },
          { label: "Walrus", icon: "💾" },
          { label: "Sui", icon: "⛓️" },
          { label: "Verify", icon: "✓" },
        ].map((step, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-lg bg-card/50 border border-border/50 text-center text-sm">
              <div className="text-lg mb-1">{step.icon}</div>
              <div className="text-xs font-medium text-foreground">
                {step.label}
              </div>
            </div>
            {idx < 4 && (
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
      </div>

      {role === "ADMIN" || role === "SUPER_ADMIN" ? (
        <UploadLogForm />
      ) : (
        <div className="mt-4 flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">
            You don&apos;t have permission to upload logs. Only Admins and Super
            Admins can create new compliance logs. Contact your administrator to
            request a role upgrade.
          </p>
        </div>
      )}
    </main>
  );
}

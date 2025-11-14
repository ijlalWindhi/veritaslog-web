"use client";

import UploadLogForm from "@/components/forms/upload-log-form";
import { useUserStore } from "@/stores/use-user";

export default function UploadPage() {
  const { role } = useUserStore();

  return (
    <main className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Upload Compliance Log</h1>
        <p className="text-muted-foreground">
          Upload encrypted log to Walrus and register pointer to Sui.
        </p>
      </div>

      {role === "ADMIN" || role === "SUPER_ADMIN" ? (
        <UploadLogForm />
      ) : (
        <p className="text-destructive text-sm">
          You don&apos;t have permission to upload. Ask admin to promote you.
        </p>
      )}
    </main>
  );
}

"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Transaction } from "@mysten/sui/transactions";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { toast } from "sonner";
import { Eye, Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { CustomField } from "@/components/ui/form-field";

import { PACKAGE_ID, REGISTRY_ID } from "@/lib/sui";

const schema = z.object({
  title: z.string().nonempty("Log Title is required"),
  severity: z.string().nonempty("Severity is required"),
  moduleName: z.string().nonempty("Module / Department is required"),
  narrative: z.string().nonempty("Raw Log is required"),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;
type WalrusUploadRes = { blobId: string; commitmentHex: string };

export default function UploadLogForm() {
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      severity: "",
      moduleName: "",
      narrative: "",
      notes: "",
    },
  });
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const date = new Date();
  const severityMap: Record<string, number> = {
    HIGH: 2,
    MEDIUM: 1,
    LOW: 0,
  };
  const sevToCode = (s: string) => severityMap[s] ?? 0;
  const hexToBytes = (hex: string) =>
    new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => Number.parseInt(b, 16)));

  async function uploadWalrusReturnBlob(
    values: FormValues
  ): Promise<WalrusUploadRes> {
    const fd = new FormData();
    fd.append("text", values.narrative);
    fd.append(
      "meta",
      JSON.stringify({
        title: values.title,
        severity: values.severity,
        moduleName: values.moduleName,
        notes: values.notes ?? "",
        createdAt: Math.floor(date.getTime() / 1000),
      })
    );

    const res = await fetch("/api/register-log", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || "Walrus upload failed");
    return {
      blobId: json.blobId as string,
      commitmentHex: json.commitmentHex as string,
    };
  }

  async function onSubmit(values: FormValues) {
    if (!account) {
      toast.error("You should connect your wallet first");
      return;
    }
    setIsLoading(true);

    if (!PACKAGE_ID || !REGISTRY_ID) {
      toast.error("SUI env not set");
      return;
    }

    try {
      toast.loading("Uploading to Walrus…", { id: "walrus" });
      const { blobId, commitmentHex } = await uploadWalrusReturnBlob(values);
      toast.success("Uploaded to Walrus", { id: "walrus" });

      const tx = new Transaction();
      const registryObj = tx.object(REGISTRY_ID);
      console.log("Registering log on Sui with blobId:", blobId);
      console.log("Commitment hex:", commitmentHex);

      tx.moveCall({
        target: `${PACKAGE_ID}::registry::register_log`,
        arguments: [
          registryObj,
          tx.pure.string(blobId),
          tx.pure.vector("u8", Array.from(hexToBytes(commitmentHex))),
          tx.pure.u64(BigInt(Math.floor(date.getTime() / 1000))),
          tx.pure.u8(sevToCode(values.severity)),
        ],
      });

      const res = await signAndExecute({
        transaction: tx,
        chain: "sui:testnet",
      });
      console.log(res);
      form.reset();
      toast.success("Log registered on Sui ✅");
      setIsLoading(false);
    } catch (e: unknown) {
      console.error(e);
      let message: string;
      if (e instanceof Error) {
        message = e.message;
      } else if (typeof e === "string") {
        message = e;
      } else {
        message = "Failed to register log";
      }
      toast.error(message, { id: "walrus" });
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Log Metadata
            </CardTitle>
            <CardDescription>
              This information will be indexed and searchable without revealing
              the sensitive content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <CustomField
                control={form.control}
                name="title"
                label="Log Title"
                primary
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="e.g., Security Incident - Q3 2024"
                  />
                )}
              />
              <CustomField
                control={form.control}
                name="severity"
                label="Severity"
                primary
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">LOW</SelectItem>
                      <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                      <SelectItem value="HIGH">HIGH</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <CustomField
                control={form.control}
                name="moduleName"
                label="Module / Department"
                primary
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="e.g., Security, Compliance, Operations"
                  />
                )}
              />
              <CustomField
                control={form.control}
                name="notes"
                label="Additional Notes"
                render={({ field }) => (
                  <Textarea {...field} placeholder="Any additional notes…" />
                )}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Log Content{" "}
              <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Sensitive Data
              </span>
            </CardTitle>
            <CardDescription>
              This content will be encrypted before storage. Only approved
              parties can decrypt and view.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CustomField
              control={form.control}
              name="narrative"
              label="Raw Log / Incident Description"
              primary
              render={({ field }) => (
                <Textarea
                  {...field}
                  placeholder="Paste log content or Describe the incident, findings, or details here. This will be encrypted and stored securely."
                />
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Registering Log..." : "Register & Encrypt Log"}
        </Button>
      </form>
    </Form>
  );
}

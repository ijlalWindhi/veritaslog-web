/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PACKAGE_ID, REGISTRY_ID, suiClient } from "@/lib/sui";
import {
  sealClient,
  deriveSealIdentityBytes,
  getOrCreateSessionKey,
} from "@/lib/seal";
import { Transaction } from "@mysten/sui/transactions";
import { EncryptedObject, NoAccessError } from "@mysten/seal";
import { fromHex } from "@mysten/sui/utils";
import { useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import {
  Shield,
  CheckCircle,
  XCircle,
  ArrowLeft,
  FileText,
  Upload,
  Lock,
  Unlock,
  Database,
  Zap,
  Search,
  CheckCheck,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

type LogDetail = {
  logId: string;
  walrusCid: string;
  owner: string;
  allowed: string[];
  createdAt: number;
  severityCode: number;
  metaCommitment: number[];
  pending: string[];
};

type DecryptedBundle = {
  v: number;
  meta: {
    title: string;
    severity: string;
    moduleName: string;
    notes: string;
    createdAt: number;
  };
  payload: {
    kind: "text" | "json";
    data: string;
  };
};

const SEVERITY_MAP: Record<
  number,
  { label: string; color: string; icon: string }
> = {
  0: {
    label: "LOW",
    color: "severity-badge-low",
    icon: "🟢",
  },
  1: {
    label: "MEDIUM",
    color: "severity-badge-medium",
    icon: "🟡",
  },
  2: {
    label: "HIGH",
    color: "severity-badge-high",
    icon: "🔴",
  },
};

export default function LogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const account = useCurrentAccount();
  const signPersonalMessage = useSignPersonalMessage();
  const logId = params.id as string;

  const [log, setLog] = useState<LogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [decryptedData, setDecryptedData] = useState<DecryptedBundle | null>(
    null
  );
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const [verificationMode, setVerificationMode] = useState<
    "auto" | "upload" | null
  >(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchLogDetail();
  }, [logId]);

  useEffect(() => {
    if (log && account) {
      setHasAccess(log?.allowed?.includes(account.address));
    }
  }, [log, account]);

  async function fetchLogDetail() {
    try {
      setLoading(true);
      setError(null);

      const packageId = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID;
      const registryId = process.env.NEXT_PUBLIC_SUI_REGISTRY_ID;

      if (!packageId || !registryId) {
        throw new Error("Missing env variables");
      }

      // Fetch registry object
      const registryObj = await suiClient.getObject({
        id: registryId,
        options: { showContent: true },
      });

      if (
        !registryObj.data?.content ||
        registryObj.data.content.dataType !== "moveObject"
      ) {
        throw new Error("Invalid registry object");
      }

      const fields = registryObj.data.content.fields as any;
      const logsTableId = fields.logs.fields.id.id;

      // Fetch specific log from table
      const logData = await suiClient.getDynamicFieldObject({
        parentId: logsTableId,
        name: {
          type: "u64",
          value: logId,
        },
      });

      if (
        !logData.data?.content ||
        logData.data.content.dataType !== "moveObject"
      ) {
        throw new Error("Log not found");
      }
      const logFields = logData.data.content.fields as any;
      const logValue = logFields.value.fields;

      console.log("Raw log data from chain:", logValue); // Debug log

      setLog({
        logId,
        walrusCid: logValue.walrus_cid,
        owner: logValue.owner,
        allowed: logValue.allowed,
        createdAt: Number(logValue.created_at),
        severityCode: Number(logValue.severity_code),
        metaCommitment: logValue.meta_commitment,
        pending: logValue.pending,
      });
    } catch (err) {
      console.error("Failed to fetch log:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch log");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecrypt() {
    if (!log || !hasAccess) {
      toast.error("You don't have access to this log");
      return;
    }

    if (!account?.address) {
      toast.error("Connect wallet first");
      return;
    }

    try {
      setIsDecrypting(true);
      toast.loading("Decrypting log...", { id: "decrypt" });

      console.log("Walrus CID:", log.walrusCid);

      if (
        !log.walrusCid ||
        log.walrusCid === "undefined" ||
        log.walrusCid.trim() === ""
      ) {
        throw new Error("Invalid Walrus CID: blob ID is empty or undefined");
      }

      // 1. Download encrypted blob from Walrus via API route
      const response = await fetch(
        `/api/download-log?blobId=${encodeURIComponent(log.walrusCid)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to download from Walrus: ${response.status}`
        );
      }

      const encryptedBytes = new Uint8Array(await response.arrayBuffer());

      // 2. Parse encrypted object untuk ambil Seal ID (supaya pasti sama dengan waktu encrypt)
      const encryptedObject = EncryptedObject.parse(encryptedBytes);
      console.log("Seal meta:", {
        id: encryptedObject.id,
        threshold: encryptedObject.threshold,
        services: encryptedObject.services,
      });
      const sealIdHex = encryptedObject.id; // hex string tanpa "0x"

      // 3. Build tx yang memanggil veritaslog::registry::seal_approve
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::registry::seal_approve`,
        arguments: [
          tx.pure.vector("u8", fromHex(sealIdHex)), // id: vector<u8>
          tx.object(REGISTRY_ID), // &VeritasLogRegistry
          tx.pure.u64(BigInt(log.logId)), // log_id
        ],
      });

      const txBytes = await tx.build({
        client: suiClient,
        onlyTransactionKind: true,
      });

      // 4. Ambil / buat SessionKey untuk package ini
      const sessionKey = await getOrCreateSessionKey(
        account.address,
        async ({ message }) => {
          // pakai hook useSignPersonalMessage dari dapp-kit
          const result = await signPersonalMessage.mutateAsync({ message });
          return { signature: result.signature };
        }
      );

      // 5. Decrypt via Seal sesuai dokumentasi resmi
      const decryptedBytes = await sealClient.decrypt({
        data: encryptedBytes,
        sessionKey,
        txBytes,
      });

      // 6. Parse hasil dekripsi (bundle JSON)
      const decryptedText = new TextDecoder().decode(decryptedBytes);
      const bundle: DecryptedBundle = JSON.parse(decryptedText);

      setDecryptedData(bundle);
      toast.success("Log decrypted successfully", { id: "decrypt" });
    } catch (err) {
      console.error("Decryption failed:", err);

      if (err instanceof NoAccessError) {
        toast.error("You are not allowed to decrypt this log", {
          id: "decrypt",
        });
      } else {
        toast.error(err instanceof Error ? err.message : "Decryption failed", {
          id: "decrypt",
        });
      }
    } finally {
      setIsDecrypting(false);
    }
  }

  async function handleAutoVerification() {
    if (!log) return;

    try {
      setIsVerifying(true);
      setVerificationMode("auto");
      setVerificationResult(null);
      toast.loading("Verifying integrity...", { id: "verify" });

      // Debug: Check walrusCid value
      console.log("Walrus CID for verification:", log.walrusCid);

      if (
        !log.walrusCid ||
        log.walrusCid === "undefined" ||
        log.walrusCid.trim() === ""
      ) {
        throw new Error("Invalid Walrus CID: blob ID is empty or undefined");
      }

      if (!account?.address) {
        throw new Error("Connect wallet first");
      }

      // 1. Download encrypted blob from Walrus via API route (sama seperti handleDecrypt)
      const response = await fetch(
        `/api/download-log?blobId=${encodeURIComponent(log.walrusCid)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to download from Walrus: ${response.status}`
        );
      }

      const encryptedBytes = new Uint8Array(await response.arrayBuffer());

      // 2. Parse encrypted object untuk ambil Seal ID (sama dengan handleDecrypt)
      const encryptedObject = EncryptedObject.parse(encryptedBytes);
      console.log("Seal meta (verify):", {
        id: encryptedObject.id,
        threshold: encryptedObject.threshold,
        services: encryptedObject.services,
      });
      const sealIdHex = encryptedObject.id;

      // 3. Build tx yang memanggil veritaslog::registry::seal_approve
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::registry::seal_approve`,
        arguments: [
          tx.pure.vector("u8", fromHex(sealIdHex)), // id: vector<u8>
          tx.object(REGISTRY_ID), // &VeritasLogRegistry
          tx.pure.u64(BigInt(log.logId)), // log_id
        ],
      });

      const txBytes = await tx.build({
        client: suiClient,
        onlyTransactionKind: true,
      });

      // 4. Ambil / buat SessionKey untuk package ini (reuse helper yang sama)
      const sessionKey = await getOrCreateSessionKey(
        account.address,
        async ({ message }) => {
          const result = await signPersonalMessage.mutateAsync({ message });
          return { signature: result.signature };
        }
      );

      // 5. Decrypt via Seal sesuai dokumentasi resmi (sama persis dengan handleDecrypt)
      const decryptedBytes = await sealClient.decrypt({
        data: encryptedBytes,
        sessionKey,
        txBytes,
      });

      // 6. Re-calculate commitment (logika lama dipertahankan)
      const recalculatedCommitment = await deriveSealIdentityBytes(
        decryptedBytes
      );
      const recalculatedHex = Buffer.from(recalculatedCommitment).toString(
        "hex"
      );
      const onChainHex = Buffer.from(log.metaCommitment).toString("hex");

      // 7. Compare
      const isValid = recalculatedHex === onChainHex;

      setVerificationResult({
        success: isValid,
        message: isValid
          ? "✅ Integrity verified! Log has not been modified since registration."
          : "❌ TAMPERING DETECTED! Log has been modified.",
        details: isValid
          ? `Commitment matches: ${recalculatedHex.slice(0, 16)}...`
          : `Expected: ${onChainHex.slice(
              0,
              16
            )}...\nGot: ${recalculatedHex.slice(0, 16)}...`,
      });

      toast.success(isValid ? "Integrity verified" : "Tampering detected", {
        id: "verify",
      });
    } catch (err) {
      console.error("Verification failed:", err);
      toast.error(err instanceof Error ? err.message : "Verification failed", {
        id: "verify",
      });
      setVerificationResult({
        success: false,
        message: "Verification failed",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleUploadVerification() {
    if (!uploadedFile || !log) return;

    try {
      setIsVerifying(true);
      setVerificationMode("upload");
      setVerificationResult(null);
      toast.loading("Comparing uploaded file...", { id: "verify-upload" });

      // 1. Read uploaded file
      const uploadedText = await uploadedFile.text();

      // 2. Normalize (same as during upload)
      const trimmed = uploadedText.replaceAll("\r\n", "\n").trim();
      let normalized = trimmed;
      let kind: "text" | "json" = "text";

      try {
        const parsed = JSON.parse(trimmed);
        normalized = JSON.stringify(
          parsed,
          Object.keys(parsed).sort((a, b) => a.localeCompare(b))
        );
        kind = "json";
      } catch {
        // Not JSON, use as text
      }

      // 3. We need metadata to reconstruct bundle
      // First, try to decrypt the actual log to get metadata
      if (!decryptedData) {
        toast.error("Please decrypt the log first to get metadata", {
          id: "verify-upload",
        });
        setIsVerifying(false);
        return;
      }

      // 4. Reconstruct bundle with uploaded data
      const reconstructedBundle = {
        v: 1,
        meta: decryptedData.meta,
        payload: { kind, data: normalized },
      };

      const bundleBytes = new TextEncoder().encode(
        JSON.stringify(reconstructedBundle)
      );

      // 5. Calculate commitment
      const calculatedCommitment = await deriveSealIdentityBytes(bundleBytes);
      const calculatedHex = Buffer.from(calculatedCommitment).toString("hex");
      const onChainHex = Buffer.from(log.metaCommitment).toString("hex");

      // 6. Compare
      const isMatch = calculatedHex === onChainHex;

      setVerificationResult({
        success: isMatch,
        message: isMatch
          ? "✅ File matches! This is the original log content."
          : "❌ File doesn't match. The uploaded content differs from registered log.",
        details: isMatch
          ? `Commitment: ${calculatedHex.slice(0, 16)}...`
          : `Expected: ${onChainHex.slice(
              0,
              16
            )}...\nGot: ${calculatedHex.slice(0, 16)}...`,
      });

      toast.success(isMatch ? "File matches" : "File doesn't match", {
        id: "verify-upload",
      });
    } catch (err) {
      console.error("Upload verification failed:", err);
      toast.error(err instanceof Error ? err.message : "Verification failed", {
        id: "verify-upload",
      });
      setVerificationResult({
        success: false,
        message: "Verification failed",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <span className="ml-4 text-muted-foreground">
              Loading log details...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !log) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => router.push("/logs")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Logs
          </button>
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6">
            <h3 className="text-destructive font-semibold mb-2">
              Error Loading Log
            </h3>
            <p className="text-destructive/80">{error || "Log not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const severity = SEVERITY_MAP[log.severityCode];
  const date = new Date(log.createdAt * 1000);
  console.log("log metaCommitment:", log);
  const commitmentHex = Buffer.from(log.metaCommitment).toString("hex");

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push("/logs")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Logs
        </button>

        <div className="mb-8">
          <div className="bg-card border border-border/50 rounded-lg p-8 backdrop-blur">
            <div className="flex items-start justify-between gap-6 mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-3xl font-bold text-foreground">
                    Log #{log.logId}
                  </span>
                  <span className={`badge-protocol ${severity?.color}`}>
                    {severity?.icon} {severity?.label}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Created {date.toLocaleString()}
                </p>
              </div>
              <Shield className="w-16 h-16 text-primary/40 flex-shrink-0" />
            </div>

            <div className="flex flex-wrap gap-2 pt-6 border-t border-border/30">
              <div className="badge-protocol badge-privacy">
                <Database className="w-3 h-3" /> Walrus Storage
              </div>
              <div className="badge-protocol badge-verify">
                <Zap className="w-3 h-3" /> On-Chain Sui
              </div>
              <div className="badge-protocol badge-compliance">
                <CheckCheck className="w-3 h-3" /> Seal Verification
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Overview & Storage Details */}
          <div className="lg:col-span-1 space-y-6">
            {/* Log Overview Card */}
            <div className="bg-card border border-border/50 rounded-lg p-6 backdrop-blur">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Overview
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Owner
                  </p>
                  <p className="font-mono text-sm text-foreground break-all">
                    {log.owner}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Module
                  </p>
                  <p className="text-sm text-foreground font-medium">
                    {decryptedData?.meta.moduleName || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <p className="text-sm font-medium">
                    {hasAccess ? "✅ Accessible" : "🔒 Restricted"}
                  </p>
                </div>
              </div>
            </div>

            {/* Storage & Verification Card */}
            <div className="bg-card border border-border/50 rounded-lg p-6 backdrop-blur">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Storage Details
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Walrus CID
                  </p>
                  <p className="font-mono text-xs text-foreground break-all bg-muted/50 p-2 rounded border border-border/30">
                    {log.walrusCid}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Seal Commitment
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs text-foreground bg-muted/50 p-2 rounded border border-border/30 flex-1 break-all">
                      {commitmentHex.slice(0, 24)}...
                    </p>
                    <button className="p-2 hover:bg-muted rounded transition-colors">
                      <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border/50 rounded-lg p-6 backdrop-blur">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                {hasAccess ? (
                  <Unlock className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5 text-destructive" />
                )}
                Access Control
              </h3>

              {account ? (
                <div className="space-y-4">
                  {hasAccess ? (
                    <div className="bg-accent/10 border border-accent/30 rounded-lg p-3">
                      <p className="text-sm font-medium">✅ You have access</p>
                      <p className="text-xs mt-1">
                        You can decrypt and view sensitive content
                      </p>
                    </div>
                  ) : (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                      <p className="text-destructive text-sm font-medium">
                        🔒 Access restricted
                      </p>
                      <p className="text-destructive/70 text-xs mt-1">
                        Request access to view decrypted content
                      </p>
                      <button className="mt-3 w-full px-3 py-2 bg-destructive/20 hover:bg-destructive/30 text-destructive rounded text-sm font-medium transition-colors">
                        Request Access
                      </button>
                    </div>
                  )}

                  {log?.allowed && log.allowed.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Allowed Addresses ({log.allowed.length})
                      </p>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {log.allowed.map((addr, idx) => (
                          <p
                            key={idx}
                            className="font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded border border-border/30"
                          >
                            {addr}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-muted/50 border border-border/30 rounded-lg p-3">
                  <p className="text-muted-foreground text-sm">
                    Connect your wallet to check permissions
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Content & Verification */}
          <div className="lg:col-span-2 space-y-6">
            {hasAccess && (
              <div className="bg-card border border-border/50 rounded-lg p-6 backdrop-blur">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Log Content
                </h3>

                {!decryptedData ? (
                  <div className="text-center py-12">
                    <Lock className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Content is encrypted and requires decryption
                    </p>
                    <button
                      onClick={handleDecrypt}
                      disabled={isDecrypting}
                      className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDecrypting ? "Decrypting..." : "🔓 Decrypt Log"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Title
                        </p>
                        <p className="font-semibold text-foreground">
                          {decryptedData.meta.title}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Module / System
                        </p>
                        <p className="font-semibold text-foreground">
                          {decryptedData.meta.moduleName}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Sensitive Data
                      </p>
                      <div className="bg-muted/50 rounded-lg p-4 border border-border/30">
                        <pre className="text-sm text-foreground whitespace-pre-wrap font-mono overflow-x-auto">
                          {decryptedData.payload.data}
                        </pre>
                      </div>
                    </div>

                    {decryptedData.meta.notes && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                          Notes
                        </p>
                        <p className="text-foreground/90 text-sm">
                          {decryptedData.meta.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bg-card border border-border/50 rounded-lg p-6 backdrop-blur">
              <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                Integrity Verification
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                Cryptographically verify this log hasn&apos;t been tampered with
                since registration
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Auto Verification */}
                <div className="border border-border/50 rounded-lg p-4 hover:border-primary/50 transition-colors bg-muted/30">
                  <h4 className="font-semibold text-foreground mb-2 text-sm">
                    Automatic Verification
                  </h4>
                  <p className="text-muted-foreground text-xs mb-4">
                    System downloads and verifies the log automatically
                  </p>
                  <button
                    onClick={handleAutoVerification}
                    disabled={isVerifying || !hasAccess}
                    className="w-full px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isVerifying && verificationMode === "auto"
                      ? "Verifying..."
                      : "🔍 Auto Verify"}
                  </button>
                  {!hasAccess && (
                    <p className="text-xs text-destructive/80 mt-2">
                      Requires access permission
                    </p>
                  )}
                </div>

                {/* Upload Verification */}
                <div className="border border-border/50 rounded-lg p-4 hover:border-primary/50 transition-colors bg-muted/30">
                  <h4 className="font-semibold text-foreground mb-2 text-sm">
                    Upload & Compare
                  </h4>
                  <p className="text-muted-foreground text-xs mb-4">
                    Upload a file to verify it matches the registered log
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded cursor-pointer text-sm transition-colors">
                      <Upload className="w-4 h-4" />
                      <span className="truncate">
                        {uploadedFile ? uploadedFile.name : "Choose file..."}
                      </span>
                      <input
                        type="file"
                        onChange={(e) =>
                          setUploadedFile(e.target.files?.[0] || null)
                        }
                        className="hidden"
                        accept=".txt,.json,.log"
                      />
                    </label>
                    <button
                      onClick={handleUploadVerification}
                      disabled={!uploadedFile || isVerifying || !decryptedData}
                      className="w-full px-3 py-2 bg-accent hover:bg-accent/90 text-accent-foreground rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVerifying && verificationMode === "upload"
                        ? "Comparing..."
                        : "📤 Compare File"}
                    </button>
                    {!decryptedData && uploadedFile && (
                      <p className="text-xs text-destructive/80">
                        Decrypt log first to get metadata
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {verificationResult && (
                <div
                  className={`rounded-lg p-6 border-2 ${
                    verificationResult.success
                      ? "bg-accent/10 border-accent/30"
                      : "bg-destructive/10 border-destructive/30"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {verificationResult.success ? (
                      <CheckCircle className="w-6 h-6 mt-1" />
                    ) : (
                      <XCircle className="w-6 h-6 text-destructive mt-1" />
                    )}
                    <div className="flex-1">
                      <h4
                        className={`font-semibold mb-2 ${
                          verificationResult.success ? "" : "text-destructive"
                        }`}
                      >
                        {verificationResult.message}
                      </h4>
                      {verificationResult.details && (
                        <pre className="text-xs font-mono bg-muted/50 p-3 rounded border border-border/30 overflow-x-auto">
                          {verificationResult.details}
                        </pre>
                      )}
                      <p className="text-xs text-muted-foreground mt-3">
                        Method:{" "}
                        {verificationMode === "auto"
                          ? "Automatic Seal verification"
                          : "File upload comparison"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { NextResponse } from "next/server";
import { WalrusClient } from "@mysten/walrus";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromB64 } from "@mysten/bcs";

import { sealClient, deriveSealIdentityBytes, threshold } from "@/lib/seal";
import { suiClient, PACKAGE_ID } from "@/lib/sui";

const walrusClient = new WalrusClient({
  network: "testnet",
  suiClient,
  storageNodeClientOptions: {
    timeout: 120000, // 120 seconds
  },
});

export const runtime = "nodejs";
export const maxDuration = 60;

async function uploadWithRetry(
  walrusClient: WalrusClient,
  blob: Uint8Array,
  options: {
    epochs: number;
    deletable: boolean;
    signer: Ed25519Keypair;
    attributes: Record<string, string>;
  },
  maxRetries = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await walrusClient.writeBlob({
        blob,
        ...options,
      });
    } catch (error: unknown) {
      const isLastRetry = i === maxRetries - 1;

      if (isLastRetry) throw error;

      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, i + 1) * 1000;
      console.log(`[Retry ${i + 1}/${maxRetries}] Waiting ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const text = (form.get("text") as string | null) ?? null;
    const metaRaw = (form.get("meta") as string | null) ?? null;
    if (!text || !metaRaw) {
      return NextResponse.json(
        { error: "NO_INPUT", message: "text and meta are required" },
        { status: 400 }
      );
    }

    // 1) Normalization (nautilus-lite)
    const trimmed = text.replaceAll("\r\n", "\n").trim();
    let kind: "json" | "text" = "text";
    let normalized = trimmed;
    try {
      const parsed = JSON.parse(trimmed);
      normalized = JSON.stringify(
        parsed,
        Object.keys(parsed).sort((a, b) => a.localeCompare(b))
      );
      kind = "json";
    } catch {}

    const meta = JSON.parse(metaRaw);
    const bundle = { v: 1, meta, payload: { kind, data: normalized } };
    const bundleBytes = new TextEncoder().encode(JSON.stringify(bundle));

    // 2) SEAL encrypt
    const identityBytes = await deriveSealIdentityBytes(bundleBytes);
    const identityHex = Buffer.from(identityBytes).toString("hex");

    const { encryptedObject: encryptedBytes } = await sealClient.encrypt({
      threshold: threshold(),
      packageId: PACKAGE_ID,
      id: identityHex,
      data: bundleBytes,
    });

    // Validation size blob
    const MAX_BLOB_SIZE = 10 * 1024 * 1024; // 10MB
    if (encryptedBytes.length > MAX_BLOB_SIZE) {
      return NextResponse.json(
        {
          error: "BLOB_TOO_LARGE",
          message: `Encrypted data exceeds ${
            MAX_BLOB_SIZE / 1024 / 1024
          }MB limit`,
          size: encryptedBytes.length,
        },
        { status: 413 }
      );
    }

    // 3) Upload ciphertext to Walrus
    const secretKey = process.env.WALRUS_SPONSOR_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        {
          error: "NO_SPONSOR_KEY",
          message: "WALRUS_SPONSOR_SECRET_KEY not configured",
        },
        { status: 500 }
      );
    }
    const keypair = Ed25519Keypair.fromSecretKey(fromB64(secretKey));
    const walrusRes = await uploadWithRetry(walrusClient, encryptedBytes, {
      epochs: 1,
      deletable: true,
      signer: keypair,
      attributes: { seal_id_hex: identityHex },
    });

    // Debug: log response structure
    console.log("[walrus/upload] walrusRes:", walrusRes);

    return NextResponse.json({
      blobId: walrusRes?.blobId,
      commitmentHex: identityHex,
      seal: {
        idHex: identityHex,
        threshold: threshold(),
        serverObjectIds: (process.env.SEAL_SERVER_IDS || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        packageId: PACKAGE_ID,
      },
      success: true,
      message: "Encrypted with Seal & uploaded to Walrus",
    });
  } catch (e: unknown) {
    console.error("[walrus/upload] error", e);

    // Log detail for debugging
    if (e instanceof Error && e.message.includes("Too many failures")) {
      console.error(
        "[walrus/upload] Walrus testnet may be experiencing issues"
      );
    }

    return NextResponse.json(
      {
        error: "UPLOAD_FAILED",
        message: e instanceof Error ? e.message : "Unknown error occurred",
        suggestion:
          e instanceof Error && e.message.includes("Too many failures")
            ? "Walrus testnet may be experiencing issues. Please try again later."
            : undefined,
      },
      {
        status:
          e instanceof Error && e.message.includes("Too many failures")
            ? 503
            : 500,
      }
    );
  }
}

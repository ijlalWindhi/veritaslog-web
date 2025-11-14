import { SealClient, SessionKey } from "@mysten/seal";
import crypto from "crypto";

import { PACKAGE_ID, suiClient } from "./sui";

export const SEAL_SERVER_IDS =
  (process.env.NEXT_PUBLIC_SEAL_SERVER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) || "";
let cachedSessionKey: SessionKey | null = null;

function getServerConfigs() {
  return SEAL_SERVER_IDS.map((id) => ({
    objectId: id, // on-chain KeyServer object id
    weight: 1,
  }));
}

export const sealClient = new SealClient({
  suiClient,
  serverConfigs: getServerConfigs(),
  verifyKeyServers: true,
});

export async function deriveSealIdentityBytes(
  bytes: Uint8Array
): Promise<Uint8Array> {
  const id = crypto.createHash("sha256").update(bytes).digest(); // 32 bytes
  return new Uint8Array(id);
}

export function threshold() {
  const t = Number(process.env.SEAL_THRESHOLD || "2");
  return Math.max(t, 1);
}

export async function getOrCreateSessionKey(
  address: string,
  signPersonalMessage: (args: {
    message: Uint8Array;
  }) => Promise<{ signature: string }>
) {
  if (cachedSessionKey && !cachedSessionKey.isExpired) return cachedSessionKey;

  // 1. Create SessionKey
  const sessionKey = await SessionKey.create({
    address,
    packageId: PACKAGE_ID,
    ttlMin: 10,
    suiClient,
  });

  // 2. Ask user to sign personal message via wallet
  const message = sessionKey.getPersonalMessage();
  const { signature } = await signPersonalMessage({ message });

  // 3. Set signature to SessionKey
  await sessionKey.setPersonalMessageSignature(signature);

  cachedSessionKey = sessionKey;
  return sessionKey;
}

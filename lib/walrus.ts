import { WalrusClient } from "@mysten/walrus";
import { suiClient } from "./sui";

export const walrusClient = new WalrusClient({
  network: "testnet",
  suiClient,
  storageNodeClientOptions: {
    timeout: 120000, // 120 seconds
  },
});

import { WalrusClient } from "@mysten/walrus";
import { suiClient } from "./sui";
import https from 'https';
import http from 'http';

const httpsAgent = new https.Agent({
  keepAlive: true,
  timeout: 10000,
  maxSockets: 10,
  rejectUnauthorized: false,
});

const httpAgent = new http.Agent({
  keepAlive: true,
  timeout: 10000,
  maxSockets: 10,
});

global.fetch = new Proxy(global.fetch, {
  apply: (target, thisArg, args) => {
    const [url, options = {}] = args;
    return target.call(thisArg, url, {
      ...options,
      signal: AbortSignal.timeout(10000),
      // @ts-ignore
      agent: url.startsWith('https:') ? httpsAgent : httpAgent,
    });
  },
});

export const walrusClient = new WalrusClient({
  network: "testnet",
  suiClient,
  storageNodeClientOptions: {
    timeout: 300000, // 5 minutes
  },
});

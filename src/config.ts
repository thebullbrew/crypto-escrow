import "dotenv/config";
import { defineChain, parseEther } from "viem";

/** Ethereum (chain id 1). */
export const chain = defineChain({
  id: 1,
  name: "Ethereum",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://eth.llamarpc.com"] } },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://etherscan.io" },
  },
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function bigIntEnv(name: string, fallback: string): bigint {
  const raw = process.env[name] ?? fallback;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be a non-negative integer, got "${raw}".`);
  }
  return BigInt(raw);
}

function addressEnv(name: string): `0x${string}` | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    throw new Error(`${name} must be a 20-byte hex address, got "${raw}".`);
  }
  return normalized as `0x${string}`;
}

function keyEnv(name: string): `0x${string}` {
  const raw = required(name);
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`${name} must be a 64-character hex private key (0x prefix optional).`);
  }
  return normalized as `0x${string}`;
}

export const config = {
  /** JSON-RPC endpoint for Ethereum. */
  rpcUrl: required("RPC_URL"),
  /** Script-runner private key (validated 32-byte hex). */
  privateKey: keyEnv("PRIVATE_KEY"),
  /** Block explorer base URL — used for links only. */
  explorerUrl: "https://etherscan.io",

  /** Escrow parties — required for deploy. */
  buyer: addressEnv("BUYER"),
  seller: addressEnv("SELLER"),
  arbiter: addressEnv("ARBITER"),
  /** Inspection window in days — required for deploy. */
  inspectionDays: bigIntEnv("INSPECTION_DAYS", "10"),
  /** Earnest money in wei (parsed from AMOUNT_ETH, denominated in ETH). */
  amountWei: parseEther(process.env.AMOUNT_ETH ?? "1.0"),

  /** Set after `npm run deploy`. */
  contractAddress: addressEnv("CONTRACT_ADDRESS"),
};

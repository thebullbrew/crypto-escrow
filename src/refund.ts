import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, config } from "./config";

// Refunds the escrowed funds to the buyer.
// Run with the BUYER's key   -> cancel() (only before the inspection deadline)
// Run with the ARBITER's key -> resolveRefund() (any time while funded)
const ARTIFACT_PATH = join(
  __dirname,
  "..",
  "artifacts",
  "contracts",
  "RealEstateEscrow.sol",
  "RealEstateEscrow.json"
);

interface ContractArtifact {
  abi: Abi;
}

async function main(): Promise<void> {
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error("Contract artifact not found — run `npx hardhat compile` first, then retry.");
  }
  if (!config.contractAddress) {
    throw new Error("CONTRACT_ADDRESS is not set — deploy first (`npm run deploy`).");
  }
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as ContractArtifact;

  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const buyer = (await publicClient.readContract({
    address: config.contractAddress,
    abi: artifact.abi,
    functionName: "buyer",
  })) as `0x${string}`;
  const arbiter = (await publicClient.readContract({
    address: config.contractAddress,
    abi: artifact.abi,
    functionName: "arbiter",
  })) as `0x${string}`;

  let functionName: "cancel" | "resolveRefund";
  if (account.address.toLowerCase() === buyer.toLowerCase()) {
    functionName = "cancel";
    console.log("Acting as buyer — calling cancel() (must be before the inspection deadline).");
  } else if (account.address.toLowerCase() === arbiter.toLowerCase()) {
    functionName = "resolveRefund";
    console.log("Acting as arbiter — calling resolveRefund().");
  } else {
    throw new Error(
      `Wallet ${account.address} is neither the buyer (${buyer}) nor the arbiter (${arbiter}).`
    );
  }

  const hash = await walletClient.writeContract({
    address: config.contractAddress,
    abi: artifact.abi,
    functionName,
  });

  console.log(`\nRefund tx: ${hash}`);
  console.log(`Explorer: ${config.explorerUrl}/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(
      "Refund transaction failed — is the escrow funded, and (for buyer-cancel) is the inspection window still open?"
    );
  }
  console.log("Funds refunded to the buyer.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, config } from "./config";

// Releases the escrowed funds to the seller.
// Run with the BUYER's key  -> approveRelease()
// Run with the ARBITER's key -> resolveRelease()
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

  let functionName: "approveRelease" | "resolveRelease";
  if (account.address.toLowerCase() === buyer.toLowerCase()) {
    functionName = "approveRelease";
    console.log("Acting as buyer — calling approveRelease().");
  } else if (account.address.toLowerCase() === arbiter.toLowerCase()) {
    functionName = "resolveRelease";
    console.log("Acting as arbiter — calling resolveRelease().");
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

  console.log(`\nRelease tx: ${hash}`);
  console.log(`Explorer: ${config.explorerUrl}/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Release transaction failed — is the escrow funded?");
  }
  console.log("Funds released to the seller.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, formatEther, http, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, config } from "./config";

// Deposits the earnest money. Run with the BUYER's private key.
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

  console.log(`Escrow:  ${config.contractAddress}`);
  console.log(`Buyer:   ${account.address}`);
  console.log(`Amount:  ${formatEther(config.amountWei)} ETH`);

  const hash = await walletClient.writeContract({
    address: config.contractAddress,
    abi: artifact.abi,
    functionName: "fund",
    value: config.amountWei,
  });

  console.log(`\nFund tx: ${hash}`);
  console.log(`Explorer: ${config.explorerUrl}/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Fund transaction failed — are you the buyer, and is the escrow awaiting funding?");
  }
  console.log("Escrow funded.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

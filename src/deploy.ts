import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, http, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, config } from "./config";

// Produced by `npx hardhat compile` — this script assumes the artifact exists.
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
  bytecode: `0x${string}`;
}

async function main(): Promise<void> {
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error("Contract artifact not found — run `npx hardhat compile` first, then retry.");
  }
  if (!config.buyer || !config.seller || !config.arbiter) {
    throw new Error("BUYER, SELLER and ARBITER must all be set in your .env before deploying.");
  }
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as ContractArtifact;

  const account = privateKeyToAccount(config.privateKey);
  const transport = http(config.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  console.log(`Network:          ${chain.name} (chain id ${chain.id})`);
  console.log(`Deployer:         ${account.address}`);
  console.log(`Buyer:            ${config.buyer}`);
  console.log(`Seller:           ${config.seller}`);
  console.log(`Arbiter:          ${config.arbiter}`);
  console.log(`Inspection days:  ${config.inspectionDays.toString()}`);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [config.buyer, config.seller, config.arbiter, config.inspectionDays],
  });

  console.log(`\nDeploy tx: ${hash}`);
  console.log(`Explorer:  ${config.explorerUrl}/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error("Deployment transaction failed — inspect it at the explorer link above.");
  }

  console.log(`\nContract deployed: ${receipt.contractAddress}`);
  console.log(`Explorer: ${config.explorerUrl}/address/${receipt.contractAddress}`);
  console.log(`\nAdd this to your .env:\nCONTRACT_ADDRESS=${receipt.contractAddress}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CONTRACT_NAME = "EncryptedLearningTracker";

// <root>/backend
const rel = "../backend";

// <root>/frontend/abi
const outdir = path.resolve("./abi");

if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir);
}

const dir = path.resolve(rel);
const dirname = path.basename(dir);

const line =
  "\n===================================================================\n";

if (!fs.existsSync(dir)) {
  console.error(
    `${line}Unable to locate ${rel}. Expecting <root>/${dirname}${line}`
  );
  process.exit(1);
}

if (!fs.existsSync(outdir)) {
  console.error(`${line}Unable to locate ${outdir}.${line}`);
  process.exit(1);
}

const deploymentsDir = path.join(dir, "deployments");

function readDeployment(chainName, chainId, contractName, optional) {
  const chainDeploymentDir = path.join(deploymentsDir, chainName);

  if (!fs.existsSync(chainDeploymentDir)) {
    console.error(
      `${line}Unable to locate '${chainDeploymentDir}' directory.\n\n1. Goto '${dirname}' directory\n2. Run 'npx hardhat deploy --network ${chainName}'.${line}`
    );
    if (!optional) {
      process.exit(1);
    }
    return undefined;
  }

  const jsonString = fs.readFileSync(
    path.join(chainDeploymentDir, `${contractName}.json`),
    "utf-8"
  );

  const obj = JSON.parse(jsonString);
  obj.chainId = chainId;

  return obj;
}

// Auto detect deployments - skip if not available
const deployLocalhost = readDeployment("localhost", 31337, CONTRACT_NAME, true /* optional */);
const deploySepolia = readDeployment("sepolia", 11155111, CONTRACT_NAME, true /* optional */);

// Collect all available deployments
const deployments = {};
if (deployLocalhost) {
  deployments["31337"] = {
    address: deployLocalhost.address,
    chainId: 31337,
    chainName: "hardhat",
    abi: deployLocalhost.abi
  };
}

if (deploySepolia) {
  deployments["11155111"] = {
    address: deploySepolia.address,
    chainId: 11155111,
    chainName: "sepolia",
    abi: deploySepolia.abi
  };
}

// Check if we have at least one deployment
if (Object.keys(deployments).length === 0) {
  console.error(
    `${line}No deployments found. Please deploy the contract first using:\n` +
    `  - npx hardhat deploy --network hardhat (for localhost)\n` +
    `  - npx hardhat deploy --network sepolia (for Sepolia)${line}`
  );
  process.exit(1);
}

// Find the primary deployment to use for ABI (prefer localhost if available, otherwise use first available)
const primaryDeployment = deployLocalhost || deploySepolia;
const primaryAbi = primaryDeployment.abi;

// Verify all deployments have the same ABI
const abisMatch = Object.values(deployments).every(
  (deploy) => JSON.stringify(deploy.abi) === JSON.stringify(primaryAbi)
);

if (!abisMatch) {
  console.error(
    `${line}Deployments have different ABIs. Please re-deploy all contracts to ensure consistency.${line}`
  );
  process.exit(1);
}

// Generate ABI file
const tsCode = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${CONTRACT_NAME}ABI = ${JSON.stringify({ abi: primaryAbi }, null, 2)} as const;
\n`;

// Generate addresses file with all available deployments
// Always include chainId 11155111 (Sepolia) mapping if deployment exists
const addressesObject = {};
Object.keys(deployments)
  .sort() // Sort to ensure consistent order
  .forEach((chainId) => {
    const deploy = deployments[chainId];
    addressesObject[chainId] = {
      address: deploy.address,
      chainId: deploy.chainId,
      chainName: deploy.chainName,
    };
  });

const tsAddresses = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
  
  Run 'npm run genabi' after deploying the contract to generate the actual addresses.
  This file automatically includes all available deployments. Missing deployments are skipped.
*/
export const ${CONTRACT_NAME}Addresses = ${JSON.stringify(addressesObject, null, 2)};
`;

console.log(`Generated ${path.join(outdir, `${CONTRACT_NAME}ABI.ts`)}`);
console.log(`Generated ${path.join(outdir, `${CONTRACT_NAME}Addresses.ts`)}`);
console.log("Available deployments:");
Object.values(deployments).forEach((deploy) => {
  console.log(`  - ${deploy.chainName} (chainId: ${deploy.chainId}): ${deploy.address}`);
});

fs.writeFileSync(path.join(outdir, `${CONTRACT_NAME}ABI.ts`), tsCode, "utf-8");
fs.writeFileSync(
  path.join(outdir, `${CONTRACT_NAME}Addresses.ts`),
  tsAddresses,
  "utf-8"
);


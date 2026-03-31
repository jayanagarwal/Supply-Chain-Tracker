// scripts/deploy.js
// ---------------------------------------------------------
// Deploys the SupplyChain contract and writes deployment.json
// (address + ABI) so the frontend team can import it directly.
//
// Usage:
//   npx hardhat run scripts/deploy.js --network localhost
//   npx hardhat run scripts/deploy.js --network sepolia
// ---------------------------------------------------------

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // --- Deploy the contract ---
  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.deploy();
  await supplyChain.waitForDeployment();

  const contractAddress = await supplyChain.getAddress();
  console.log("SupplyChain deployed to:", contractAddress);

  // --- Grant roles to deployer for testing convenience ---
  const FARMER_ROLE = await supplyChain.FARMER_ROLE();
  const HANDLER_ROLE = await supplyChain.HANDLER_ROLE();

  await supplyChain.grantRole(FARMER_ROLE, deployer.address);
  console.log("Granted FARMER_ROLE to deployer");

  await supplyChain.grantRole(HANDLER_ROLE, deployer.address);
  console.log("Granted HANDLER_ROLE to deployer");

  // --- Write deployment.json for the frontend team ---
  // Read the compiled artifact to get the ABI
  const artifact = await hre.artifacts.readArtifact("SupplyChain");

  const deployment = {
    address: contractAddress,
    abi: artifact.abi,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log("Wrote deployment.json to:", outputPath);

  console.log("\n✅ Deployment complete! Share deployment.json with the frontend team.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

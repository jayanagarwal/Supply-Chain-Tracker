// scripts/seed.js
// ---------------------------------------------------------
// Demo / seed script - deploys the contract locally and runs
// a full supply-chain flow with multiple produce batches.
// Great for testing, demos, and class presentations.
//
// Usage:
//   npx hardhat run scripts/seed.js --network localhost
//   (or omit --network to use the in-process Hardhat network)
// ---------------------------------------------------------

const hre = require("hardhat");

// Status enum values (must match contract)
const Status = {
  Registered: 0,
  Processed: 1,
  Shipped: 2,
  Distributed: 3,
  Retail: 4,
};

const STATUS_LABELS = ["Registered", "Processed", "Shipped", "Distributed", "Retail"];

async function main() {
  // Get signers - we'll assign them supply-chain roles
  const [admin, farmer, processor, distributor, retailer] = await hre.ethers.getSigners();

  console.log("=".repeat(60));
  console.log("🌱 SUPPLY CHAIN DEMO - Leafy Greens Tracker");
  console.log("=".repeat(60));
  console.log(`Admin:       ${admin.address}`);
  console.log(`Farmer:      ${farmer.address}`);
  console.log(`Processor:   ${processor.address}`);
  console.log(`Distributor: ${distributor.address}`);
  console.log(`Retailer:    ${retailer.address}`);
  console.log();

  // --- Deploy ---
  console.log("📦 Deploying SupplyChain contract...");
  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.deploy();
  await supplyChain.waitForDeployment();
  const address = await supplyChain.getAddress();
  console.log(`   Contract deployed at: ${address}\n`);

  // --- Grant roles ---
  const FARMER_ROLE = await supplyChain.FARMER_ROLE();
  const HANDLER_ROLE = await supplyChain.HANDLER_ROLE();

  await supplyChain.grantRole(FARMER_ROLE, farmer.address);
  await supplyChain.grantRole(HANDLER_ROLE, processor.address);
  await supplyChain.grantRole(HANDLER_ROLE, distributor.address);
  await supplyChain.grantRole(HANDLER_ROLE, retailer.address);
  console.log("🔑 Roles granted: Farmer, Processor, Distributor, Retailer\n");

  // =========================================================
  //  BATCH 1: Romaine Lettuce
  // =========================================================
  console.log("-".repeat(60));
  console.log("🥬 BATCH 1: Romaine Lettuce");
  console.log("-".repeat(60));

  // Register
  let tx = await supplyChain.connect(farmer).registerProduct(
    "Romaine Lettuce Batch #412",
    "Green Valley Farm, Yuma, AZ"
  );
  await tx.wait();
  console.log("✅ Registered: Romaine Lettuce Batch #412 (Yuma, AZ)");

  // Farm → Processor
  tx = await supplyChain.connect(farmer).transferOwnership(1, processor.address);
  await tx.wait();
  tx = await supplyChain.connect(processor).addCheckpoint(
    1, Status.Processed, "SunFresh Processing, Phoenix, AZ", "Washed, trimmed, and packaged"
  );
  await tx.wait();
  console.log("✅ Processed at SunFresh Processing, Phoenix, AZ");

  // Processor → Shipped
  tx = await supplyChain.connect(processor).addCheckpoint(
    1, Status.Shipped, "I-17 Freight, en route to Denver", "Refrigerated truck, 34°F"
  );
  await tx.wait();
  console.log("✅ Shipped via I-17 Freight");

  // Shipped → Distributor
  tx = await supplyChain.connect(processor).transferOwnership(1, distributor.address);
  await tx.wait();
  tx = await supplyChain.connect(distributor).addCheckpoint(
    1, Status.Distributed, "Denver Distribution Center", "Received, inspected, cold chain verified"
  );
  await tx.wait();
  console.log("✅ Distributed at Denver Distribution Center");

  // Distributor → Retailer
  tx = await supplyChain.connect(distributor).transferOwnership(1, retailer.address);
  await tx.wait();
  tx = await supplyChain.connect(retailer).addCheckpoint(
    1, Status.Retail, "Whole Foods, Boulder, CO", "On shelf, ready for consumers"
  );
  await tx.wait();
  console.log("✅ On shelf at Whole Foods, Boulder, CO\n");

  // =========================================================
  //  BATCH 2: Baby Spinach
  // =========================================================
  console.log("-".repeat(60));
  console.log("🥬 BATCH 2: Baby Spinach");
  console.log("-".repeat(60));

  tx = await supplyChain.connect(farmer).registerProduct(
    "Baby Spinach Batch #87",
    "Salinas Valley Organics, Salinas, CA"
  );
  await tx.wait();
  console.log("✅ Registered: Baby Spinach Batch #87 (Salinas, CA)");

  tx = await supplyChain.connect(farmer).transferOwnership(2, processor.address);
  await tx.wait();
  tx = await supplyChain.connect(processor).addCheckpoint(
    2, Status.Processed, "FreshPack Facility, Salinas, CA", "Triple-washed, bagged in 5oz portions"
  );
  await tx.wait();
  console.log("✅ Processed at FreshPack Facility, Salinas, CA");

  tx = await supplyChain.connect(processor).addCheckpoint(
    2, Status.Shipped, "US-101 Cold Freight", "Reefer container, 36°F"
  );
  await tx.wait();
  console.log("✅ Shipped via US-101 Cold Freight");

  tx = await supplyChain.connect(processor).transferOwnership(2, distributor.address);
  await tx.wait();
  tx = await supplyChain.connect(distributor).addCheckpoint(
    2, Status.Distributed, "Bay Area Distribution Hub, San Jose, CA", "Lot split for regional delivery"
  );
  await tx.wait();
  console.log("✅ Distributed at Bay Area Distribution Hub");

  tx = await supplyChain.connect(distributor).transferOwnership(2, retailer.address);
  await tx.wait();
  tx = await supplyChain.connect(retailer).addCheckpoint(
    2, Status.Retail, "Trader Joe's, San Francisco, CA", "Stocked in organic produce aisle"
  );
  await tx.wait();
  console.log("✅ On shelf at Trader Joe's, San Francisco, CA\n");

  // =========================================================
  //  BATCH 3: Kale (partial, still in transit)
  // =========================================================
  console.log("-".repeat(60));
  console.log("🥬 BATCH 3: Kale (in transit)");
  console.log("-".repeat(60));

  tx = await supplyChain.connect(farmer).registerProduct(
    "Organic Kale Batch #203",
    "Rocky Mountain Greens, Longmont, CO"
  );
  await tx.wait();
  console.log("✅ Registered: Organic Kale Batch #203 (Longmont, CO)");

  tx = await supplyChain.connect(farmer).transferOwnership(3, processor.address);
  await tx.wait();
  tx = await supplyChain.connect(processor).addCheckpoint(
    3, Status.Processed, "Mountain Fresh Processing, Denver, CO", "De-stemmed, chopped, and vacuum-sealed"
  );
  await tx.wait();
  console.log("✅ Processed at Mountain Fresh Processing, Denver, CO");

  tx = await supplyChain.connect(processor).addCheckpoint(
    3, Status.Shipped, "I-25 Express Logistics", "Refrigerated van, 35°F, ETA 4 hours"
  );
  await tx.wait();
  console.log("✅ Shipped via I-25 Express, currently in transit\n");

  // =========================================================
  //  SUMMARY
  // =========================================================
  const totalProducts = await supplyChain.getProductCount();
  console.log("=".repeat(60));
  console.log(`📊 SUMMARY: ${totalProducts} products tracked`);
  console.log("=".repeat(60));

  for (let i = 1; i <= Number(totalProducts); i++) {
    const p = await supplyChain.getProduct(i);
    const cps = await supplyChain.getCheckpoints(i);
    console.log(`\n  Product #${p.id}: ${p.name}`);
    console.log(`    Origin: ${p.origin}`);
    console.log(`    Status: ${STATUS_LABELS[Number(p.currentStatus)]}`);
    console.log(`    Owner:  ${p.currentOwner}`);
    console.log(`    Checkpoints: ${cps.length}`);
    for (const cp of cps) {
      console.log(`      → [${STATUS_LABELS[Number(cp.status)]}] ${cp.location} - ${cp.details}`);
    }
  }

  console.log("\n✅ Seed script complete!\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

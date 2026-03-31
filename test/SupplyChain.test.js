// test/SupplyChain.test.js
// ---------------------------------------------------------
// Comprehensive unit tests for the SupplyChain smart contract.
// Uses Hardhat + Chai + ethers v6.
//
// Test categories:
//   1. Registration   (5 tests)
//   2. Checkpoints    (6 tests)
//   3. Ownership      (4 tests)
//   4. Read functions  (4 tests)
//   5. Integration     (1 full-flow test)
// ---------------------------------------------------------

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupplyChain", function () {
  // ----- Shared variables across tests -----
  let supplyChain;     // Deployed contract instance
  let owner;           // Deployer / admin
  let farmer;          // Will be granted FARMER_ROLE
  let handler;         // Will be granted HANDLER_ROLE
  let unauthorized;    // No role, used to test access control
  let receiver;        // Used as a transfer-to address

  // Role hashes (must match the contract's keccak256 values)
  let FARMER_ROLE;
  let HANDLER_ROLE;

  // Status enum values (mirroring Solidity's uint8 representation)
  const Status = {
    Registered: 0,
    Processed: 1,
    Shipped: 2,
    Distributed: 3,
    Retail: 4,
  };

  // ----- Deploy a fresh contract before each test -----
  beforeEach(async function () {
    // Get test accounts from Hardhat's default signers
    [owner, farmer, handler, unauthorized, receiver] = await ethers.getSigners();

    // Deploy
    const SupplyChain = await ethers.getContractFactory("SupplyChain");
    supplyChain = await SupplyChain.deploy();
    await supplyChain.waitForDeployment();

    // Read role constants from the deployed contract
    FARMER_ROLE = await supplyChain.FARMER_ROLE();
    HANDLER_ROLE = await supplyChain.HANDLER_ROLE();

    // Grant roles
    await supplyChain.grantRole(FARMER_ROLE, farmer.address);
    await supplyChain.grantRole(HANDLER_ROLE, handler.address);
  });

  // =========================================================
  //                    1. REGISTRATION TESTS
  // =========================================================
  describe("Registration", function () {
    it("should allow a farmer to register a product and emit ProductRegistered", async function () {
      // Call registerProduct as the farmer
      const tx = await supplyChain
        .connect(farmer)
        .registerProduct("Romaine Lettuce Batch #412", "Green Valley Farm, Yuma, AZ");

      // Check the event was emitted with the correct args
      await expect(tx)
        .to.emit(supplyChain, "ProductRegistered")
        .withArgs(1, "Romaine Lettuce Batch #412", "Green Valley Farm, Yuma, AZ", farmer.address);
    });

    it("should revert if a non-farmer tries to register a product", async function () {
      // The unauthorized signer has no FARMER_ROLE
      await expect(
        supplyChain.connect(unauthorized).registerProduct("Lettuce", "Farm")
      ).to.be.reverted;
    });

    it("should revert if name is empty", async function () {
      await expect(
        supplyChain.connect(farmer).registerProduct("", "Farm")
      ).to.be.revertedWithCustomError(supplyChain, "EmptyName");
    });

    it("should revert if origin is empty", async function () {
      await expect(
        supplyChain.connect(farmer).registerProduct("Lettuce", "")
      ).to.be.revertedWithCustomError(supplyChain, "EmptyOrigin");
    });

    it("should increment productCount after each registration", async function () {
      // Initially zero
      expect(await supplyChain.productCount()).to.equal(0);

      // Register first product
      await supplyChain.connect(farmer).registerProduct("Lettuce", "Farm A");
      expect(await supplyChain.productCount()).to.equal(1);

      // Register second product
      await supplyChain.connect(farmer).registerProduct("Spinach", "Farm B");
      expect(await supplyChain.productCount()).to.equal(2);
    });
  });

  // =========================================================
  //                    2. CHECKPOINT TESTS
  // =========================================================
  describe("Checkpoints", function () {
    // Register a product before each checkpoint test
    beforeEach(async function () {
      await supplyChain
        .connect(farmer)
        .registerProduct("Romaine Lettuce Batch #412", "Green Valley Farm, Yuma, AZ");
    });

    it("should allow a handler to add a valid forward-status checkpoint", async function () {
      // Move from Registered(0) → Processed(1)
      await expect(
        supplyChain
          .connect(handler)
          .addCheckpoint(1, Status.Processed, "Processing Plant, Phoenix, AZ", "Washed and packaged")
      ).to.not.be.reverted;
    });

    it("should revert if status does not progress forward", async function () {
      // First, advance to Processed
      await supplyChain
        .connect(handler)
        .addCheckpoint(1, Status.Processed, "Plant", "Processed");

      // Try to go backward from Processed(1) to Registered(0), should revert
      await expect(
        supplyChain
          .connect(handler)
          .addCheckpoint(1, Status.Registered, "Farm", "Back to farm")
      ).to.be.revertedWithCustomError(supplyChain, "InvalidStatusProgression");
    });

    it("should revert if the product does not exist", async function () {
      // Product ID 999 doesn't exist
      await expect(
        supplyChain
          .connect(handler)
          .addCheckpoint(999, Status.Processed, "Plant", "Processed")
      ).to.be.revertedWithCustomError(supplyChain, "ProductDoesNotExist");
    });

    it("should emit CheckpointAdded with correct data", async function () {
      const tx = await supplyChain
        .connect(handler)
        .addCheckpoint(1, Status.Processed, "Processing Plant, Phoenix, AZ", "Washed and packaged");

      await expect(tx)
        .to.emit(supplyChain, "CheckpointAdded")
        .withArgs(1, Status.Processed, "Processing Plant, Phoenix, AZ", handler.address);
    });

    it("should update product currentStatus after adding a checkpoint", async function () {
      // Before: should be Registered
      let product = await supplyChain.getProduct(1);
      expect(product.currentStatus).to.equal(Status.Registered);

      // Add checkpoint → Processed
      await supplyChain
        .connect(handler)
        .addCheckpoint(1, Status.Processed, "Plant", "Processed");

      // After: should be Processed
      product = await supplyChain.getProduct(1);
      expect(product.currentStatus).to.equal(Status.Processed);
    });

    it("should revert if an unauthorized account tries to add a checkpoint", async function () {
      // 'unauthorized' has neither FARMER_ROLE nor HANDLER_ROLE
      await expect(
        supplyChain
          .connect(unauthorized)
          .addCheckpoint(1, Status.Processed, "Unknown Plant", "No permission")
      ).to.be.reverted;
    });
  });

  // =========================================================
  //                    3. OWNERSHIP TESTS
  // =========================================================
  describe("Ownership Transfer", function () {
    beforeEach(async function () {
      // Register a product (farmer is the initial owner)
      await supplyChain
        .connect(farmer)
        .registerProduct("Baby Spinach Batch #87", "Salinas Valley Farm, CA");
    });

    it("should allow the current owner to transfer ownership", async function () {
      const tx = await supplyChain
        .connect(farmer)
        .transferOwnership(1, handler.address);

      // Verify the product's owner changed
      const product = await supplyChain.getProduct(1);
      expect(product.currentOwner).to.equal(handler.address);
    });

    it("should revert if a non-owner tries to transfer ownership", async function () {
      // handler is not the owner (farmer is)
      await expect(
        supplyChain.connect(handler).transferOwnership(1, receiver.address)
      ).to.be.revertedWithCustomError(supplyChain, "NotProductOwner");
    });

    it("should revert if transferring to the zero address", async function () {
      await expect(
        supplyChain.connect(farmer).transferOwnership(1, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(supplyChain, "ZeroAddress");
    });

    it("should emit OwnershipTransferred with correct data", async function () {
      const tx = await supplyChain
        .connect(farmer)
        .transferOwnership(1, handler.address);

      await expect(tx)
        .to.emit(supplyChain, "OwnershipTransferred")
        .withArgs(1, farmer.address, handler.address);
    });
  });

  // =========================================================
  //                   4. READ FUNCTION TESTS
  // =========================================================
  describe("Read Functions", function () {
    beforeEach(async function () {
      await supplyChain
        .connect(farmer)
        .registerProduct("Kale Batch #55", "Rocky Mountain Greens, CO");
    });

    it("should return correct product data via getProduct", async function () {
      const product = await supplyChain.getProduct(1);

      expect(product.id).to.equal(1);
      expect(product.name).to.equal("Kale Batch #55");
      expect(product.origin).to.equal("Rocky Mountain Greens, CO");
      expect(product.currentOwner).to.equal(farmer.address);
      expect(product.currentStatus).to.equal(Status.Registered);
      expect(product.checkpointCount).to.equal(0);
    });

    it("should return an empty checkpoint array for a newly registered product", async function () {
      const cps = await supplyChain.getCheckpoints(1);
      expect(cps.length).to.equal(0);
    });

    it("should revert when getProduct is called with a nonexistent ID", async function () {
      await expect(
        supplyChain.getProduct(999)
      ).to.be.revertedWithCustomError(supplyChain, "ProductDoesNotExist");
    });

    it("should return all checkpoints after multiple additions", async function () {
      // Add two checkpoints
      await supplyChain
        .connect(handler)
        .addCheckpoint(1, Status.Processed, "Plant A", "Step 1");
      await supplyChain
        .connect(handler)
        .addCheckpoint(1, Status.Shipped, "Truck B", "Step 2");

      const cps = await supplyChain.getCheckpoints(1);
      expect(cps.length).to.equal(2);

      // Verify first checkpoint
      expect(cps[0].status).to.equal(Status.Processed);
      expect(cps[0].location).to.equal("Plant A");
      expect(cps[0].actor).to.equal(handler.address);

      // Verify second checkpoint
      expect(cps[1].status).to.equal(Status.Shipped);
      expect(cps[1].location).to.equal("Truck B");
    });
  });

  // =========================================================
  //                  5. FULL INTEGRATION TEST
  // =========================================================
  describe("Full Supply Chain Journey", function () {
    it("should complete the entire farm-to-retail journey with ownership transfers", async function () {
      // We'll use:
      //   farmer      = Farmer (registers product, adds first checkpoint)
      //   handler     = Processor / Shipper / Distributor / Retailer
      //   receiver    = Alternate handler for variety
      // Grant handler role to receiver too for this integration test
      await supplyChain.grantRole(HANDLER_ROLE, receiver.address);

      // --- Step 1: Farmer registers the product ---
      await supplyChain
        .connect(farmer)
        .registerProduct("Romaine Lettuce Batch #412", "Green Valley Farm, Yuma, AZ");

      let product = await supplyChain.getProduct(1);
      expect(product.currentStatus).to.equal(Status.Registered);
      expect(product.currentOwner).to.equal(farmer.address);

      // --- Step 2: Farmer → Processor (transfer + checkpoint) ---
      await supplyChain.connect(farmer).transferOwnership(1, handler.address);
      await supplyChain
        .connect(handler)
        .addCheckpoint(1, Status.Processed, "SunFresh Processing, Phoenix, AZ", "Washed, trimmed, and packaged");

      product = await supplyChain.getProduct(1);
      expect(product.currentStatus).to.equal(Status.Processed);
      expect(product.currentOwner).to.equal(handler.address);

      // --- Step 3: Processor → Shipper (checkpoint) ---
      await supplyChain
        .connect(handler)
        .addCheckpoint(1, Status.Shipped, "I-17 Freight, en route to Denver", "Refrigerated truck, 34°F");

      product = await supplyChain.getProduct(1);
      expect(product.currentStatus).to.equal(Status.Shipped);

      // --- Step 4: Shipper → Distributor (transfer + checkpoint) ---
      await supplyChain.connect(handler).transferOwnership(1, receiver.address);
      await supplyChain
        .connect(receiver)
        .addCheckpoint(1, Status.Distributed, "Denver Distribution Center", "Received and inspected");

      product = await supplyChain.getProduct(1);
      expect(product.currentStatus).to.equal(Status.Distributed);
      expect(product.currentOwner).to.equal(receiver.address);

      // --- Step 5: Distributor → Retailer (transfer + checkpoint) ---
      await supplyChain.connect(receiver).transferOwnership(1, unauthorized.address);
      // Grant handler role to the "retailer" so they can add the final checkpoint
      await supplyChain.grantRole(HANDLER_ROLE, unauthorized.address);
      await supplyChain
        .connect(unauthorized)
        .addCheckpoint(1, Status.Retail, "Whole Foods, Boulder, CO", "On shelf, ready for consumers");

      // --- Final verification ---
      product = await supplyChain.getProduct(1);
      expect(product.currentStatus).to.equal(Status.Retail);
      expect(product.currentOwner).to.equal(unauthorized.address);
      expect(product.checkpointCount).to.equal(4);

      // Verify all 4 checkpoints exist
      const cps = await supplyChain.getCheckpoints(1);
      expect(cps.length).to.equal(4);
      expect(cps[0].status).to.equal(Status.Processed);
      expect(cps[1].status).to.equal(Status.Shipped);
      expect(cps[2].status).to.equal(Status.Distributed);
      expect(cps[3].status).to.equal(Status.Retail);
    });
  });
});

# 🌱 Frontend Handoff: Supply Chain Tracker

Hey Jackson! Here's everything you need to build the frontend for our blockchain supply chain tracker.

---

## What's Been Done (Backend / Smart Contract)

We built a Solidity smart contract (`SupplyChain.sol`) that tracks leafy-green produce from farm to retail shelf. Everything is fully tested (20 passing unit tests) and ready for frontend integration.

**The contract handles:**
- Registering new produce batches (farmer scans/enters it)
- Recording checkpoints as produce moves through the supply chain
- Transferring custody between actors (farmer → processor → distributor → retailer)
- Enforcing that status can only move **forward** (can't go from "Shipped" back to "Registered")
- Role-based access control (only authorized users can perform certain actions)

---

## What You Need To Do

Build a web frontend (React) that lets users:

1. **Connect their wallet** (MetaMask)
2. **Register a new product** - enter a name + origin (e.g., "Romaine Lettuce Batch #412", "Green Valley Farm, Yuma, AZ")
3. **Look up a product by ID** - like scanning a barcode/QR code
4. **Add checkpoints** - select a product, choose the next status, enter location + details
5. **Transfer ownership** - hand off custody to the next actor's wallet address
6. **View product timeline** - show the full checkpoint history for any product

---

## The One File You Need

After we deploy the contract, a file called `deployment.json` is generated in the project root. It contains:

```json
{
  "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "abi": [ ... full ABI array ... ],
  "network": "hardhat",
  "deployedAt": "2026-03-23T..."
}
```

- **`address`** - where the contract lives on the blockchain
- **`abi`** - the interface definition (tells ethers.js what functions exist and their parameters)

Import this directly in your React code. When we deploy to Sepolia testnet, we'll give you an updated file with the real address.

---

## How To Connect To The Contract

Using **ethers.js v6** (make sure you install v6, not v5):

```bash
npm install ethers@6
```

```javascript
import { ethers } from "ethers";
import deployment from "./deployment.json";

// Connect to MetaMask
const provider = new ethers.BrowserProvider(window.ethereum);
await window.ethereum.request({ method: "eth_requestAccounts" });
const signer = await provider.getSigner();

// Create contract instance
const contract = new ethers.Contract(deployment.address, deployment.abi, signer);
```

---

## Contract Functions You'll Call

### Write Functions (require MetaMask signature)

#### Register a Product
```javascript
// Only callable by wallets with FARMER_ROLE
const tx = await contract.registerProduct("Romaine Lettuce Batch #412", "Green Valley Farm, Yuma, AZ");
await tx.wait(); // Wait for transaction to be mined
```

#### Add a Checkpoint
```javascript
// Status values: 0=Registered, 1=Processed, 2=Shipped, 3=Distributed, 4=Retail
// Only callable by FARMER_ROLE or HANDLER_ROLE
const tx = await contract.addCheckpoint(
  1,                              // product ID
  1,                              // new status (1 = Processed)
  "SunFresh Processing, Phoenix", // location
  "Washed, trimmed, and packaged" // details
);
await tx.wait();
```

#### Transfer Ownership
```javascript
// Only callable by the current owner of the product
const tx = await contract.transferOwnership(
  1,                                              // product ID
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"   // new owner's wallet address
);
await tx.wait();
```

### Read Functions (free, no gas, no MetaMask popup)

#### Get a Product
```javascript
const product = await contract.getProduct(1); // pass product ID

// product.id          → BigInt (product ID)
// product.name        → string ("Romaine Lettuce Batch #412")
// product.origin      → string ("Green Valley Farm, Yuma, AZ")
// product.currentOwner → string (wallet address)
// product.currentStatus → BigInt (0-4, see status map below)
// product.createdAt   → BigInt (unix timestamp)
// product.checkpointCount → BigInt
```

#### Get Checkpoints
```javascript
const checkpoints = await contract.getCheckpoints(1); // pass product ID

// Each checkpoint:
// cp.actor     → string (wallet address that recorded it)
// cp.status    → BigInt (0-4)
// cp.location  → string
// cp.details   → string
// cp.timestamp → BigInt (unix timestamp)
```

#### Get Total Product Count
```javascript
const count = await contract.getProductCount(); // returns BigInt
```

#### Check If a Wallet Has a Role
```javascript
const FARMER_ROLE = await contract.FARMER_ROLE();
const isFarmer = await contract.hasRole(FARMER_ROLE, walletAddress); // returns true/false
```

---

## Status Values (Important!)

The contract uses numbers 0-4 for status. Map them in your UI:

```javascript
const STATUS_LABELS = ["Registered", "Processed", "Shipped", "Distributed", "Retail"];
const STATUS_ICONS  = ["🌱", "🏭", "🚚", "📦", "🏪"]; // suggestion

// Usage:
const statusText = STATUS_LABELS[Number(product.currentStatus)];
```

Status can ONLY move forward: `Registered → Processed → Shipped → Distributed → Retail`

---

## Roles

| Role | Constant | Who | What They Can Do |
|------|----------|-----|-----------------|
| Admin | `DEFAULT_ADMIN_ROLE` | Us (deployer) | Grant/revoke roles to wallets |
| Farmer | `FARMER_ROLE` | Farmers | Register products, add checkpoints |
| Handler | `HANDLER_ROLE` | Processors, Distributors, Retailers | Add checkpoints |

The frontend should check the connected wallet's role and show/hide UI accordingly:

```javascript
const FARMER_ROLE = await contract.FARMER_ROLE();
const HANDLER_ROLE = await contract.HANDLER_ROLE();

const isFarmer = await contract.hasRole(FARMER_ROLE, signer.address);
const isHandler = await contract.hasRole(HANDLER_ROLE, signer.address);

// Show "Register Product" button only if isFarmer
// Show "Add Checkpoint" button if isFarmer || isHandler
// Show "Transfer" button if user is the product's currentOwner
```

---

## Errors You'll Need To Handle

The contract throws these custom errors. Catch them to show user-friendly messages:

| Error | When | Suggested UI Message |
|-------|------|---------------------|
| `EmptyName()` | Name field is blank | "Please enter a product name" |
| `EmptyOrigin()` | Origin field is blank | "Please enter the origin" |
| `ProductDoesNotExist(id)` | Invalid product ID | "Product not found" |
| `InvalidStatusProgression(id, current, requested)` | Trying to skip or go backward | "Status can only move forward" |
| `NotProductOwner(id, caller, owner)` | Non-owner tries to transfer | "Only the current owner can transfer" |
| `ZeroAddress()` | Transfer to 0x000...000 | "Please enter a valid address" |
| `AccessControlUnauthorizedAccount(account, role)` | Wrong role | "You don't have permission for this action" |

```javascript
try {
  const tx = await contract.registerProduct(name, origin);
  await tx.wait();
} catch (error) {
  // ethers.js v6 wraps contract errors
  if (error.reason) {
    console.log("Error:", error.reason);
  }
}
```

---

## Events (Optional, For Real-Time Updates)

You can listen for events to update the UI in real-time:

```javascript
contract.on("ProductRegistered", (productId, name, origin, farmer) => {
  console.log(`New product #${productId}: ${name}`);
  // Refresh your product list
});

contract.on("CheckpointAdded", (productId, newStatus, location, actor) => {
  console.log(`Product #${productId} moved to ${STATUS_LABELS[Number(newStatus)]}`);
  // Refresh the timeline
});

contract.on("OwnershipTransferred", (productId, oldOwner, newOwner) => {
  console.log(`Product #${productId} transferred to ${newOwner}`);
});
```

---

## How To Test Locally

1. Clone the repo and `npm install`
2. In one terminal: `npx hardhat node` (starts local blockchain)
3. In another terminal: `npx hardhat run scripts/deploy.js --network localhost`
4. This generates `deployment.json`. Point your frontend at it
5. Import the Hardhat test accounts into MetaMask using the private keys shown when you ran `npx hardhat node`
6. Connect MetaMask to `http://127.0.0.1:8545` (chain ID: 31337)

---

## Important Notes

- Product IDs start at **1**, not 0
- All numeric values from the contract are `BigInt`. Use `Number()` to convert for display
- Timestamps are Unix seconds. Use `new Date(Number(timestamp) * 1000)` to convert
- Make sure MetaMask is on the **same network** as the deployed contract
- The contract uses **ethers v6**. Don't mix with v5 syntax (e.g., `contract.address` in v5 is `await contract.getAddress()` in v6)

---

## Questions?

Hit me up if anything is unclear. The contract is locked and tested, 20 tests all passing. You just need to build the UI on top of it! 🚀

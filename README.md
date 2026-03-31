# 🌱 Supply Chain Tracker: Leafy Greens on Blockchain

A Solidity smart contract that tracks leafy-green produce (lettuce, spinach, kale) from farm to retail shelf on the Ethereum blockchain. Built for **Introduction to Blockchain** at CU Boulder (Spring 2026).

## Motivation

In 2018, a romaine lettuce E. coli outbreak across the U.S. took weeks to trace back to its source. Walmart responded by requiring all leafy-green suppliers to join the IBM Food Trust blockchain, cutting traceback time from 7 days to 2.2 seconds. Our project takes that same idea and implements a simplified version as a Solidity smart contract, with a focus on the on-chain authentication model and the practical considerations of tagging physical produce so it maps to an on-chain record.

The core question we're trying to answer: **how do you tie a physical head of lettuce to an immutable digital record, and who gets to write to that record at each step?**

---

## Tech Stack

| Component        | Tool                                      |
|------------------|-------------------------------------------|
| Language         | Solidity ^0.8.20                          |
| Framework        | Hardhat                                   |
| Testing          | Hardhat + Chai/Mocha (ethers v6)          |
| Access Control   | OpenZeppelin AccessControl                |
| Gas Reporting    | hardhat-gas-reporter                      |
| Testnet          | Ethereum Sepolia                          |
| Node Provider    | Alchemy (free tier)                       |
| Verification     | hardhat-verify (Etherscan)                |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ and npm
- An [Alchemy](https://www.alchemy.com/) account (free tier) for Sepolia deployment
- Some [Sepolia ETH](https://sepoliafaucet.com/) for deployment gas fees
- An [Etherscan API key](https://etherscan.io/myapikey) for contract verification

### 1. Install Dependencies

```bash
cd supply-chain-tracker
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your keys:

```
ALCHEMY_API_KEY=your_alchemy_api_key
DEPLOYER_PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

> ⚠️ **Never commit your `.env` file.** It's already in `.gitignore`.

---

## Commands

### Compile

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Run Tests with Gas Report

```bash
REPORT_GAS=true npx hardhat test
```

> On Windows PowerShell, set the env var first:
> ```powershell
> $env:REPORT_GAS="true"; npx hardhat test
> ```

### Deploy to Localhost

Start a local Hardhat node in one terminal:

```bash
npx hardhat node
```

In a second terminal, deploy:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

### Run the Demo / Seed Script

```bash
npx hardhat run scripts/seed.js --network localhost
```

This registers 3 produce batches and walks them through the full supply chain. Great for demos and presentations.

### Deploy to Sepolia Testnet

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### Verify on Etherscan

```bash
npx hardhat verify --network sepolia <DEPLOYED_CONTRACT_ADDRESS>
```

---

## Project Structure

```
supply-chain-tracker/
├── contracts/
│   └── SupplyChain.sol         # Main smart contract
├── test/
│   └── SupplyChain.test.js     # 20 unit tests
├── scripts/
│   ├── deploy.js               # Deploy + write deployment.json
│   └── seed.js                 # Demo script (3 produce batches)
├── hardhat.config.js           # Hardhat configuration
├── deployment.json             # Generated after deploy (address + ABI)
├── .env.example                # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

---

## Smart Contract Overview

### Roles (AccessControl)

| Role           | Who                               | Permissions                              |
|----------------|-----------------------------------|------------------------------------------|
| `ADMIN_ROLE`   | Contract deployer                 | Grant/revoke roles                       |
| `FARMER_ROLE`  | Farmers                           | Register products, add checkpoints       |
| `HANDLER_ROLE` | Processors, Distributors, Retailers | Add checkpoints, receive ownership     |

### Status Lifecycle

```
Registered → Processed → Shipped → Distributed → Retail
```

Status can only move **forward** (enforced on-chain). The contract reverts with `InvalidStatusProgression` if anyone tries to skip ahead or go backward.

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `registerProduct(name, origin)` | FARMER_ROLE | Creates a new produce batch |
| `addCheckpoint(id, status, location, details)` | FARMER / HANDLER | Adds a supply-chain checkpoint |
| `transferOwnership(id, newOwner)` | Current owner | Transfers custody to next handler |
| `getProduct(id)` | Anyone | Returns product details |
| `getCheckpoints(id)` | Anyone | Returns full checkpoint history |
| `getProductCount()` | Anyone | Returns total registered products |

---

## Authentication Model and On-Chain Security

This is probably the most important design decision in the project. The question is: who is allowed to write to a product's on-chain record, and under what constraints?

### How Write Access Works

We use OpenZeppelin's `AccessControl` to gate every write operation. The deployer gets `DEFAULT_ADMIN_ROLE` and is the only one who can grant or revoke the other two roles:

- **FARMER_ROLE**: Can register new produce batches. Can also add checkpoints.
- **HANDLER_ROLE**: Can add checkpoints but cannot register new products. This role is given to processors, distributors, and retailers.

Ownership transfer is separate from role-based access. Only the *current owner* of a specific product can call `transferOwnership()`. This means a handler can receive custody, but they can't take it; it has to be handed to them by whoever currently holds the product.

### Why This Model

In a real supply chain, trust isn't uniform. A farmer who grows the lettuce is not the same kind of actor as a cold-storage warehouse operator. We wanted the contract to reflect that: farmers are the only ones who can introduce new products into the system, and every other actor can only append to an existing product's history. This keeps the entry point narrow and auditable.

The forward-only status constraint (`Registered → Processed → Shipped → Distributed → Retail`) is enforced with a simple integer comparison on the enum values. This prevents a compromised or malicious handler from rolling a product's status backward to hide that it was, say, already shipped and returned.

### Threat Model / What Could Go Wrong

We think it's worth being honest about the limitations:

1. **Compromised private key**: If a farmer's wallet is compromised, the attacker can register bogus products or add fake checkpoints. There is no on-chain way to distinguish a legitimate farmer from someone who stole their key. In a production system you'd want multi-sig wallets or hardware keys for every supply chain actor.

2. **Admin is a single point of trust**: The deployer can grant `FARMER_ROLE` to anyone. If the admin wallet is compromised, the attacker can mint roles freely. A real deployment would use a multi-sig (like a Gnosis Safe) as the admin, or a governance contract with a time-lock.

3. **Garbage in, garbage out**: The contract enforces *who* can write and *what order* the statuses follow, but it can't verify that the location string or details string are truthful. A handler could write "Phoenix, AZ" while physically being in Tucson. Solving this fully would require something like GPS oracles, which is out of scope for this project.

4. **No revocation of checkpoints**: Once a checkpoint is written, it's permanent. This is a feature (immutability = auditability), but it means a mistake or a malicious entry can't be corrected, only appended to.

5. **Role granularity**: We use two roles (farmer and handler) for simplicity. In a more complete system, you might want separate roles for processors, distributors, and retailers so you can enforce that a processor can only set status to `Processed`, not skip ahead to `Retail`.

---

## Physical Tag Integration

One of the trickier parts of real-world supply chain tracking is bridging the physical and digital worlds. You need some kind of tag on the actual product (or on its crate/pallet) that links to the on-chain record. Here's how we think about it for this project.

### The Identifier

Every product registered on-chain gets an auto-incrementing `uint256` ID (starting at 1). This is the canonical identifier. The physical tag's job is to encode this ID so that anyone downstream can scan it and pull up the product's full history.

### Option 1: QR Codes (Simplest, Cheapest)

This is what we're using for our demo. When a farmer registers a batch, the frontend generates a QR code that encodes a URL like:

```
https://yourapp.com/product/42
```

The frontend reads the product ID from the URL, calls `getProduct(42)` and `getCheckpoints(42)`, and renders the full timeline.

**Pros:**
- Essentially free. You can print QR codes on existing packaging labels.
- Any smartphone can scan them, no special hardware needed.
- Works well for consumer-facing transparency (scan at the grocery store, see where your lettuce came from).

**Cons:**
- QR codes can be photocopied. Someone could peel a QR label off a legitimate batch and stick it on a different one.
- No built-in tamper detection.

**Mitigation:** Pair the QR code with a tamper-evident seal. If the seal is broken, the QR code is suspect. This isn't cryptographically secure, but it's the standard approach in most food traceability pilots today.

### Option 2: NFC Tags

NFC (Near Field Communication) tags are small chips that can be embedded in packaging or attached as stickers. Each NFC tag has a factory-burned unique ID (UID) that is very hard to clone.

**Pros:**
- Much harder to duplicate than QR codes. The UID provides a layer of physical authentication.
- You could store the NFC UID on-chain alongside the product record, so when someone scans the tag, you can cross-check: "does this NFC UID match what's recorded for product #42?"
- More durable than printed codes (works through dirt, moisture, etc.).

**Cons:**
- Costs money: roughly $0.10 to $0.50 per tag depending on volume and type.
- Requires NFC-capable hardware to scan (most modern smartphones support this, but not all).
- For bulk produce like leafy greens, tagging every individual head of lettuce is impractical. You'd tag at the crate or pallet level.

### Option 3: RFID (Enterprise Scale)

RFID tags can be read at longer range and in bulk (scan an entire pallet at once), which is what Walmart and large retailers actually use. However, RFID readers are expensive, and this is overkill for our project scope. Mentioning it here for completeness.

### What We Chose and Why

For this project, we went with **QR codes** because they're free, they work for a demo, and they let us focus our effort on the on-chain components rather than hardware procurement. In the README and our presentation, we acknowledge the trade-offs: QR is the weakest option from a forgery standpoint, but it's the most accessible and it demonstrates the core concept of linking a physical product to a blockchain record.

If we were building this for production, we'd push toward NFC tags at the crate level, with the tag UID stored on-chain as an extra field in the `Product` struct. That gives you two-factor verification: the on-chain record says "product #42 should have NFC UID `0x7A3F...`", and when you scan the tag, you can confirm it matches.

---

## Frontend Integration

After deployment, a `deployment.json` file is generated in the project root:

```json
{
  "address": "0x...",
  "abi": [ ... ],
  "network": "sepolia",
  "deployedAt": "2026-03-23T..."
}
```

The frontend team can import this directly:

```javascript
import deployment from "./deployment.json";
const contract = new ethers.Contract(deployment.address, deployment.abi, signer);
```

See [FRONTEND_HANDOFF.md](./FRONTEND_HANDOFF.md) for the full integration guide with code examples for every contract function.

---

## Deployed Contract

| Network | Address | Etherscan |
|---------|---------|-----------|
| Sepolia | `TBD` | `TBD` |

---

## Team

- **Blockchain Lead**: Smart contract, Hardhat setup, tests, deployment
- **Frontend Lead (Jackson)**: React frontend, integration via ABI

---

## License

MIT

# Project Update: Supply Chain Tracker for Leafy Greens

**Team:** Jayan Agarwal, Jackson Hill  
**Course:** Introduction to Blockchain, Spring 2026  
**Date:** March 31, 2026

---

## Where We Are

The smart contract side of the project is essentially done. We have a working Solidity contract (`SupplyChain.sol`) that tracks leafy-green produce from farm to retail shelf using an immutable chain of checkpoints. The contract is compiled, tested with 20 passing unit tests, and ready for deployment to Sepolia. The frontend is the next major piece of work.

## What's Working

The contract implements the core flow we outlined in our proposal:

- A farmer registers a produce batch (e.g., "Romaine Lettuce Batch #412" from "Green Valley Farm, Yuma, AZ"), which creates an on-chain record with a unique ID.
- As the produce moves through the supply chain, authorized actors add checkpoints that record a new status, location, and details. Status is enforced to only move forward (Registered to Processed to Shipped to Distributed to Retail), so no one can roll back a product's history.
- Ownership can be transferred between actors (farmer hands off to processor, processor to distributor, etc.), and only the current owner can initiate that transfer.

We used OpenZeppelin's AccessControl for role-based permissions. There are two roles beyond the admin: `FARMER_ROLE` (can register new products and add checkpoints) and `HANDLER_ROLE` (can add checkpoints but not register new products). The admin (deployer) grants these roles to wallet addresses. This was one of the design decisions Daniel flagged as important in his feedback on our proposal, and we spent a good amount of time thinking through why this particular split makes sense for the domain.

We also wrote a seed script that deploys the contract locally and runs three produce batches through different stages of the supply chain. This has been really useful for testing and will be good for our final demo.

## Challenges and Failures

**Dependency headaches.** Getting Hardhat, ethers.js v6, and the OpenZeppelin contracts to all play nice together took longer than expected. We ran into version conflicts between `@nomicfoundation/hardhat-ethers` and the standalone `ethers` package, and some of the Hardhat plugins had breaking changes between versions that weren't well documented. This was probably two sessions worth of debugging that felt unproductive at the time but taught us a lot about how the JavaScript tooling ecosystem around Solidity actually works.

**Testing edge cases.** Writing the tests themselves was straightforward, but thinking through all the edge cases took effort. For example, we initially didn't have a test for what happens when someone tries to set the status to the *same* value (not just backward, but equal). That's technically not "forward" progress, so the contract should revert, and it does, but we only caught that because we were being thorough with the test matrix. We ended up with 20 tests across five categories: registration, checkpoints, ownership, read functions, and one full integration test that walks a product from farm to retail.

**Understanding gas costs.** We enabled `hardhat-gas-reporter` and were surprised by how much gas string storage costs on-chain. Storing location and details as strings is convenient but expensive. In a production system, you'd probably want to store hashes on-chain and keep the full strings off-chain (maybe on IPFS), but for our scope we decided this was an acceptable trade-off to keep the contract simpler.

## Learnings

The biggest takeaway so far is that the on-chain component of a supply chain system is actually the easier part. The harder questions are physical-world problems: how do you tag a head of lettuce so it maps to an on-chain record? How do you prevent someone from peeling a QR sticker off one batch and putting it on another? These are the questions Daniel raised in his feedback, and digging into them gave us a much better appreciation for why real-world supply chain blockchain projects (like Walmart's IBM Food Trust) are so complex.

We also learned that Solidity's custom errors (introduced in 0.8.4) are significantly cheaper than `require` strings and make the contract more debuggable from the frontend side. Every revert in our contract returns a structured error with relevant IDs and addresses, which means the frontend can parse them and show meaningful messages to the user instead of generic "transaction reverted" errors.

On the collaboration side, writing a detailed frontend handoff document (`FRONTEND_HANDOFF.md`) forced us to think about the contract from the consumer's perspective. We documented every function signature, return type, error case, and event, with working code snippets. That exercise actually helped us find a couple of inconsistencies in our NatSpec comments that we then fixed.

## What's Next

1. **Frontend (Jackson's focus, next two weeks).** Jackson is building a React app that connects to the contract via MetaMask. The handoff doc is done and covers everything he needs: wallet connection, contract instantiation, calling every read/write function, error handling, and event listeners for real-time updates.

2. **Sepolia deployment.** We have the Hardhat config set up for Sepolia via Alchemy. We're holding off on deploying until the frontend is far enough along that we can test the full stack on a testnet rather than just localhost. We have Sepolia ETH from the faucet and an Etherscan API key ready for contract verification.

3. **QR code integration.** For the demo, we plan to generate QR codes that encode a URL like `https://ourapp.com/product/42`. When scanned, the frontend reads the product ID from the URL and displays the full on-chain history. This is the simplest version of the physical tag integration we discussed in the README.

4. **Demo prep.** The seed script already creates three realistic produce batches with full supply chain journeys, so we have good demo data. We want to walk through a live scenario where we register a new batch, add checkpoints from different MetaMask accounts, and show the timeline building up in real time.

## Areas of Uncertainty / Where We Could Use Help

**Gas optimization vs. readability.** We're storing location and details as on-chain strings, which is expensive. We've discussed using IPFS content hashes instead, but that adds a lot of complexity (pinning, gateways, availability). Is the string storage approach acceptable for a class project, or should we be demonstrating the IPFS pattern even if it makes the contract harder to follow?

**Multi-sig for admin.** Right now the deployer wallet is the sole admin who can grant and revoke roles. We know this is a centralization risk and we call it out in our security analysis. Would it be worth implementing a simple multi-sig or time-lock for the admin role, or is documenting the limitation sufficient for our scope?

**Testnet stability.** We've heard that Sepolia can be flaky sometimes. If we run into issues during the live demo, should we have a fallback plan (like running the Hardhat local node on a laptop and demoing against localhost)?

**Frontend scope.** Jackson is planning to build: wallet connection, product registration, checkpoint entry, ownership transfer, product lookup by ID, and a timeline view. Is there a particular feature the instructors would want to see prioritized, or anything we should cut if we're short on time?

We feel good about where the project stands. The contract is solid, tested, and documented. The main risk at this point is time management on the frontend side and making sure the Sepolia deployment goes smoothly before the final presentation.

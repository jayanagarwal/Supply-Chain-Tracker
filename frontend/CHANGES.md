# Leafy Greens — Frontend

## How to Run

### Prerequisites
- Node.js installed
- MetaMask browser extension installed

---

### Running the App (Sepolia Testnet)

This is the standard way to run the app. The smart contract is already deployed and verified on Sepolia — no local blockchain needed.

**Step 1 — Install dependencies**
In the `frontend/` folder:
```
npm install
```

**Step 2 — Start the frontend**
```
npm start
```
The app will open at `http://localhost:3000`.

**Step 3 — Configure MetaMask**
Switch MetaMask to the **Sepolia** testnet. The app will automatically prompt you to switch when you click Connect MetaMask.

**Step 4 — Connect and use the app**
- The deployer wallet holds `FARMER_ROLE` and `DEFAULT_ADMIN_ROLE` on Sepolia
- Connect with the admin wallet to use the **Grant Role** panel to assign Farmer or Handler roles to any wallet address
- Once a wallet has a role, it can connect and use the corresponding features immediately

---

### Running Locally for Development (Hardhat)

> Only needed if you want to test new features or make changes to the smart contract without spending Sepolia ETH.

You will need three terminals all opened in the project root (`Supply-Chain-Tracker/`).

**Step 1 — Start the local blockchain**
```
npx hardhat node
```
Leave this running.

**Step 2 — Deploy and seed the contract**
```
npx hardhat run scripts/seed.js --network localhost
```
Look for `Contract deployed at: 0x...` in the output and copy that address.

**Step 3 — Update the frontend contract address**
Open `frontend/src/deployment.json` and replace the `"address"` value with the address you just copied.

**Step 4 — Switch to the Hardhat chain ID**
In `frontend/src/App.js` and `frontend/src/ProductPage.js`, change all occurrences of `0xAA36A7` to `0x7A69`.

**Step 5 — Start the frontend**
In the `frontend/` folder:
```
npm start
```

**Step 6 — Configure MetaMask**
Add a custom network:
- Network name: Hardhat Localhost
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: ETH

Import test accounts using the private keys printed by the Hardhat node. The seed script grants roles to accounts #1–#4:
- Account #1 — Farmer
- Account #2 — Handler (Processor)
- Account #3 — Handler (Distributor)
- Account #4 — Handler (Retailer)

> When switching back to Sepolia after local testing, reverse Steps 3 and 4.

---

## Changes Made in This Session

### Styling (App.css — complete rewrite)

- **Dark slate header** (`#0f172a`) replacing the original forest green — gives the app a more professional, industry-specific feel rather than a generic web app look
- **Outfit font** imported from Google Fonts for a more distinctive typographic style
- **Connect hero page** — before connecting MetaMask, users now see a centered landing card with the Leafy Greens logo, app description, and a prominent Connect button instead of a bare unstyled button
- **Card-based layout** — each section (Lookup, Register, Checkpoint, Admin) is wrapped in its own styled card with a colored icon badge and section title
- **Status progress bar** — a visual step indicator showing all 5 supply chain stages (Registered → Processed → Shipped → Distributed → Retail) with filled circles for completed stages and a glowing ring on the current one
- **Timeline redesign** — checkpoint history now uses a vertical timeline with colored left borders per status (grey = Registered, amber = Processed, blue = Shipped, purple = Distributed, green = Retail)
- **Styled form inputs** — inputs and selects have a focus ring, placeholder styling, and consistent sizing
- **Color-coded message banners** — success (green), pending/submitting (yellow), and error (red) messages are now styled banners rather than plain colored text
- **Loading spinner** — ProductPage shows an animated spinner while fetching product data
- **Responsive design** — layout stacks vertically on small screens, wallet address hides on mobile

### App.js

- **Rebranded to "Leafy Greens"** with a logo icon and "Supply Chain Tracker" sub-label in the header
- **Logo click refreshes the page** — clicking the Leafy Greens logo in the header reloads the app
- **Wallet badge in header** — after connecting, the header shows a green status dot, truncated wallet address, and role label (Farmer / Handler / Viewer)
- **Section isolation** — interacting with one section (typing in its inputs) automatically clears the results from all other sections, so stale output from a previous action doesn't stay on screen
- **Admin panel** — a Grant Role card appears at the bottom when connected with the contract admin wallet. Allows granting FARMER_ROLE or HANDLER_ROLE to any wallet address directly from the UI without needing Etherscan or a script
- **Switched to Sepolia** — chain ID updated from `0x7A69` (Hardhat) to `0xAA36A7` (Sepolia), and the wallet_addEthereumChain fallback updated accordingly
- **StatusSteps component** — extracted as a reusable component used in both App.js and ProductPage.js

### ProductPage.js (QR scan destination)

- Applied the same design system as App.js (header, card layout, timeline, status progress bar)
- **Loading state** — shows a spinner while the product loads instead of a blank screen
- **Connect hero** — if MetaMask isn't connected when the page loads, shows the same landing card style as the main page
- **Back button** in the header replaces the wallet badge, styled consistently with the rest of the header
- **Chain of Custody label** in the card header makes it immediately clear what the page is for when reached via QR scan

### frontend/src/deployment.json

- Contract address updated to the Sepolia deployment: `0x9b9c336224b696F4ca42F106063502BBb37c44eC`
- Network field updated from `localhost` to `sepolia`

---

## Contract (Sepolia)

- **Address:** `0x9b9c336224b696F4ca42F106063502BBb37c44eC`
- **Network:** Sepolia testnet
- **Verified on Etherscan:** https://sepolia.etherscan.io/address/0x9b9c336224b696F4ca42F106063502BBb37c44eC#code

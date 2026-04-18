// hardhat.config.js
// ---------------------------------------------------------
// Hardhat configuration for the SupplyChain project.
// Includes Sepolia testnet, Etherscan verification, and
// gas reporting so test output shows per-function gas costs.
// ---------------------------------------------------------

require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-verify");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // -------------------------------------------------------
  // Compiler — using Solidity 0.8.20 (matches OpenZeppelin)
  // -------------------------------------------------------
  solidity: "0.8.20",

  // -------------------------------------------------------
  // Networks
  // -------------------------------------------------------
  networks: {
    // Default "hardhat" in-process network is always available.
    // Localhost is for when you run `npx hardhat node` separately.
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Sepolia testnet — requires ALCHEMY_API_KEY & DEPLOYER_PRIVATE_KEY in .env
    sepolia: {
      url: process.env.ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "https://ethereum-sepolia-rpc.publicnode.com",
      accounts:
        process.env.DEPLOYER_PRIVATE_KEY
          ? [process.env.DEPLOYER_PRIVATE_KEY]
          : [], 
    },
  },

  // -------------------------------------------------------
  // Etherscan verification — requires ETHERSCAN_API_KEY
  // -------------------------------------------------------
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },

  // -------------------------------------------------------
  // Gas Reporter — shows gas cost per function in test output
  // Set REPORT_GAS=true in your shell to enable:
  //   REPORT_GAS=true npx hardhat test
  // -------------------------------------------------------
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

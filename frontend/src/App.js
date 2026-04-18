import { useState } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import deployment from "./deployment.json";
import "./App.css";

const STATUS_LABELS = ["Registered", "Processed", "Shipped", "Distributed", "Retail"];

function parseError(e) {
  const name = e?.revert?.name || e?.data?.errorName || "";
  if (name === "EmptyName")                        return "Please enter a product name.";
  if (name === "EmptyOrigin")                      return "Please enter the origin.";
  if (name === "ProductDoesNotExist")              return "Product not found.";
  if (name === "InvalidStatusProgression")         return "Status can only move forward.";
  if (name === "NotProductOwner")                  return "Only the current owner can transfer this product.";
  if (name === "ZeroAddress")                      return "Please enter a valid wallet address.";
  if (name === "AccessControlUnauthorizedAccount") return "You don't have permission for this action.";
  if (e?.reason)                                   return e.reason;
  if (e?.message?.includes("user rejected"))       return "Transaction cancelled.";
  return "Transaction failed. Check the console for details.";
}

function msgClass(text) {
  if (!text) return "msg";
  if (text === "Submitting...") return "msg msg-pending";
  if (
    text.startsWith("Registered") ||
    text.startsWith("Checkpoint") ||
    text.startsWith("Ownership") ||
    text.includes("role granted")
  ) return "msg msg-success";
  return "msg msg-error";
}

function StatusSteps({ currentStatus }) {
  const cur = Number(currentStatus);
  return (
    <div className="status-steps">
      {STATUS_LABELS.map((label, i) => (
        <div
          key={i}
          className={`step-item${i < cur ? " done" : i === cur ? " current" : ""}`}
        >
          <div className="step-circle">{i < cur ? "✓" : ""}</div>
          <span className="step-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [isFarmer, setIsFarmer] = useState(false);
  const [isHandler, setIsHandler] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [grantAddress, setGrantAddress] = useState("");
  const [grantRoleType, setGrantRoleType] = useState("");
  const [grantStatus, setGrantStatus] = useState("");

  const [lookupId, setLookupId] = useState("");
  const [product, setProduct] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [lookupError, setLookupError] = useState("");

  const [regName, setRegName] = useState("");
  const [regOrigin, setRegOrigin] = useState("");
  const [regStatus, setRegStatus] = useState("");
  const [newProductId, setNewProductId] = useState(null);

  const [cpId, setCpId] = useState("");
  const [cpStatus, setCpStatus] = useState("");
  const [cpLocation, setCpLocation] = useState("");
  const [cpDetails, setCpDetails] = useState("");
  const [cpCurrentStatus, setCpCurrentStatus] = useState(null);
  const [cpTxStatus, setCpTxStatus] = useState("");

  const [transferTo, setTransferTo] = useState("");
  const [transferStatus, setTransferStatus] = useState("");

  async function connectWallet() {
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xAA36A7" }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0xAA36A7",
              chainName: "Sepolia Testnet",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
            }],
          });
        }
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const c = new ethers.Contract(deployment.address, deployment.abi, signer);
      const FARMER_ROLE = await c.FARMER_ROLE();
      const HANDLER_ROLE = await c.HANDLER_ROLE();
      const DEFAULT_ADMIN_ROLE = await c.DEFAULT_ADMIN_ROLE();
      setAccount(address);
      setContract(c);
      setIsFarmer(await c.hasRole(FARMER_ROLE, address));
      setIsHandler(await c.hasRole(HANDLER_ROLE, address));
      setIsAdmin(await c.hasRole(DEFAULT_ADMIN_ROLE, address));
    } catch (e) {
      console.error("Connection error:", e);
      alert("Connection failed: " + (e.message || e));
    }
  }

  async function lookupProduct() {
    setLookupError("");
    setProduct(null);
    setCheckpoints([]);
    setTransferTo("");
    setTransferStatus("");
    if (!lookupId) { setLookupError("Please enter a product ID."); return; }
    try {
      const p = await contract.getProduct(Number(lookupId));
      const cps = await contract.getCheckpoints(Number(lookupId));
      setProduct(p);
      setCheckpoints(cps);
    } catch (e) {
      setLookupError(parseError(e));
    }
  }

  async function registerProduct() {
    if (!regName)                      { setRegStatus("Please enter a product name.");                  return; }
    if (regName.trim().length < 3)     { setRegStatus("Product name must be at least 3 characters.");   return; }
    if (regName.trim().length > 100)   { setRegStatus("Product name must be 100 characters or fewer."); return; }
    if (!regOrigin)                    { setRegStatus("Please enter the origin.");                       return; }
    if (regOrigin.trim().length < 3)   { setRegStatus("Origin must be at least 3 characters.");         return; }
    if (regOrigin.trim().length > 150) { setRegStatus("Origin must be 150 characters or fewer.");       return; }
    setRegStatus("Submitting...");
    setNewProductId(null);
    try {
      const tx = await contract.registerProduct(regName, regOrigin);
      await tx.wait();
      const count = await contract.getProductCount();
      const id = Number(count);
      setNewProductId(id);
      setRegStatus(`Registered! Product ID: ${id}`);
      setRegName("");
      setRegOrigin("");
    } catch (e) {
      console.error(e);
      setRegStatus(parseError(e));
    }
  }

  async function loadProductForCheckpoint() {
    setCpCurrentStatus(null);
    setCpStatus("");
    setCpTxStatus("");
    if (!cpId) { setCpTxStatus("Please enter a product ID."); return; }
    try {
      const p = await contract.getProduct(Number(cpId));
      setCpCurrentStatus(Number(p.currentStatus));
    } catch (e) {
      setCpTxStatus(parseError(e));
    }
  }

  async function addCheckpoint() {
    if (!cpStatus)                       { setCpTxStatus("Please select a status.");                    return; }
    if (!cpLocation)                     { setCpTxStatus("Please enter a location.");                   return; }
    if (cpLocation.trim().length < 3)    { setCpTxStatus("Location must be at least 3 characters.");   return; }
    if (cpLocation.trim().length > 150)  { setCpTxStatus("Location must be 150 characters or fewer."); return; }
    if (!cpDetails)                      { setCpTxStatus("Please enter details.");                      return; }
    if (cpDetails.trim().length < 3)     { setCpTxStatus("Details must be at least 3 characters.");    return; }
    if (cpDetails.trim().length > 200)   { setCpTxStatus("Details must be 200 characters or fewer.");  return; }
    setCpTxStatus("Submitting...");
    try {
      const tx = await contract.addCheckpoint(Number(cpId), Number(cpStatus), cpLocation, cpDetails);
      await tx.wait();
      setCpTxStatus("Checkpoint added!");
      setCpLocation("");
      setCpDetails("");
      setCpCurrentStatus(null);
      setCpStatus("");
      setCpId("");
    } catch (e) {
      console.error(e);
      setCpTxStatus(parseError(e));
    }
  }

  async function transferOwnership() {
    if (!transferTo) { setTransferStatus("Please enter a wallet address."); return; }
    setTransferStatus("Submitting...");
    try {
      const tx = await contract.transferOwnership(Number(lookupId), transferTo);
      await tx.wait();
      setTransferStatus("Ownership transferred!");
      setTransferTo("");
      lookupProduct();
    } catch (e) {
      console.error(e);
      setTransferStatus(parseError(e));
    }
  }

  async function grantRoleToAddress() {
    if (!grantAddress)  { setGrantStatus("Please enter a wallet address."); return; }
    if (!grantRoleType) { setGrantStatus("Please select a role.");           return; }
    setGrantStatus("Submitting...");
    try {
      let role;
      if (grantRoleType === "admin") role = await contract.DEFAULT_ADMIN_ROLE();
      else if (grantRoleType === "farmer") role = await contract.FARMER_ROLE();
      else role = await contract.HANDLER_ROLE();

      const tx = await contract.grantRole(role, grantAddress);
      await tx.wait();
      const label = grantRoleType === "admin" ? "Admin" : grantRoleType === "farmer" ? "Farmer" : "Handler";
      setGrantStatus(`${label} role granted to ${grantAddress.slice(0,6)}...${grantAddress.slice(-4)}`);
      setGrantAddress("");
      setGrantRoleType("");
    } catch (e) {
      console.error(e);
      setGrantStatus(parseError(e));
    }
  }

  function clearOtherResults(activeSection) {
    if (activeSection !== "lookup") {
      setProduct(null);
      setCheckpoints([]);
      setLookupError("");
    }
    if (activeSection !== "register") {
      setRegStatus("");
      setNewProductId(null);
    }
    if (activeSection !== "checkpoint") {
      setCpTxStatus("");
      setCpCurrentStatus(null);
    }
  }

  const roleLabel = isAdmin ? "Admin" : isFarmer ? "Farmer" : isHandler ? "Handler" : "Viewer";

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          <div className="header-logo" onClick={() => window.location.reload()} style={{ cursor: "pointer" }}>
            <div className="logo-icon-wrap">🥬</div>
            <div className="logo-wordmark">
              <span className="logo-title">Leafy Greens</span>
              <span className="logo-sub">Supply Chain Tracker</span>
            </div>
          </div>
          {account && (
            <div className="wallet-badge">
              <span className="wallet-dot" />
              <span className="wallet-address">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              <span className="wallet-role">{roleLabel}</span>
            </div>
          )}
        </div>
      </header>

      <main className="main">
        {/* ── Connect Hero ── */}
        {!account ? (
          <div className="connect-hero">
            <div className="connect-card">
              <div className="connect-logo">🥬</div>
              <h1>Leafy Greens</h1>
              <p className="connect-subtitle">Produce Supply Chain Tracker</p>
              <p className="connect-tagline">
                Track leafy greens from farm to retail shelf on the Ethereum
                blockchain. Every step of the journey — verified, permanent,
                and tamper-proof.
              </p>
              <button className="btn btn-connect" onClick={connectWallet}>
                Connect MetaMask
              </button>
              <p className="connect-hint">
                Requires MetaMask with the Hardhat or Sepolia network configured.
              </p>
            </div>
          </div>
        ) : (
          <div className="container">

            {/* ── Product Lookup ── */}
            <section className="card">
              <div className="card-header">
                <div className="card-icon card-icon-blue">🔍</div>
                <span className="card-title">Look Up Product</span>
              </div>
              <div className="form-row">
                <input
                  value={lookupId}
                  onChange={e => { setLookupId(e.target.value); clearOtherResults("lookup"); }}
                  onKeyDown={e => e.key === "Enter" && lookupProduct()}
                  placeholder="Product ID (e.g. 1)"
                />
                <button className="btn btn-primary" onClick={lookupProduct}>
                  Look Up
                </button>
              </div>
              {lookupError && <p className="msg msg-error">{lookupError}</p>}

              {product && (
                <div style={{ marginTop: "24px" }}>
                  <div className="product-name">{product.name}</div>

                  <StatusSteps currentStatus={product.currentStatus} />

                  <div className="product-meta">
                    <div className="meta-item">
                      <div className="meta-label">Origin</div>
                      <div className="meta-value">{product.origin}</div>
                    </div>
                    <div className="meta-item">
                      <div className="meta-label">Current Status</div>
                      <div className="meta-value">
                        <span className="status-badge">
                          {STATUS_LABELS[Number(product.currentStatus)]}
                        </span>
                      </div>
                    </div>
                    <div className="meta-item">
                      <div className="meta-label">Current Owner</div>
                      <div className="meta-value">{product.currentOwner}</div>
                    </div>
                  </div>

                  <p className="section-label">Checkpoint History</p>
                  <div className="timeline">
                    {checkpoints.length === 0 && (
                      <p style={{ color: "#94a3b8", fontSize: "0.88rem" }}>
                        No checkpoints recorded yet.
                      </p>
                    )}
                    {checkpoints.map((cp, i) => (
                      <div
                        className="timeline-item"
                        key={i}
                        data-status={Number(cp.status)}
                      >
                        <div className="timeline-card">
                          <div className="timeline-top">
                            <span className="timeline-status">
                              {STATUS_LABELS[Number(cp.status)]}
                            </span>
                            <span className="timeline-time">
                              {new Date(Number(cp.timestamp) * 1000).toLocaleString()}
                            </span>
                          </div>
                          <div className="timeline-location">{cp.location}</div>
                          <div className="timeline-details">{cp.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="qr-section">
                    <QRCodeSVG
                      value={`${window.location.origin}/product/${lookupId}`}
                      size={156}
                    />
                    <span className="qr-label">Scan to view product #{lookupId}</span>
                  </div>

                  {product.currentOwner.toLowerCase() === account?.toLowerCase() && (
                    <div className="transfer-section">
                      <h4>Transfer Ownership</h4>
                      <div className="form-row">
                        <input
                          value={transferTo}
                          onChange={e => setTransferTo(e.target.value)}
                          placeholder="New owner address (0x...)"
                        />
                        <button className="btn btn-secondary" onClick={transferOwnership}>
                          Transfer
                        </button>
                      </div>
                      {transferStatus && (
                        <p className={msgClass(transferStatus)}>{transferStatus}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Register New Product (Farmer only) ── */}
            {isFarmer && (
              <section className="card">
                <div className="card-header">
                  <div className="card-icon card-icon-green">🌱</div>
                  <span className="card-title">Register New Product</span>
                </div>
                <div className="form-row">
                  <input
                    value={regName}
                    onChange={e => { setRegName(e.target.value); clearOtherResults("register"); }}
                    placeholder="Product name (e.g. Romaine Lettuce Batch #412)"
                  />
                  <input
                    value={regOrigin}
                    onChange={e => { setRegOrigin(e.target.value); clearOtherResults("register"); }}
                    placeholder="Origin (e.g. Green Valley Farm, Yuma, AZ)"
                  />
                  <button className="btn btn-primary" onClick={registerProduct}>
                    Register
                  </button>
                </div>
                {regStatus && <p className={msgClass(regStatus)}>{regStatus}</p>}
                {newProductId && (
                  <div className="qr-section" style={{ marginTop: "16px" }}>
                    <QRCodeSVG
                      value={`${window.location.origin}/product/${newProductId}`}
                      size={156}
                    />
                    <span className="qr-label">
                      Product #{newProductId} registered — scan to view
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* ── Add Checkpoint (Farmer or Handler) ── */}
            {(isFarmer || isHandler) && (
              <section className="card">
                <div className="card-header">
                  <div className="card-icon card-icon-amber">📍</div>
                  <span className="card-title">Add Checkpoint</span>
                </div>
                <div className="form-row">
                  <input
                    value={cpId}
                    onChange={e => { setCpId(e.target.value); clearOtherResults("checkpoint"); }}
                    placeholder="Product ID"
                  />
                  <button className="btn btn-secondary" onClick={loadProductForCheckpoint}>
                    Load Product
                  </button>
                </div>

                {cpCurrentStatus !== null && (
                  <>
                    <p className="msg msg-success" style={{ marginTop: "12px" }}>
                      Current status: {STATUS_LABELS[cpCurrentStatus]}
                    </p>
                    <div className="form-row" style={{ marginTop: "12px" }}>
                      <select value={cpStatus} onChange={e => setCpStatus(e.target.value)}>
                        <option value="">Select next status</option>
                        {STATUS_LABELS.slice(cpCurrentStatus + 1).map((label, i) => (
                          <option key={i} value={cpCurrentStatus + 1 + i}>{label}</option>
                        ))}
                      </select>
                      <input
                        value={cpLocation}
                        onChange={e => setCpLocation(e.target.value)}
                        placeholder="Location"
                      />
                      <input
                        value={cpDetails}
                        onChange={e => setCpDetails(e.target.value)}
                        placeholder="Details"
                      />
                      <button className="btn btn-primary" onClick={addCheckpoint}>
                        Add Checkpoint
                      </button>
                    </div>
                  </>
                )}
                {cpTxStatus && <p className={msgClass(cpTxStatus)}>{cpTxStatus}</p>}
              </section>
            )}

            {/* ── Grant Role (Admin only) ── */}
            {isAdmin && (
              <section className="card card-admin">
                <div className="card-header">
                  <div className="card-icon card-icon-purple">🔑</div>
                  <span className="card-title">Grant Role</span>
                  <span className="admin-badge">Admin</span>
                </div>
                <div className="form-row">
                  <input
                    value={grantAddress}
                    onChange={e => setGrantAddress(e.target.value)}
                    placeholder="Wallet address to grant role to (0x...)"
                  />
                  <select value={grantRoleType} onChange={e => setGrantRoleType(e.target.value)}>
                    <option value="">Select role</option>
                    <option value="admin">Admin</option>
                    <option value="farmer">Farmer</option>
                    <option value="handler">Handler</option>
                  </select>
                  <button className="btn btn-admin" onClick={grantRoleToAddress}>
                    Grant Role
                  </button>
                </div>
                {grantStatus && <p className={msgClass(grantStatus)}>{grantStatus}</p>}
              </section>
            )}

          </div>
        )}
      </main>
    </div>
  );
}

export default App;

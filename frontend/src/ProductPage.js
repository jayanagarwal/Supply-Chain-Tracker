import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import deployment from "./deployment.json";
import "./App.css";

const STATUS_LABELS = ["Registered", "Processed", "Shipped", "Distributed", "Retail"];

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

function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [product, setProduct] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function connectAndLoad() {
    setError("");
    setLoading(true);
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

      const p = await c.getProduct(Number(id));
      const cps = await c.getCheckpoints(Number(id));

      setAccount(address);
      setProduct(p);
      setCheckpoints(cps);
    } catch (e) {
      setError("Product not found or connection failed.");
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (window.ethereum) connectAndLoad();
  }, []);

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
          <button className="header-back" onClick={() => navigate("/")}>
            ← Back
          </button>
        </div>
      </header>

      <main className="main">
        {loading && (
          <div className="loading-wrap">
            <div className="spinner" />
            Loading product #{id}...
          </div>
        )}

        {!loading && !account && !error && (
          <div className="connect-hero">
            <div className="connect-card">
              <div className="connect-logo">🥬</div>
              <h1>Leafy Greens</h1>
              <p className="connect-subtitle">Product #{id}</p>
              <p className="connect-tagline">
                Connect your wallet to view this product's full supply chain
                history on the Ethereum blockchain.
              </p>
              <button className="btn btn-connect" onClick={connectAndLoad}>
                Connect MetaMask
              </button>
              <p className="connect-hint">
                Requires MetaMask with the Hardhat or Sepolia network configured.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="container">
            <div className="card">
              <p className="msg msg-error">{error}</p>
            </div>
          </div>
        )}

        {product && (
          <div className="container">
            <section className="card">
              <div className="card-header">
                <div className="card-icon card-icon-green">📦</div>
                <span className="card-title">Product #{id} — Chain of Custody</span>
              </div>

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
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default ProductPage;

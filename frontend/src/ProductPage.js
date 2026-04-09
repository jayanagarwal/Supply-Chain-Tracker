import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import deployment from "./deployment.json";

const STATUS_LABELS = ["Registered", "Processed", "Shipped", "Distributed", "Retail"];

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
          params: [{ chainId: "0x7A69" }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x7A69",
              chainName: "Hardhat Localhost",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["http://127.0.0.1:8545"],
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
    <div>
      <button onClick={() => navigate("/")}>← Back</button>
      <h2>Product #{id}</h2>

      {!account && !loading && (
        <div>
          <p>Connect your wallet to view this product's supply chain history.</p>
          <button onClick={connectAndLoad}>Connect MetaMask</button>
        </div>
      )}

      {loading && <p>Loading...</p>}
      {error && <p style={{color:"red"}}>{error}</p>}

      {product && (
        <div>
          <h3>{product.name}</h3>
          <p>Origin: {product.origin}</p>
          <p>Status: {STATUS_LABELS[Number(product.currentStatus)]}</p>
          <p>Current Owner: {product.currentOwner}</p>

          <h4>Checkpoint History</h4>
          {checkpoints.length === 0 && <p>No checkpoints recorded yet.</p>}
          {checkpoints.map((cp, i) => (
            <div key={i}>
              <b>{STATUS_LABELS[Number(cp.status)]}</b> — {cp.location}<br/>
              {cp.details}<br/>
              <small>{new Date(Number(cp.timestamp) * 1000).toLocaleString()}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductPage;

import { useState } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import deployment from "./deployment.json";

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

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [isFarmer, setIsFarmer] = useState(false);
  const [isHandler, setIsHandler] = useState(false);

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
          params: [{ chainId: "0x7A69" }],
        });
      } catch (switchError) {
        // Chain not added to MetaMask yet — add it
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

      const FARMER_ROLE = await c.FARMER_ROLE();
      const HANDLER_ROLE = await c.HANDLER_ROLE();

      setAccount(address);
      setContract(c);
      setIsFarmer(await c.hasRole(FARMER_ROLE, address));
      setIsHandler(await c.hasRole(HANDLER_ROLE, address));
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
    if (!regName)                    { setRegStatus("Please enter a product name.");                return; }
    if (regName.trim().length < 3)   { setRegStatus("Product name must be at least 3 characters."); return; }
    if (regName.trim().length > 100) { setRegStatus("Product name must be 100 characters or fewer."); return; }
    if (!regOrigin)                  { setRegStatus("Please enter the origin.");                    return; }
    if (regOrigin.trim().length < 3)   { setRegStatus("Origin must be at least 3 characters.");    return; }
    if (regOrigin.trim().length > 150) { setRegStatus("Origin must be 150 characters or fewer.");  return; }
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
    if (!cpStatus)                      { setCpTxStatus("Please select a status.");                    return; }
    if (!cpLocation)                    { setCpTxStatus("Please enter a location.");                   return; }
    if (cpLocation.trim().length < 3)   { setCpTxStatus("Location must be at least 3 characters.");   return; }
    if (cpLocation.trim().length > 150) { setCpTxStatus("Location must be 150 characters or fewer."); return; }
    if (!cpDetails)                     { setCpTxStatus("Please enter details.");                      return; }
    if (cpDetails.trim().length < 3)    { setCpTxStatus("Details must be at least 3 characters.");    return; }
    if (cpDetails.trim().length > 200)  { setCpTxStatus("Details must be 200 characters or fewer.");  return; }
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

  return (
    <div>
      {account ? (
        <p>Connected: {account} {isFarmer ? "(Farmer)" : isHandler ? "(Handler)" : "(No role)"}</p>
      ) : (
        <button onClick={connectWallet}>Connect MetaMask</button>
      )}

      {contract && (
        <div>
          <h3>Look Up Product</h3>
          <input value={lookupId} onChange={e => setLookupId(e.target.value)} placeholder="Product ID" />
          <button onClick={lookupProduct}>Look Up</button>
          {lookupError && <p style={{color:"red"}}>{lookupError}</p>}

          {product && (
            <div>
              <h3>{product.name}</h3>
              <p>Origin: {product.origin}</p>
              <p>Status: {STATUS_LABELS[Number(product.currentStatus)]}</p>
              <p>Owner: {product.currentOwner}</p>
              <h4>Checkpoint History</h4>
              {checkpoints.map((cp, i) => (
                <div key={i}>
                  <b>{STATUS_LABELS[Number(cp.status)]}</b> — {cp.location}<br/>
                  {cp.details}<br/>
                  <small>{new Date(Number(cp.timestamp) * 1000).toLocaleString()}</small>
                </div>
              ))}

              <h4>QR Code</h4>
              <QRCodeSVG value={`${window.location.origin}/product/${lookupId}`} size={160} />
              <p><small>Scan to view product #{lookupId}</small></p>

              {product.currentOwner.toLowerCase() === account?.toLowerCase() && (
                <div>
                  <h4>Transfer Ownership</h4>
                  <input
                    value={transferTo}
                    onChange={e => setTransferTo(e.target.value)}
                    placeholder="New owner address (0x...)"
                  />
                  <button onClick={transferOwnership}>Transfer</button>
                  {transferStatus && <p style={{color: transferStatus.startsWith("Ownership") ? "green" : "red"}}>{transferStatus}</p>}
                </div>
              )}
            </div>
          )}

          {isFarmer && (
            <div>
              <h3>Register New Product</h3>
              <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Product name" />
              <input value={regOrigin} onChange={e => setRegOrigin(e.target.value)} placeholder="Origin" />
              <button onClick={registerProduct}>Register</button>
              {regStatus && <p style={{color: regStatus.startsWith("Registered") ? "green" : "red"}}>{regStatus}</p>}
              {newProductId && (
                <div>
                  <p>QR Code for Product #{newProductId}:</p>
                  <QRCodeSVG value={`${window.location.origin}/product/${newProductId}`} size={160} />
                  <p><small>Scan to view product #{newProductId}</small></p>
                </div>
              )}
            </div>
          )}

          {(isFarmer || isHandler) && (
            <div>
              <h3>Add Checkpoint</h3>
              <input value={cpId} onChange={e => setCpId(e.target.value)} placeholder="Product ID" />
              <button onClick={loadProductForCheckpoint}>Load Product</button>

              {cpCurrentStatus !== null && (
                <>
                  <p>Current status: {STATUS_LABELS[cpCurrentStatus]}</p>
                  <select value={cpStatus} onChange={e => setCpStatus(e.target.value)}>
                    <option value="">Select next status</option>
                    {STATUS_LABELS.slice(cpCurrentStatus + 1).map((label, i) => (
                      <option key={i} value={cpCurrentStatus + 1 + i}>{label}</option>
                    ))}
                  </select>
                  <input value={cpLocation} onChange={e => setCpLocation(e.target.value)} placeholder="Location" />
                  <input value={cpDetails} onChange={e => setCpDetails(e.target.value)} placeholder="Details" />
                  <button onClick={addCheckpoint}>Add Checkpoint</button>
                </>
              )}
              {cpTxStatus && <p style={{color: cpTxStatus.startsWith("Checkpoint") ? "green" : "red"}}>{cpTxStatus}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;

import React from 'react';
import styles from './WalletConnect.module.css';

async function walletRequest(provider, method, params) {
  // Wallet providers differ between string and EIP-1193 object request signatures.
  try {
    return await provider.request(method, params);
  } catch {
    return provider.request({ method, params });
  }
}

export default function WalletConnect({ walletAddress, onConnect }) {
  async function handleConnect() {
    try {
      const provider = window.LeatherProvider || window.StacksProvider || window.XverseProviders?.StacksProvider;
      if (!provider) {
        alert('Please install Leather (leather.io) or Xverse (xverse.app) wallet to continue.');
        return;
      }

      const response = await walletRequest(provider, 'getAddresses');
      const addresses = response?.result?.addresses || response?.addresses || [];
      const stxAddr = addresses.find(
        a => a.symbol === 'STX' || a.address?.startsWith('SP') || a.address?.startsWith('SM')
      );

      if (!stxAddr) {
        alert('Could not find STX address. Make sure your wallet is set to Mainnet.');
        return;
      }

      onConnect(stxAddr.address);
    } catch (e) {
      console.error('Wallet connect error:', e);
    }
  }

  if (walletAddress) {
    return (
      <div className={styles.connected}>
        <span className={styles.dot} />
        {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
        <span className={styles.badge}>Connected</span>
      </div>
    );
  }

  return (
    <button className={styles.connectBtn} onClick={handleConnect}>
      Connect Wallet
    </button>
  );
}

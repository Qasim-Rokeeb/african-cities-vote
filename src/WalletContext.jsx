import React, { createContext, useContext, useState } from 'react';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);

  async function connectWallet() {
    const provider = window.LeatherProvider || window.StacksProvider || window.XverseProviders?.StacksProvider;
    if (!provider) {
      alert('Please install Leather (leather.io) or Xverse (xverse.app) to continue.');
      return null;
    }
    try {
      const response = await provider.request('getAddresses');
      const addresses = response?.result?.addresses || response?.addresses || [];
      const stxAddr = addresses.find(
        a => a.symbol === 'STX' || a.address?.startsWith('SP') || a.address?.startsWith('SM')
      );
      if (!stxAddr) {
        alert('Could not find STX address. Make sure your wallet is set to Mainnet.');
        return null;
      }
      setWalletAddress(stxAddr.address);
      return stxAddr.address;
    } catch (e) {
      console.error('Wallet connect error:', e);
      return null;
    }
  }

  function disconnectWallet() {
    setWalletAddress(null);
  }

  return (
    <WalletContext.Provider value={{ walletAddress, connectWallet, disconnectWallet }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}

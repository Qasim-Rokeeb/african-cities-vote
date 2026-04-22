import React, { createContext, useContext, useState } from 'react';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4500);
  };

  async function connectWallet() {
    setIsConnecting(true);
    const provider = window.LeatherProvider || window.StacksProvider || window.XverseProviders?.StacksProvider;
    if (!provider) {
      showToast('Please install Leather (leather.io) or Xverse (xverse.app) to continue.');
      setIsConnecting(false);
      return null;
    }
    try {
      const response = await provider.request('getAddresses');
      const addresses = response?.result?.addresses || response?.addresses || [];
      const stxAddr = addresses.find(
        a => a.symbol === 'STX' || a.address?.startsWith('SP') || a.address?.startsWith('SM')
      );
      if (!stxAddr) {
        showToast('Could not find STX address. Make sure your wallet is set to Mainnet.');
        setIsConnecting(false);
        return null;
      }
      setWalletAddress(stxAddr.address);
      setIsConnecting(false);
      return stxAddr.address;
    } catch (e) {
      console.error('Wallet connect error:', e);
      setIsConnecting(false);
      return null;
    }
  }

  function disconnectWallet() {
    setWalletAddress(null);
  }

  return (
    <WalletContext.Provider value={{ walletAddress, isConnecting, connectWallet, disconnectWallet }}>
      {children}
      {toastMsg && (
        <div className="toast" role="alert">
          {toastMsg}
        </div>
      )}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}

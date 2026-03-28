import React from 'react';
import { useWallet } from '../WalletContext';
import styles from './Navbar.module.css';

export default function Navbar({ activePollIndex, onNavigate }) {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();

  return (
    <nav className={styles.nav}>
      <div className={styles.brand} onClick={() => onNavigate(-1)}>
        <span className={styles.brandIcon}>🌍</span>
        <span className={styles.brandName}>Africa Tech Votes</span>
      </div>

      <div className={styles.wallet}>
        {walletAddress ? (
          <div className={styles.connected} onClick={disconnectWallet} title="Click to disconnect">
            <span className={styles.dot} />
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </div>
        ) : (
          <button className={styles.connectBtn} onClick={connectWallet}>
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}

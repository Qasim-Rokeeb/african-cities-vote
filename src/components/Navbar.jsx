import React from 'react';
import { useWallet } from '../WalletContext';
import styles from './Navbar.module.css';

export default function Navbar({ activePollIndex, totalPolls, onNavigate }) {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();
  const isHome = activePollIndex === -1;
  const locationLabel = isHome ? 'Home' : `Poll ${activePollIndex + 1}`;
  const progress = isHome ? 0 : Math.round(((activePollIndex + 1) / totalPolls) * 100);

  return (
    <nav className={styles.nav}>
      <div
        className={styles.brand}
        onClick={() => onNavigate(-1)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onNavigate(-1)}
      >
        <span className={styles.brandIcon}>🌍</span>
        <span className={styles.brandName}>Africa Tech Votes</span>
      </div>

      <div className={styles.centerInfo}>
        <span className={styles.locationBadge}>{locationLabel}</span>
        <div className={styles.progressTrack} aria-label="Voting flow progress">
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
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

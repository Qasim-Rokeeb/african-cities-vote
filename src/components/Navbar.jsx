import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '../WalletContext';
import { POLLS, fetchVoteCounts, mapVotesToOptions } from '../stacksUtils';
import styles from './Navbar.module.css';

export default function Navbar({ activePollIndex, totalPolls, onNavigate }) {
  const { walletAddress, connectWallet, disconnectWallet } = useWallet();
  const [isScrolled, setIsScrolled] = useState(false);
  const [recentVotes, setRecentVotes] = useState(0);
  const [showLivePulse, setShowLivePulse] = useState(false);
  const lastTotalVotesRef = useRef(null);
  const voteDeltasRef = useRef([]);
  const pulseTimerRef = useRef(null);
  const isHome = activePollIndex === -1;
  const locationLabel = isHome ? 'Home' : `Poll ${activePollIndex + 1}`;
  const progress = isHome ? 0 : Math.round(((activePollIndex + 1) / totalPolls) * 100);

  const loadRecentVotes = useCallback(async () => {
    try {
      const totals = await Promise.all(
        POLLS.map(async poll => {
          const raw = await fetchVoteCounts(poll.id);
          if (!raw) return null;
          const mapped = mapVotesToOptions(raw, poll.options);
          return Object.values(mapped).reduce((sum, votes) => sum + votes, 0);
        })
      );

      if (totals.some(total => total == null)) return;

      const now = Date.now();
      const totalVotes = totals.reduce((sum, total) => sum + total, 0);
      const previousTotal = lastTotalVotesRef.current;

      let nextDeltas = voteDeltasRef.current.filter(entry => now - entry.at <= 60000);

      if (previousTotal != null && totalVotes > previousTotal) {
        const delta = totalVotes - previousTotal;
        nextDeltas = [...nextDeltas, { at: now, count: delta }];

        setShowLivePulse(true);
        if (pulseTimerRef.current) {
          clearTimeout(pulseTimerRef.current);
        }
        pulseTimerRef.current = setTimeout(() => {
          setShowLivePulse(false);
        }, 750);
      }

      voteDeltasRef.current = nextDeltas;
      setRecentVotes(nextDeltas.reduce((sum, entry) => sum + entry.count, 0));
      lastTotalVotesRef.current = totalVotes;
    } catch {
      // Keep last known values if live reads fail temporarily.
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    loadRecentVotes();
    const intervalId = setInterval(loadRecentVotes, 12000);

    return () => {
      clearInterval(intervalId);
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, [loadRecentVotes]);

  return (
    <nav className={`${styles.nav} ${isScrolled ? styles.navScrolled : ''}`.trim()}>
      <div
        className={`${styles.brand} ${isHome ? styles.brandActive : ''}`.trim()}
        onClick={() => onNavigate(-1)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onNavigate(-1)}
      >
        <span className={styles.brandIcon}>🌍</span>
        <span className={styles.brandName}>Africa Tech Votes</span>
      </div>

      <div className={styles.centerInfo}>
        <span className={`${styles.locationBadge} ${!isHome ? styles.locationBadgeActive : ''}`.trim()}>{locationLabel}</span>
        <div className={styles.progressTrack} aria-label="Voting flow progress">
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.liveVotes} aria-live="polite">
          <span className={`${styles.liveDot} ${showLivePulse ? styles.liveDotActive : ''}`.trim()} aria-hidden="true" />
          <span>{recentVotes} votes in last 60s</span>
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

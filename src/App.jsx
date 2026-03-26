import React, { useState, useEffect, useCallback } from 'react';
import styles from './App.module.css';
import WalletConnect from './components/WalletConnect';
import CityCard from './components/CityCard';
import StatusMessage from './components/StatusMessage';
import {
  CITIES,
  CONTRACT_ADDRESS,
  CONTRACT_NAME,
  NETWORK,
  fetchVoteCounts,
  checkHasVoted,
  encodeStringAsciiCV,
} from './stacksUtils';

async function walletRequest(provider, method, params) {
  // Wallet providers differ between string and EIP-1193 object request signatures.
  try {
    return await provider.request(method, params);
  } catch {
    return provider.request({ method, params });
  }
}

export default function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [selectedCity,  setSelectedCity]  = useState(null);
  const [votes,         setVotes]         = useState(null); // { lagos, nairobi, accra, cairo }
  const [hasVoted,      setHasVoted]      = useState(false);
  const [status,        setStatus]        = useState({ message: '', type: '' });
  const [isVoting,      setIsVoting]      = useState(false);

  // ── Load votes on mount + refresh every 30s ───────────────────────────────
  const loadVotes = useCallback(async () => {
    try {
      const counts = await fetchVoteCounts();
      if (counts) setVotes(counts);
    } catch (e) {
      console.warn('Failed to fetch votes:', e);
    }
  }, []);

  useEffect(() => {
    loadVotes();
    const interval = setInterval(loadVotes, 30_000);
    return () => clearInterval(interval);
  }, [loadVotes]);

  // ── Handle wallet connect ─────────────────────────────────────────────────
  async function handleConnect(address) {
    setWalletAddress(address);
    setStatus({ message: '', type: '' });

    const voted = await checkHasVoted(address);
    if (voted) {
      setHasVoted(true);
      setStatus({
        message: 'This wallet has already voted. Connect a different wallet to vote again.',
        type: 'error',
      });
    }
  }

  // ── Handle city selection ─────────────────────────────────────────────────
  function handleSelectCity(cityId) {
    if (hasVoted || isVoting) return;
    setSelectedCity(cityId);
    setStatus({ message: '', type: '' });
  }

  // ── Cast vote ─────────────────────────────────────────────────────────────
  async function castVote() {
    if (!walletAddress || !selectedCity || hasVoted || isVoting) return;

    const provider = window.LeatherProvider || window.StacksProvider || window.XverseProviders?.StacksProvider;
    if (!provider) {
      setStatus({ message: 'Wallet not connected. Please refresh and try again.', type: 'error' });
      return;
    }

    setIsVoting(true);
    setStatus({ message: `Opening wallet to vote for ${selectedCity}...`, type: 'loading' });

    try {
      const cityCV = encodeStringAsciiCV(selectedCity);

      let result;
      try {
        result = await walletRequest(provider, 'stx_callContract', {
          contract: `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
          functionName: 'vote',
          functionArgs: [cityCV],
          network: NETWORK,
          postConditions: [],
        });
      } catch {
        // Backward-compatibility payload for older wallet provider implementations.
        result = await walletRequest(provider, 'stx_callContract', {
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName: 'vote',
          functionArgs: [cityCV],
          network: NETWORK,
          postConditions: [],
        });
      }

      const txid = result?.result?.txid || result?.txid;
      if (txid) {
        setHasVoted(true);
        setStatus({
          message: `✓ Vote cast for <strong>${selectedCity}</strong>! 
            <a href="https://explorer.hiro.so/txid/${txid}?chain=mainnet" target="_blank" rel="noreferrer">
              View TX ↗
            </a> — confirms in ~10 min.`,
          type: 'success',
        });
        setTimeout(loadVotes, 5000);
      } else {
        setStatus({ message: 'Transaction was cancelled or failed.', type: 'error' });
      }
    } catch (e) {
      const walletMsg = e?.message || e?.error || '';
      const isCancelled = /cancel|reject|denied|aborted/i.test(String(walletMsg));
      setStatus({
        message: isCancelled
          ? 'Transaction cancelled in wallet.'
          : `Error: ${walletMsg || 'Transaction failed.'}`,
        type: 'error',
      });
    } finally {
      setIsVoting(false);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const totalVotes = votes
    ? Object.values(votes).reduce((a, b) => a + b, 0)
    : 0;

  const cardsDisabled = hasVoted || isVoting || !walletAddress;

  const voteButtonLabel = () => {
    if (!walletAddress)  return 'Connect wallet first';
    if (hasVoted)        return 'Already Voted ✓';
    if (isVoting)        return 'Confirm in wallet...';
    if (!selectedCity)   return 'Select a city to vote';
    return `Vote for ${CITIES.find(c => c.id === selectedCity)?.label} →`;
  };

  const voteButtonDisabled = !walletAddress || !selectedCity || hasVoted || isVoting;

  return (
    <div className={styles.page}>
      {/* Background blobs */}
      <div className={styles.blob1} />
      <div className={styles.blob2} />

      <div className={styles.container}>

        {/* Header */}
        <header className={styles.header}>
          <p className={styles.eyebrow}>On-chain · Stacks Mainnet</p>
          <h1 className={styles.title}>
            Which African City<br />
            <span className={styles.titleAccent}>Reigns Supreme?</span>
          </h1>
          <p className={styles.subtitle}>
            Cast your vote. One wallet, one voice.<br />
            Results live on the blockchain forever.
          </p>
        </header>

        {/* Wallet */}
        <div className={styles.walletRow}>
          <WalletConnect walletAddress={walletAddress} onConnect={handleConnect} />
        </div>

        {/* Divider */}
        <div className={styles.divider}>
          <span>Cast Your Vote</span>
        </div>

        {/* City cards grid */}
        <div className={styles.grid}>
          {CITIES.map(city => (
            <CityCard
              key={city.id}
              city={city}
              votes={votes ? votes[city.id] : null}
              totalVotes={totalVotes}
              selected={selectedCity === city.id}
              disabled={cardsDisabled}
              onSelect={handleSelectCity}
            />
          ))}
        </div>

        {/* Status */}
        <StatusMessage message={status.message} type={status.type} />

        {/* Vote button */}
        <button
          className={styles.voteBtn}
          onClick={castVote}
          disabled={voteButtonDisabled}
        >
          {voteButtonLabel()}
        </button>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerTop}>
            <p className={styles.footerKicker}>Built for the Stacks Builder Challenge</p>
            <p className={styles.footerLead}>On-chain voting for Africa's most iconic city</p>
          </div>

          <div className={styles.footerMetaRow}>
            <div className={styles.contractBlock}>
              <span className={styles.metaLabel}>Contract</span>
              <a
                className={styles.contractLink}
                href={`https://explorer.hiro.so/txid/${CONTRACT_ADDRESS}.${CONTRACT_NAME}?chain=mainnet`}
                target="_blank"
                rel="noreferrer"
              >
                {CONTRACT_ADDRESS.slice(0, 12)}...{CONTRACT_NAME} ↗
              </a>
            </div>

            <div className={styles.networkChip}>Stacks Mainnet</div>
          </div>

          <div className={styles.footerBottom}>
            <p className={styles.footerNote}>Powered by Stacks · Every vote is a permanent transaction.</p>
            {totalVotes > 0 && (
              <p className={styles.totalVotes}>{totalVotes} total vote{totalVotes !== 1 ? 's' : ''} cast</p>
            )}
          </div>
        </footer>

      </div>
    </div>
  );
}

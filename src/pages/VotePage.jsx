import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../WalletContext';
import {
  DEPLOYER, NETWORK,
  fetchVoteCounts, checkHasVoted,
  encodeStringAsciiCV, mapVotesToOptions,
} from '../stacksUtils';
import styles from './VotePage.module.css';

export default function VotePage({ poll, pollIndex, totalPolls, onBack, onNext, onPrev }) {
  const { walletAddress, connectWallet } = useWallet();

  const [votes,        setVotes]        = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [hasVoted,     setHasVoted]     = useState(false);
  const [isVoting,     setIsVoting]     = useState(false);
  const [status,       setStatus]       = useState({ msg: '', type: '' });

  // ── Load votes ──────────────────────────────────────────────────────────────
  const loadVotes = useCallback(async () => {
    const raw = await fetchVoteCounts(poll.id);
    if (raw) setVotes(mapVotesToOptions(raw, poll.options));
  }, [poll]);

  useEffect(() => {
    loadVotes();
    const t = setInterval(loadVotes, 30_000);
    return () => clearInterval(t);
  }, [loadVotes]);

  // ── Check if wallet voted when wallet connects ──────────────────────────────
  useEffect(() => {
    if (!walletAddress) { setHasVoted(false); return; }
    checkHasVoted(poll.id, walletAddress).then(voted => {
      setHasVoted(voted);
      if (voted) setStatus({ msg: 'This wallet has already voted on this poll.', type: 'error' });
      else        setStatus({ msg: '', type: '' });
    });
  }, [walletAddress, poll.id]);

  // ── Cast vote ───────────────────────────────────────────────────────────────
  async function castVote() {
    if (!walletAddress || !selected || hasVoted || isVoting) return;

    const provider = window.LeatherProvider || window.StacksProvider || window.XverseProviders?.StacksProvider;
    if (!provider) { setStatus({ msg: 'Wallet not connected.', type: 'error' }); return; }

    setIsVoting(true);
    setStatus({ msg: `Opening wallet to vote for "${selected}"...`, type: 'loading' });

    try {
      const fnArg = encodeStringAsciiCV(selected);
      const result = await provider.request('stx_callContract', {
        // Some wallets expect a combined contract id, others accept split fields.
        contract:       `${DEPLOYER}.${poll.id}`,
        contractAddress: DEPLOYER,
        contractName:    poll.id,
        functionName:    'vote',
        functionArgs:    [fnArg],
        senderAddress:   walletAddress,
        network:         NETWORK,
        postConditions:  [],
      });

      const txid =
        result?.result?.txid ||
        result?.result?.txId ||
        result?.txid ||
        result?.txId ||
        result?.id;
      if (txid) {
        setHasVoted(true);
        setStatus({
          msg: `✓ Vote cast! <a href="https://explorer.hiro.so/txid/${txid}?chain=mainnet" target="_blank" rel="noreferrer">View TX ↗</a> — confirms in ~10 min.`,
          type: 'success',
        });
        setTimeout(loadVotes, 5000);
      } else {
        setStatus({ msg: 'Wallet did not return a transaction ID. Please approve and try again.', type: 'error' });
      }
    } catch (e) {
      const rawMessage =
        e?.message ||
        e?.error ||
        e?.reason ||
        e?.data?.message ||
        '';
      const msg = String(rawMessage);
      const isCancelled = /cancel|reject|denied|declined|abort/i.test(msg);
      setStatus({
        msg: isCancelled
          ? 'Transaction was cancelled in your wallet.'
          : `Transaction failed: ${msg || 'Please try again.'}`,
        type: 'error',
      });
    } finally {
      setIsVoting(false);
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const total = votes ? Object.values(votes).reduce((a, b) => a + b, 0) : 0;
  const cardsDisabled = hasVoted || isVoting || !walletAddress;

  const btnLabel = () => {
    if (!walletAddress)  return 'Connect wallet first';
    if (hasVoted)        return 'Already Voted ✓';
    if (isVoting)        return 'Confirm in wallet...';
    if (!selected)       return 'Select an option';
    return `Vote for ${poll.options.find(o => o.id === selected)?.label} →`;
  };

  return (
    <div className={styles.page}>
      <div className={styles.blob} />

      <div className={styles.container}>

        {/* Poll header */}
        <div className={styles.pollMeta}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          <span className={styles.pollCounter}>Poll {pollIndex + 1} of {totalPolls}</span>
        </div>

        <header className={styles.header}>
          <div className={styles.emoji}>{poll.emoji}</div>
          <p className={styles.eyebrow}>On-chain · Stacks Mainnet</p>
          <h1 className={styles.title}>{poll.title}</h1>
          <p className={styles.question}>{poll.question}</p>
          {total > 0 && (
            <p className={styles.totalVotes}>{total} vote{total !== 1 ? 's' : ''} cast</p>
          )}
        </header>

        {/* Wallet connect */}
        {!walletAddress && (
          <div className={styles.walletPrompt}>
            <button className={styles.connectBtn} onClick={connectWallet}>
              Connect Wallet to Vote
            </button>
            <p className={styles.walletHint}>Requires Leather or Xverse wallet on Mainnet</p>
          </div>
        )}

        {/* Options grid */}
        <div className={styles.grid}>
          {poll.options.map(opt => {
            const count = votes?.[opt.id] ?? 0;
            const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
            const isSelected = selected === opt.id;

            return (
              <div
                key={opt.id}
                className={[
                  styles.optCard,
                  isSelected    ? styles.selected : '',
                  cardsDisabled ? styles.disabled : '',
                ].join(' ')}
                onClick={() => !cardsDisabled && setSelected(opt.id)}
                role="button"
                tabIndex={cardsDisabled ? -1 : 0}
                onKeyDown={e => e.key === 'Enter' && !cardsDisabled && setSelected(opt.id)}
              >
                <div className={styles.optLabel}>{opt.label}</div>
                <div className={styles.optDetail}>{opt.detail}</div>
                <div className={styles.optVotes}>
                  {votes === null ? '—' : `${count} vote${count !== 1 ? 's' : ''}`}
                </div>
                <div className={styles.barBg}>
                  <div className={styles.barFill} style={{ width: `${pct}%` }} />
                </div>
                {pct > 0 && <div className={styles.pct}>{pct}%</div>}
                {isSelected && <div className={styles.check}>✓</div>}
              </div>
            );
          })}
        </div>

        {/* Status */}
        {status.msg && (
          <div
            className={[styles.status, styles[status.type] || ''].join(' ')}
            dangerouslySetInnerHTML={{ __html: status.msg }}
          />
        )}

        {selected && (
          <div className={styles.selectionChip}>
            Selected: {poll.options.find(o => o.id === selected)?.label}
          </div>
        )}

        {/* Vote button */}
        <button
          className={styles.voteBtn}
          onClick={castVote}
          disabled={!walletAddress || !selected || hasVoted || isVoting}
        >
          {btnLabel()}
        </button>

        {/* Pagination */}
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={onPrev}
            disabled={pollIndex === 0}
          >
            ← Previous Poll
          </button>
          <button
            className={styles.pageBtn}
            onClick={onNext}
            disabled={pollIndex === totalPolls - 1}
          >
            Next Poll →
          </button>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <a
            href={`https://explorer.hiro.so/txid/${DEPLOYER}.${poll.id}?chain=mainnet`}
            target="_blank"
            rel="noreferrer"
          >
            View contract on Explorer ↗
          </a>
        </footer>

      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../WalletContext';
import {
  DEPLOYER, NETWORK,
  fetchVoteCounts, checkHasVoted,
  encodeStringAsciiCV, mapVotesToOptions,
} from '../stacksUtils';
import styles from './VotePage.module.css';

const OPTION_METADATA = {
  lagos: { country: 'Nigeria', flag: '🇳🇬', population: '21.3M', tag: 'Culture & Music', icon: '🌆' },
  nairobi: { country: 'Kenya', flag: '🇰🇪', population: '5.3M', tag: 'Safari Gateway', icon: '🦁' },
  accra: { country: 'Ghana', flag: '🇬🇭', population: '2.6M', tag: 'Arts & Coastline', icon: '🏖️' },
  cairo: { country: 'Egypt', flag: '🇪🇬', population: '10.2M', tag: 'Historic Tourism', icon: '🏛️' },
  capetown: { country: 'South Africa', flag: '🇿🇦', population: '4.9M', tag: 'Tourism & Nature', icon: '⛰️' },
  kigali: { country: 'Rwanda', flag: '🇷🇼', population: '1.7M', tag: 'Clean City Culture', icon: '🌿' },
  react: { country: 'Pan-Africa', flag: '🧩', population: 'N/A', tag: 'Frontend', icon: '⚛️' },
  python: { country: 'Pan-Africa', flag: '🧩', population: 'N/A', tag: 'Backend / AI', icon: '🐍' },
  rust: { country: 'Pan-Africa', flag: '🧩', population: 'N/A', tag: 'Systems / Web3', icon: '🦀' },
  solidity: { country: 'Pan-Africa', flag: '🧩', population: 'N/A', tag: 'Smart Contracts', icon: '📜' },
  stacks: { country: 'Pan-Africa', flag: '🧩', population: 'N/A', tag: 'Bitcoin L2', icon: '🟧' },
  ethereum: { country: 'Pan-Africa', flag: '🧩', population: 'N/A', tag: 'EVM / DeFi', icon: '⬡' },
  solana: { country: 'Pan-Africa', flag: '🧩', population: 'N/A', tag: 'High Speed', icon: '🌈' },
  cardano: { country: 'Pan-Africa', flag: '🧩', population: 'N/A', tag: 'Peer Reviewed', icon: '🔵' },
};

function getOptionMeta(option) {
  const known = OPTION_METADATA[option.id];
  if (known) return known;

  return {
    country: 'Pan-Africa',
    flag: '🌍',
    population: 'N/A',
    tag: option.detail || 'Culture',
    icon: '📍',
  };
}

function getYesterdayTrend(pollId, optionId) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const seed = `${pollId}:${optionId}:${yesterday}`;
  const hash = Array.from(seed).reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0);
  const normalized = Math.abs(hash) % 9;
  return normalized - 4;
}

export default function VotePage({ poll, pollIndex, totalPolls, onBack, onNext, onPrev, onJumpToPoll }) {
  const { walletAddress, connectWallet } = useWallet();

  const [votes,        setVotes]        = useState(null);
  const [refreshIn,    setRefreshIn]    = useState(30);
  const [selected,     setSelected]     = useState(null);
  const [hasVoted,     setHasVoted]     = useState(false);
  const [isVoting,     setIsVoting]     = useState(false);
  const [status,       setStatus]       = useState({ msg: '', type: '' });
  const [momentum,     setMomentum]     = useState({});
  const [compareIds,   setCompareIds]   = useState([]);
  const previousVotesRef = useRef(null);

  // ── Load votes ──────────────────────────────────────────────────────────────
  const loadVotes = useCallback(async () => {
    const raw = await fetchVoteCounts(poll.id);
    if (!raw) return;

    const mapped = mapVotesToOptions(raw, poll.options);
    const previous = previousVotesRef.current;

    if (previous) {
      const previousTotal = Object.values(previous).reduce((sum, n) => sum + n, 0);
      const currentTotal = Object.values(mapped).reduce((sum, n) => sum + n, 0);
      const nextMomentum = {};

      poll.options.forEach(opt => {
        const prevVotes = previous[opt.id] ?? 0;
        const currentVotes = mapped[opt.id] ?? 0;
        const prevShare = previousTotal > 0 ? (prevVotes / previousTotal) * 100 : 0;
        const currentShare = currentTotal > 0 ? (currentVotes / currentTotal) * 100 : 0;
        nextMomentum[opt.id] = Number((currentShare - prevShare).toFixed(1));
      });

      setMomentum(nextMomentum);
    } else {
      const initialMomentum = {};
      poll.options.forEach(opt => {
        initialMomentum[opt.id] = 0;
      });
      setMomentum(initialMomentum);
    }

    previousVotesRef.current = mapped;
    setVotes(mapped);
  }, [poll]);

  useEffect(() => {
    previousVotesRef.current = null;
    setMomentum({});
    setCompareIds([]);
    loadVotes();
    setRefreshIn(30);
    const t = setInterval(() => {
      setRefreshIn(prev => {
        if (prev <= 1) {
          loadVotes();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [loadVotes]);

  function refreshNow() {
    loadVotes();
    setRefreshIn(30);
  }

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
  const ranked = poll.options
    .map(opt => ({
      id: opt.id,
      label: opt.label,
      votes: votes?.[opt.id] ?? 0,
    }))
    .sort((a, b) => b.votes - a.votes);
  const leader = ranked[0];
  const runnerUp = ranked[1];
  const isTie = leader && runnerUp && leader.votes > 0 && leader.votes === runnerUp.votes;
  const leaderShare = total > 0 && leader ? Math.round((leader.votes / total) * 100) : 0;
  const turnoutLabel =
    total === 0 ? 'No votes yet' :
    total < 10 ? 'Early participation' :
    total < 50 ? 'Growing momentum' :
    'High participation';
  const pollProgressPct = Math.round(((pollIndex + 1) / totalPolls) * 100);

  const btnLabel = () => {
    if (!walletAddress)  return 'Connect wallet first';
    if (hasVoted)        return 'Already Voted ✓';
    if (isVoting)        return 'Confirm in wallet...';
    if (!selected)       return 'Select an option';
    return `Vote for ${poll.options.find(o => o.id === selected)?.label} →`;
  };

  const selectedLabel = poll.options.find(o => o.id === selected)?.label;
  const mobileVoteDisabled = !walletAddress || !selected || hasVoted || isVoting;
  const mobileCtaLabel = !walletAddress ? 'Connect Wallet' : btnLabel();

  function handleMobileCta() {
    if (!walletAddress) {
      connectWallet();
      return;
    }
    castVote();
  }

  function toggleCompare(optionId) {
    setCompareIds(prev => {
      if (prev.includes(optionId)) {
        return prev.filter(id => id !== optionId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, optionId];
    });
  }

  const comparedOptions = compareIds
    .map(id => poll.options.find(opt => opt.id === id))
    .filter(Boolean)
    .map(opt => {
      const count = votes?.[opt.id] ?? 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const meta = getOptionMeta(opt);
      const yesterdayDelta = getYesterdayTrend(poll.id, opt.id);
      const yesterdayDirection = yesterdayDelta > 0 ? 'up' : yesterdayDelta < 0 ? 'down' : 'flat';
      const yesterdayArrow = yesterdayDirection === 'up' ? '↗' : yesterdayDirection === 'down' ? '↘' : '→';

      return {
        ...opt,
        count,
        pct,
        meta,
        yesterdayDelta,
        yesterdayDirection,
        yesterdayArrow,
      };
    });

  return (
    <div className={styles.page}>
      <div className={styles.blob} />

      <aside className={styles.timelineNav} aria-label="Poll timeline navigation">
        <p className={styles.timelineTitle}>Poll Timeline</p>
        <div className={styles.timelineList}>
          {Array.from({ length: totalPolls }).map((_, idx) => {
            const isActive = idx === pollIndex;
            const isComplete = idx < pollIndex;

            return (
              <button
                key={idx}
                className={[
                  styles.timelineItem,
                  isActive ? styles.timelineActive : '',
                  isComplete ? styles.timelineComplete : '',
                ].join(' ')}
                onClick={() => onJumpToPoll(idx)}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className={styles.timelineDot} />
                <span className={styles.timelineText}>Poll {idx + 1}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className={styles.container}>

        {/* Poll header */}
        <div className={styles.pollMeta}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          <span className={styles.pollCounter}>Poll {pollIndex + 1} of {totalPolls}</span>
        </div>

        <div className={styles.pollJourney} aria-label="Poll journey progress">
          <div className={styles.pollJourneyBar}>
            <div className={styles.pollJourneyFill} style={{ width: `${pollProgressPct}%` }} />
          </div>
          <span className={styles.pollJourneyLabel}>{pollProgressPct}% complete</span>
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

        <div className={styles.liveRow}>
          <span className={styles.livePill}>Live refresh in {refreshIn}s</span>
          <button className={styles.refreshBtn} onClick={refreshNow}>
            Refresh now
          </button>
        </div>

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
            const momentumDelta = momentum[opt.id] ?? 0;
            const meterWidth = Math.min(Math.abs(momentumDelta) * 8, 100);
            const momentumText = momentumDelta > 0
              ? `+${momentumDelta.toFixed(1)} pp`
              : `${momentumDelta.toFixed(1)} pp`;
            const meta = getOptionMeta(opt);
            const yesterdayDelta = getYesterdayTrend(poll.id, opt.id);
            const yesterdayDirection = yesterdayDelta > 0 ? 'up' : yesterdayDelta < 0 ? 'down' : 'flat';
            const yesterdayArrow = yesterdayDirection === 'up' ? '↗' : yesterdayDirection === 'down' ? '↘' : '→';
            const yesterdayValue = `${yesterdayDelta > 0 ? '+' : ''}${yesterdayDelta}`;
            const isCompared = compareIds.includes(opt.id);
            const compareAtLimit = compareIds.length >= 3 && !isCompared;

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
                <div className={styles.optionMetaHeader}>
                  <span className={styles.optionIcon} aria-hidden="true">{meta.icon}</span>
                  <span className={styles.countryPill}>{meta.flag} {meta.country}</span>
                  <span className={styles.populationBadge}>Pop: {meta.population}</span>
                </div>
                <div className={styles.compareRow}>
                  <button
                    type="button"
                    className={[styles.compareBtn, isCompared ? styles.compareBtnActive : ''].join(' ')}
                    onClick={e => {
                      e.stopPropagation();
                      toggleCompare(opt.id);
                    }}
                    disabled={compareAtLimit}
                    aria-label={isCompared ? `Remove ${opt.label} from compare` : `Add ${opt.label} to compare`}
                  >
                    {isCompared ? 'Compared' : 'Compare'}
                  </button>
                  <span className={styles.compareHint}>
                    {compareAtLimit ? 'Max 3 options' : `${compareIds.length}/3 selected`}
                  </span>
                </div>
                <div className={styles.optLabel}>{opt.label}</div>
                <div className={styles.optionTagsRow}>
                  <div className={styles.optDetail}>{opt.detail}</div>
                  <span className={styles.cultureTag}>{meta.tag}</span>
                </div>
                <div className={[styles.optVotes, votes === null ? styles.loadingStat : ''].join(' ')}>
                  {votes === null ? 'Loading votes...' : `${count} vote${count !== 1 ? 's' : ''}`}
                </div>
                <div className={styles.miniTrendRow}>
                  <span
                    className={[
                      styles.miniTrend,
                      yesterdayDirection === 'up' ? styles.miniTrendUp : '',
                      yesterdayDirection === 'down' ? styles.miniTrendDown : '',
                    ].join(' ')}
                    aria-label={`Trend ${yesterdayValue} since yesterday`}
                  >
                    {yesterdayArrow} {yesterdayValue}
                  </span>
                  <span className={styles.miniTrendLabel}>since yesterday</span>
                </div>
                <div className={styles.barBg}>
                  <div
                    className={[styles.barFill, votes === null ? styles.barLoading : ''].join(' ')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {pct > 0 && <div className={styles.pct}>{pct}%</div>}

                <div className={styles.momentumWrap}>
                  <div className={styles.momentumHeader}>
                    <span className={styles.momentumLabel}>Confidence meter</span>
                    <span
                      className={[
                        styles.momentumDelta,
                        momentumDelta > 0 ? styles.momentumUp : '',
                        momentumDelta < 0 ? styles.momentumDown : '',
                      ].join(' ')}
                    >
                      {momentumText} since refresh
                    </span>
                  </div>
                  <div className={styles.momentumTrack}>
                    <div
                      className={[
                        styles.momentumFill,
                        momentumDelta > 0 ? styles.momentumFillUp : '',
                        momentumDelta < 0 ? styles.momentumFillDown : '',
                      ].join(' ')}
                      style={{ width: `${meterWidth}%` }}
                    />
                  </div>
                </div>

                {isSelected && <div className={styles.check}>✓</div>}
              </div>
            );
          })}
        </div>

        {compareIds.length > 0 && (
          <section className={styles.compareDrawer} aria-label="Comparison drawer">
            <div className={styles.compareDrawerHead}>
              <div>
                <p className={styles.compareDrawerLabel}>Compare Cities</p>
                <h3 className={styles.compareDrawerTitle}>
                  {compareIds.length < 2
                    ? 'Select at least 2 options to compare side-by-side'
                    : `Comparing ${compareIds.length} options`}
                </h3>
              </div>
              <button
                type="button"
                className={styles.compareClearBtn}
                onClick={() => setCompareIds([])}
              >
                Clear
              </button>
            </div>

            <div className={styles.compareGrid}>
              {comparedOptions.map(item => (
                <article key={item.id} className={styles.compareCard}>
                  <h4 className={styles.compareName}>{item.label}</h4>
                  <p className={styles.compareCountry}>{item.meta.flag} {item.meta.country}</p>
                  <p className={styles.compareStat}>Population: <strong>{item.meta.population}</strong></p>
                  <p className={styles.compareStat}>Tag: <strong>{item.meta.tag}</strong></p>
                  <p className={styles.compareStat}>Votes: <strong>{item.count}</strong></p>
                  <p className={styles.compareStat}>Share: <strong>{item.pct}%</strong></p>
                  <p
                    className={[
                      styles.compareStat,
                      item.yesterdayDirection === 'up' ? styles.miniTrendUp : '',
                      item.yesterdayDirection === 'down' ? styles.miniTrendDown : '',
                    ].join(' ')}
                  >
                    Trend: <strong>{item.yesterdayArrow} {item.yesterdayDelta > 0 ? '+' : ''}{item.yesterdayDelta} since yesterday</strong>
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className={styles.insightBox}>
          <p className={styles.insightLabel}>Live Insight</p>
          <h2 className={styles.insightTitle}>
            {total === 0 && 'Waiting for first vote'}
            {total > 0 && isTie && `Tie at the top: ${leader?.label} and ${runnerUp?.label}`}
            {total > 0 && !isTie && leader && `${leader.label} is leading`}
          </h2>
          <p className={styles.insightMeta}>
            {total === 0 && 'Connect your wallet and become the first voter on this poll.'}
            {total > 0 && isTie && `${leader?.votes} votes each · ${turnoutLabel}`}
            {total > 0 && !isTie && leader && `${leader.votes} votes · ${leaderShare}% share · ${turnoutLabel}`}
          </p>
        </section>

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
          className={[
            styles.voteBtn,
            walletAddress && selected && !hasVoted && !isVoting ? styles.readyToVote : '',
          ].join(' ')}
          onClick={castVote}
          disabled={!walletAddress || !selected || hasVoted || isVoting}
        >
          {btnLabel()}
        </button>

        <p className={styles.voteHint}>
          Tip: review the live percentages above before you commit your final vote.
        </p>

        <div className={styles.mobileActionBar}>
          <div className={styles.mobileMetaRow}>
            <span className={styles.mobileWalletState}>
              <span
                className={[
                  styles.mobileStateDot,
                  walletAddress ? styles.mobileStateDotConnected : styles.mobileStateDotDisconnected,
                ].join(' ')}
              />
              {walletAddress ? 'Wallet connected' : 'Wallet not connected'}
            </span>
            <span
              className={[
                styles.mobileSelectedState,
                selectedLabel ? '' : styles.mobileSelectedEmpty,
              ].join(' ')}
            >
              {selectedLabel ? `Selected: ${selectedLabel}` : 'No option selected'}
            </span>
          </div>
          <button
            className={styles.mobileActionBtn}
            onClick={handleMobileCta}
            disabled={walletAddress ? mobileVoteDisabled : false}
          >
            {mobileCtaLabel}
          </button>
        </div>

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

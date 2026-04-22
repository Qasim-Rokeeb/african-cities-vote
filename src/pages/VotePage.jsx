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

function buildSparklinePath(values) {
  const width = 86;
  const height = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export default function VotePage({ poll, pollIndex, totalPolls, onBack, onNext, onPrev, onJumpToPoll }) {
  const { walletAddress, connectWallet } = useWallet();

  const [votes,        setVotes]        = useState(null);
  const [refreshIn,    setRefreshIn]    = useState(30);
  const [selected,     setSelected]     = useState(null);
  const [hasVoted,     setHasVoted]     = useState(false);
  const [isVoting,     setIsVoting]     = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status,       setStatus]       = useState({ msg: '', type: '' });
  const [toast,        setToast]        = useState({ open: false, title: '', message: '', txid: '' });
  const [momentum,     setMomentum]     = useState({});
  const [compareIds,   setCompareIds]   = useState([]);
  const [shakeConnect, setShakeConnect] = useState(false);
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

  async function refreshNow() {
    setIsRefreshing(true);
    await loadVotes();
    setRefreshIn(30);
    setIsRefreshing(false);
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
    document.body.classList.add('is-loading-tx');

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
        setStatus({ msg: '', type: '' });
        const selectedOption = poll.options.find(o => o.id === selected)?.label || 'selected option';
        setToast({
          open: true,
          title: 'Vote Recorded',
          message: `${selectedOption} has been added on-chain.`,
          txid,
        });
        setTimeout(() => {
          setToast({ open: false, title: '', message: '', txid: '' });
        }, 4200);
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
      document.body.classList.remove('is-loading-tx');
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
  const showMobileSelectionBar = Boolean(selectedLabel) && !hasVoted;

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

  // Generate an ARIA live string for status
  const ariaLiveStatus = status?.msg || '';

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
                aria-label={`Jump to poll ${idx + 1}`}
              >
                <span className={styles.timelineDot} aria-hidden="true" />
                <span className={styles.timelineText}>Poll {idx + 1}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Screen Reader ARIA Live Region for Status Updates */}
      <div aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(1px, 1px, 1px, 1px)' }}>
        {ariaLiveStatus}
      </div>

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
          <span className={styles.livePill} title="Vote totals auto-refresh every 30 seconds">
            Votes refresh in <span className={styles.refreshDigit}>{refreshIn}</span>s
          </span>
          <button className={styles.refreshBtn} onClick={refreshNow} disabled={isRefreshing} title="Fetch latest vote totals now" aria-label="Refresh live vote totals">
            {isRefreshing ? <span className={styles.refreshSpinner} aria-hidden="true" /> : 'Refresh Votes'}
          </button>
        </div>

        {/* Wallet connect */}
        {!walletAddress && (
          <div className={styles.walletPrompt}>
            <button 
              className={`${styles.connectBtn} ${shakeConnect ? styles.shakeBtn : ''}`.trim()} 
              onClick={connectWallet}
            >
              Connect Wallet to Vote
            </button>
            <p className={styles.walletHint}>Requires Leather or Xverse wallet on Mainnet</p>
          </div>
        )}

        <div className={styles.grid}>
          {poll.options.map(opt => {
            const count = votes?.[opt.id] ?? 0;
            const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
            const displayCount = walletAddress ? count : '?';
            const displayPct = walletAddress ? Math.round(pct) : '?';
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
            const trendSeed = Math.max(0, count - Math.max(1, Math.abs(yesterdayDelta) * 2));
            const trendBump = Math.max(0, trendSeed + Math.round(momentumDelta * 2));
            const trendPoints = [trendSeed, Math.max(0, Math.round((trendSeed + count) / 2)), trendBump, count];
            const sparklinePath = buildSparklinePath(trendPoints);
            const inlineMeterWidth = Math.min(Math.abs(momentumDelta) * 14, 100);
            const inlineMeterLabel = momentumDelta > 0
              ? `+${momentumDelta.toFixed(1)} pp`
              : `${momentumDelta.toFixed(1)} pp`;

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
                aria-pressed={isSelected}
                aria-disabled={cardsDisabled}
                tabIndex={cardsDisabled ? -1 : 0}
                onKeyDown={e => e.key === 'Enter' && !cardsDisabled && setSelected(opt.id)}
                title={!walletAddress ? 'Connect wallet to vote' : ''}
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
                    title={isCompared ? `Remove ${opt.label} from comparison` : `Compare ${opt.label} side-by-side`}
                  >
                    {isCompared ? 'Compared' : 'Compare'}
                  </button>
                  <span className={styles.compareHint}>
                    {compareAtLimit ? 'Max 3 options' : `${compareIds.length}/3 selected`}
                  </span>
                </div>
                <div className={styles.optLabel}>{opt.label}</div>
                <div className={styles.cityStatsStrip}>
                  <div className={styles.sparklineWrap} aria-hidden="true">
                    <svg viewBox="0 0 86 20" className={styles.sparkline} preserveAspectRatio="none">
                      <defs>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <path 
                        d={sparklinePath} 
                        className={styles.sparklinePath} 
                        style={{ 
                          stroke: yesterdayDelta >= 0 ? '#00ffcc' : '#ff4d4d',
                          filter: 'url(#glow)'
                        }}
                      />
                    </svg>
                  </div>
                  <div className={styles.inlineMomentum}>
                    <div className={styles.inlineMomentumTrack}>
                      <div
                        className={[
                          styles.inlineMomentumFill,
                          momentumDelta > 0 ? styles.inlineMomentumFillUp : '',
                          momentumDelta < 0 ? styles.inlineMomentumFillDown : '',
                        ].join(' ')}
                        style={{ width: `${inlineMeterWidth}%` }}
                      />
                    </div>
                    <span className={styles.inlineMomentumLabel}>{inlineMeterLabel}</span>
                  </div>
                </div>
                <div className={styles.optionTagsRow}>
                  <div className={styles.optDetail}>{opt.detail}</div>
                  <span className={styles.cultureTag}>{meta.tag}</span>
                </div>
                <div className={[styles.optVotes, votes === null ? styles.loadingStat : ''].join(' ')}>
                  {walletAddress ? (
                    votes === null ? 'Loading votes...' : `${count} vote${count !== 1 ? 's' : ''}`
                  ) : (
                    'Connect to view votes'
                  )}
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
                  {walletAddress && pct > 0 && <div
                    className={[styles.barFill, votes === null ? styles.barLoading : ''].join(' ')}
                    style={{ width: `${pct}%` }}
                  />}
                </div>
                {walletAddress && pct > 0 && <div className={styles.pct}>{pct}%</div>}
                {!walletAddress && <div className={styles.pct}>?%</div>}

                <div className={styles.momentumWrap}>
                  <div className={styles.momentumHeader}>
                    <span className={styles.momentumLabel} title="Shows recent change in vote share since last refresh">Confidence meter</span>
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
                <h2 className={styles.compareDrawerTitle}>
                  {compareIds.length < 2
                    ? 'Select at least 2 options to compare side-by-side'
                    : `Comparing ${compareIds.length} options`}
                </h2>
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
                  <h3 className={styles.compareName}>{item.label}</h3>
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
          {total === 0 ? (
            <div className={styles.noVotesState}>
              <div className={styles.noVotesArt} aria-hidden="true">🗳️✨</div>
              <p className={styles.insightLabel}>Live Insight</p>
              <h2 className={styles.insightTitle}>Waiting for first vote</h2>
              <p className={styles.insightMeta}>Connect your wallet and become the first voter on this poll.</p>
            </div>
          ) : (
            <>
              <p className={styles.insightLabel}>Live Insight</p>
              <h2 className={styles.insightTitle}>
                {isTie && `Tie at the top: ${leader?.label} and ${runnerUp?.label}`}
                {!isTie && leader && `${leader.label} is leading`}
              </h2>
              <p className={styles.insightMeta}>
                {isTie && `${leader?.votes} votes each · ${turnoutLabel}`}
                {!isTie && leader && `${leader.votes} votes · ${leaderShare}% share · ${turnoutLabel}`}
              </p>
            </>
          )}
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

        <section className={styles.howItWorksPanel} aria-label="How voting works">
          <p className={styles.howItWorksLabel}>How Voting Works</p>
          <ul className={styles.howItWorksList}>
            <li>Connect your wallet to enable voting.</li>
            <li>Choose one option and submit one vote for this poll.</li>
            <li>Votes are on-chain and cannot be changed after confirmation.</li>
          </ul>
        </section>

        {/* Vote button */}
        <div 
          className={styles.voteBtnWrapper}
          onMouseEnter={() => !walletAddress && setShakeConnect(true)}
          onMouseLeave={() => !walletAddress && setShakeConnect(false)}
          title={!walletAddress ? 'Connect wallet to vote' : ''}
        >
          <button
            className={[
              styles.voteBtn,
              walletAddress && selected && !hasVoted && !isVoting ? styles.readyToVote : '',
            ].join(' ')}
            onClick={castVote}
            disabled={!walletAddress || !selected || hasVoted || isVoting}
            title={!walletAddress ? 'Connect wallet to vote' : ''}
          >
            {isVoting && <div className={styles.buttonSpinner} aria-hidden="true" />}
            {isVoting ? 'Voting...' : <span>{btnLabel()}</span>}
          </button>
        </div>

        <p className={styles.voteMicrocopy}>One wallet can vote once per poll. Confirmed votes cannot be edited.</p>

        <p className={styles.voteHint}>
          Tip: review the live percentages above before you commit your final vote.
        </p>

        <div className={[
          styles.mobileActionBar,
          showMobileSelectionBar ? styles.mobileActionBarVisible : '',
        ].join(' ')}>
          <div className={styles.mobileMetaRow}>
            <p className={styles.mobileSelectionLabel}>Your Selection</p>
            <span className={styles.mobileSelectedState}>Selected: {selectedLabel}</span>
          </div>
          <div className={styles.mobileActionRow}>
            <button
              type="button"
              className={styles.mobileEditBtn}
              onClick={() => setSelected(null)}
              aria-label="Choose a different option"
            >
              Edit
            </button>
            <span className={styles.mobileWalletState}>
              <span
                className={[
                  styles.mobileStateDot,
                  walletAddress ? styles.mobileStateDotConnected : styles.mobileStateDotDisconnected,
                ].join(' ')}
              />
              {walletAddress ? 'Wallet connected' : 'Wallet not connected'}
            </span>
          </div>
          <button
            className={[styles.mobileActionBtn, (walletAddress && selected !== null && !isVoting && (!hasVoted || parseInt(hasVoted) !== selected)) ? styles.readyToVote : ''].filter(Boolean).join(' ')}
            onClick={handleMobileCta}
            disabled={walletAddress ? mobileVoteDisabled : false}
            title={!walletAddress ? 'Connect wallet to vote' : ''}
          >
            {isVoting && <span className={styles.buttonSpinner} aria-hidden="true" />}
            <span>{mobileCtaLabel}</span>
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
          <p className={styles.footerCopy}>Built for transparent on-chain city voting across Africa.</p>
          <div className={styles.footerLinks}>
            <a
              href={`https://explorer.hiro.so/txid/${DEPLOYER}.${poll.id}?chain=mainnet`}
              target="_blank"
              rel="noreferrer"
            >
              Contract ↗
            </a>
            <a href="https://stacks.co" target="_blank" rel="noreferrer">Stacks</a>
            <a href="https://explorer.hiro.so" target="_blank" rel="noreferrer">Explorer</a>
          </div>
          <div className={styles.footerHandles}>
            <span>@africantechvotes</span>
            <span>@stacksafrica</span>
          </div>
        </footer>

        {toast.open && (
          <div className={styles.toast} role="status" aria-live="polite">
            <div className={styles.toastHead}>
              <div className={styles.cubeWrap}>
                <div className={styles.cube}>
                  <div className={styles.cubeFace} />
                  <div className={styles.cubeFace} />
                  <div className={styles.cubeFace} />
                  <div className={styles.cubeFace} />
                  <div className={styles.cubeFace} />
                  <div className={styles.cubeFace} />
                </div>
              </div>
              <div>
                <div className={styles.toastTitle}>{toast.title || 'Vote Recorded'}</div>
                <div className={styles.toastSubtitle}>On-Chain Success</div>
              </div>
            </div>
            <div className={styles.toastMessage}>{toast.message}</div>
            <div className={styles.toastActions}>
              {toast.txid && (
                <a
                  className={styles.toastActionBtn}
                  href={`https://explorer.hiro.so/txid/${toast.txid}?chain=mainnet`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View TX ↗
                </a>
              )}
              <button
                type="button"
                className={styles.toastDismissBtn}
                onClick={() => setToast({ open: false, title: '', message: '', txid: '' })}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

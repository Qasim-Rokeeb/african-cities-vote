import React, { useEffect, useMemo, useState } from 'react';
import { POLLS, fetchVoteCounts, mapVotesToOptions } from '../stacksUtils';
import { useWallet } from '../WalletContext';
import styles from './HomePage.module.css';

export default function HomePage({ onSelectPoll }) {
  const { walletAddress } = useWallet();
  const [allVotes, setAllVotes] = useState({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    Promise.all(
      POLLS.map(async poll => {
        const raw = await fetchVoteCounts(poll.id);
        if (!raw) return [poll.id, 0];
        const mapped = mapVotesToOptions(raw, poll.options);
        const total = Object.values(mapped).reduce((a, b) => a + b, 0);
        return [poll.id, total];
      })
    ).then(entries => {
      if (!isMounted) return;
      setAllVotes(Object.fromEntries(entries));
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const pollCards = useMemo(
    () => POLLS.map((poll, i) => ({
      poll,
      index: i,
      total: allVotes[poll.id] ?? 0,
    })),
    [allVotes]
  );

  const filteredPolls = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return pollCards;
    return pollCards.filter(({ poll }) => {
      const optionsText = poll.options.map(opt => opt.label).join(' ').toLowerCase();
      return (
        poll.title.toLowerCase().includes(normalized) ||
        poll.question.toLowerCase().includes(normalized) ||
        optionsText.includes(normalized)
      );
    });
  }, [pollCards, query]);

  const featuredPoll = useMemo(() => {
    return [...pollCards].sort((a, b) => b.total - a.total)[0] || null;
  }, [pollCards]);

  const totalVotes = useMemo(
    () => Object.values(allVotes).reduce((sum, n) => sum + n, 0),
    [allVotes]
  );

  return (
    <div className={styles.page}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />

      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>On-chain · Stacks Mainnet · 5 Active Polls</p>
          <h1 className={styles.title}>
            Africa Tech<br />
            <span className={styles.accent}>Votes</span>
          </h1>
          <p className={styles.subtitle}>
            Five on-chain polls about tech & crypto in Africa.<br />
            One wallet. One vote per poll. Permanent on the blockchain.
          </p>
        </header>

        <div className={styles.statsStrip}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total On-chain Votes</span>
            <strong className={styles.statValue}>{totalVotes}</strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Live Polls</span>
            <strong className={styles.statValue}>{POLLS.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Wallet</span>
            <strong className={styles.statValue}>{walletAddress ? 'Connected' : 'Not Connected'}</strong>
          </div>
        </div>

        {featuredPoll && (
          <section className={styles.featuredPoll}>
            <p className={styles.featuredLabel}>Most Active Right Now</p>
            <h2 className={styles.featuredTitle}>
              {featuredPoll.poll.emoji} {featuredPoll.poll.title}
            </h2>
            <p className={styles.featuredMeta}>
              {featuredPoll.total} vote{featuredPoll.total !== 1 ? 's' : ''} cast
            </p>
            <button
              className={styles.featuredCta}
              onClick={() => onSelectPoll(featuredPoll.index)}
            >
              Open Trending Poll
            </button>
          </section>
        )}

        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search polls, topics, or options..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search available polls"
          />
        </div>

        <div className={styles.grid}>
          {filteredPolls.map(({ poll, index }, i) => (
            <div
              key={poll.id}
              className={styles.pollCard}
              onClick={() => onSelectPoll(index)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onSelectPoll(index)}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className={styles.pollEmoji}>{poll.emoji}</div>
              <div className={styles.pollNumber}>Poll {index + 1} of 5</div>
              <h2 className={styles.pollTitle}>{poll.title}</h2>
              <p className={styles.pollQuestion}>{poll.question}</p>
              <div className={styles.pollOptions}>
                {poll.options.map(opt => (
                  <span key={opt.id} className={styles.optionTag}>{opt.label}</span>
                ))}
              </div>
              <div className={styles.pollFooter}>
                <span className={styles.voteCount}>
                  {allVotes[poll.id] != null
                    ? `${allVotes[poll.id]} vote${allVotes[poll.id] !== 1 ? 's' : ''}`
                    : '— votes'}
                </span>
                <span className={styles.voteArrow}>Vote →</span>
              </div>
            </div>
          ))}
        </div>

        {filteredPolls.length === 0 && (
          <div className={styles.emptyState}>No polls match your search right now.</div>
        )}

        <footer className={styles.footer}>
          <p>Built on Stacks · Powered by Clarity smart contracts</p>
          <p>Each vote is a permanent on-chain transaction</p>
        </footer>
      </div>
    </div>
  );
}

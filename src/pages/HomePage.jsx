import React, { useEffect, useState } from 'react';
import { POLLS, fetchVoteCounts, mapVotesToOptions } from '../stacksUtils';
import styles from './HomePage.module.css';

export default function HomePage({ onSelectPoll }) {
  const [allVotes, setAllVotes] = useState({});

  useEffect(() => {
    POLLS.forEach(async poll => {
      const raw = await fetchVoteCounts(poll.id);
      if (raw) {
        const mapped = mapVotesToOptions(raw, poll.options);
        const total = Object.values(mapped).reduce((a, b) => a + b, 0);
        setAllVotes(prev => ({ ...prev, [poll.id]: total }));
      }
    });
  }, []);

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

        <div className={styles.grid}>
          {POLLS.map((poll, i) => (
            <div
              key={poll.id}
              className={styles.pollCard}
              onClick={() => onSelectPoll(i)}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className={styles.pollEmoji}>{poll.emoji}</div>
              <div className={styles.pollNumber}>Poll {i + 1} of 5</div>
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

        <footer className={styles.footer}>
          <p>Built on Stacks · Powered by Clarity smart contracts</p>
          <p>Each vote is a permanent on-chain transaction</p>
        </footer>
      </div>
    </div>
  );
}

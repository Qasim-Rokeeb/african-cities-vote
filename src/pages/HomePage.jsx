import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { POLLS, fetchVoteCounts, mapVotesToOptions } from '../stacksUtils';
import { useWallet } from '../WalletContext';
import styles from './HomePage.module.css';

const SPOTLIGHT_ROTATE_MS = 7000;
const SPOTLIGHT_FADE_MS = 280;

const CITY_SPOTLIGHTS = [
  {
    name: 'Lagos',
    country: 'Nigeria',
    population: '21.3M',
    vibe: 'Startup Energy',
    photo:
      'https://images.unsplash.com/photo-1578922746465-3a80a228f223?auto=format&fit=crop&w=1400&q=80',
    fact: 'Lagos hosts one of Africa\'s largest startup ecosystems, with active fintech and developer communities.',
    ctaPollIndex: 0,
  },
  {
    name: 'Nairobi',
    country: 'Kenya',
    population: '5.3M',
    vibe: 'Silicon Savannah',
    photo:
      'https://images.unsplash.com/photo-1626863905121-3b0c0ed7b94e?auto=format&fit=crop&w=1400&q=80',
    fact: 'Nairobi is known as the Silicon Savannah, where mobile innovation and VC activity continue to grow.',
    ctaPollIndex: 0,
  },
  {
    name: 'Accra',
    country: 'Ghana',
    population: '2.6M',
    vibe: 'Creative Coastline',
    photo:
      'https://images.unsplash.com/photo-1597931752949-98c74b5b159a?auto=format&fit=crop&w=1400&q=80',
    fact: 'Accra is gaining momentum with youth-led startups, digital talent programs, and regional tech events.',
    ctaPollIndex: 0,
  },
  {
    name: 'Cairo',
    country: 'Egypt',
    population: '10.2M',
    vibe: 'Historic Innovation',
    photo:
      'https://images.unsplash.com/photo-1539650116574-75c0c6d73f86?auto=format&fit=crop&w=1400&q=80',
    fact: 'Cairo combines deep engineering talent and large market access, making it a major innovation center.',
    ctaPollIndex: 0,
  },
];

function OdometerCounter({ value, suffix = '', ariaLabel }) {
  const numeric = Math.max(0, Math.floor(Number(value) || 0));
  const digits = String(numeric).split('');

  return (
    <span className={styles.odometer} aria-label={ariaLabel}>
      <span className={styles.odometerDigits}>
        {digits.map((digit, i) => (
          <span className={styles.odometerWindow} key={i}>
            <span
              className={styles.odometerTrack}
              style={{ transform: `translateY(-${Number(digit) * 1.1}em)` }}
            >
              {Array.from({ length: 10 }).map((_, n) => (
                <span key={n} className={styles.odometerDigit}>{n}</span>
              ))}
            </span>
          </span>
        ))}
      </span>
      {suffix && <span className={styles.odometerSuffix}>{suffix}</span>}
    </span>
  );
}

export default function HomePage({ onSelectPoll }) {
  const { walletAddress } = useWallet();
  const [allVotes, setAllVotes] = useState({});
  const [query, setQuery] = useState('');
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [spotlightVisible, setSpotlightVisible] = useState(true);
  const [spotlightPaused, setSpotlightPaused] = useState(false);
  const spotlightIndexRef = useRef(0);
  const spotlightFadeTimerRef = useRef(null);

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

  const transitionSpotlight = useCallback(nextIndex => {
    if (nextIndex === spotlightIndexRef.current) return;

    setSpotlightVisible(false);

    if (spotlightFadeTimerRef.current) {
      clearTimeout(spotlightFadeTimerRef.current);
    }

    spotlightFadeTimerRef.current = setTimeout(() => {
      spotlightIndexRef.current = nextIndex;
      setSpotlightIndex(nextIndex);
      setSpotlightVisible(true);
    }, SPOTLIGHT_FADE_MS);
  }, []);

  useEffect(() => {
    const rotateId = setInterval(() => {
      if (spotlightPaused) return;
      const next = (spotlightIndexRef.current + 1) % CITY_SPOTLIGHTS.length;
      transitionSpotlight(next);
    }, SPOTLIGHT_ROTATE_MS);

    return () => {
      clearInterval(rotateId);
      if (spotlightFadeTimerRef.current) {
        clearTimeout(spotlightFadeTimerRef.current);
      }
    };
  }, [spotlightPaused, transitionSpotlight]);

  const onSpotlightBlur = e => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setSpotlightPaused(false);
    }
  };

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

  const liveParticipation = useMemo(() => {
    const activePolls = pollCards.filter(({ total }) => total > 0).length;
    return Math.round((activePolls / POLLS.length) * 100);
  }, [pollCards]);

  const openTrendingPoll = () => {
    if (featuredPoll) {
      onSelectPoll(featuredPoll.index);
      return;
    }
    onSelectPoll(0);
  };

  const scrollToPolls = () => {
    document.getElementById('poll-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeSpotlight = CITY_SPOTLIGHTS[spotlightIndex];

  return (
    <div className={styles.page}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />

      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>On-chain · Stacks Mainnet · 5 Active Polls</p>
          <h1 className={styles.title}>
            Vote For Africa&apos;s
            <span className={styles.accent}>Top Tech City</span>
          </h1>
          <p className={styles.subtitle}>
            Connect your wallet, choose a city, and cast one permanent on-chain vote per poll.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.primaryHeroBtn} onClick={openTrendingPoll}>
              Open Trending Poll
            </button>
            <button className={styles.secondaryHeroBtn} onClick={scrollToPolls}>
              Browse All Polls
            </button>
          </div>
        </header>

        <section
          className={`${styles.citySpotlight} ${!spotlightVisible ? styles.citySpotlightHidden : ''}`.trim()}
          aria-live="polite"
          onMouseEnter={() => setSpotlightPaused(true)}
          onMouseLeave={() => setSpotlightPaused(false)}
          onFocusCapture={() => setSpotlightPaused(true)}
          onBlurCapture={onSpotlightBlur}
        >
          <div
            className={styles.citySpotlightImage}
            style={{ backgroundImage: `url(${activeSpotlight.photo})` }}
            role="img"
            aria-label={`${activeSpotlight.name}, ${activeSpotlight.country}`}
          />
          <div className={styles.citySpotlightBody}>
            <p className={styles.citySpotlightLabel}>City Spotlight</p>
            <h2 className={styles.citySpotlightTitle}>
              {activeSpotlight.name}
              <span>{activeSpotlight.country}</span>
            </h2>
            <div className={styles.citySpotlightMetaRow}>
              <span className={styles.citySpotlightMetaChip}>{activeSpotlight.country}</span>
              <span className={styles.citySpotlightMetaChip}>Pop {activeSpotlight.population}</span>
              <span className={styles.citySpotlightMetaChip}>{activeSpotlight.vibe}</span>
            </div>
            <p className={styles.citySpotlightFact}>{activeSpotlight.fact}</p>
            <div className={styles.citySpotlightActions}>
              <button
                className={styles.citySpotlightCta}
                onClick={() => onSelectPoll(activeSpotlight.ctaPollIndex)}
              >
                Vote Now
              </button>
              <div className={styles.citySpotlightDots}>
                {CITY_SPOTLIGHTS.map((city, i) => (
                  <button
                    key={city.name}
                    type="button"
                    className={`${styles.citySpotlightDot} ${i === spotlightIndex ? styles.citySpotlightDotActive : ''}`.trim()}
                    onClick={() => transitionSpotlight(i)}
                    aria-label={`Show ${city.name} spotlight`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className={styles.statsStrip}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total On-chain Votes</span>
            <strong className={styles.statValue}>
              <OdometerCounter value={totalVotes} ariaLabel={`${totalVotes} total on-chain votes`} />
            </strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Live Participation</span>
            <strong className={styles.statValue}>
              <OdometerCounter value={liveParticipation} suffix="%" ariaLabel={`${liveParticipation} percent live participation`} />
            </strong>
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

        <div id="poll-grid" className={styles.grid}>
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

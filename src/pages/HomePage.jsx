import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { POLLS, fetchVoteCounts, mapVotesToOptions } from '../stacksUtils';
import { useWallet } from '../WalletContext';
import styles from './HomePage.module.css';

const SPOTLIGHT_ROTATE_MS = 7000;
const SPOTLIGHT_FADE_MS = 280;

const FILTER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'region', label: 'Region' },
  { id: 'size', label: 'Size' },
  { id: 'language', label: 'Language' },
];

const SORT_OPTIONS = [
  { id: 'most-voted', label: 'Most Voted' },
  { id: 'a-z', label: 'A-Z' },
  { id: 'new', label: 'New' },
];

const POLL_FILTER_TAGS = {
  'african-cities-vote': ['region', 'size', 'language'],
  'africa-crypto-hub': ['region', 'language'],
  'africa-best-stack': ['language'],
  'africa-blockchain': ['language'],
  'africa-startup-city': ['region', 'size', 'language'],
};

const CITY_SPOTLIGHTS = [
  {
    name: 'Lagos',
    country: 'Nigeria',
    population: '21.3M',
    vibe: 'Startup Energy',
    categories: ['Coastal', 'Business Hub', 'Fintech'],
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
    categories: ['Highland', 'Startup Hub', 'Innovation'],
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
    categories: ['Coastal', 'Creative', 'Cultural'],
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
    categories: ['Historic', 'Business Hub', 'Mega City'],
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
        {digits.map((digit, i) => {
          const digitVal = Number(digit);
          return (
            <span className={styles.odometerWindow} key={i}>
              <span
                className={styles.odometerTrack}
                style={{ 
                  transform: `translateY(-${digitVal * 1.1}em)`,
                  transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' 
                }}
              >
                {Array.from({ length: 10 }).map((_, n) => (
                  <span key={n} className={styles.odometerDigit}>{n}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
      {suffix && <span className={styles.odometerSuffix}>{suffix}</span>}
    </span>
  );
}

export default function HomePage({ onSelectPoll }) {
  const { walletAddress } = useWallet();
  const [allVotes, setAllVotes] = useState({});
  const [cityLeaders, setCityLeaders] = useState([]);
  const [isLoadingVotes, setIsLoadingVotes] = useState(true);
  const [votesError, setVotesError] = useState('');
  const [todayBaseline, setTodayBaseline] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortMode, setSortMode] = useState('most-voted');
  const [cityLookup, setCityLookup] = useState('');
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [spotlightVisible, setSpotlightVisible] = useState(true);
  const [spotlightPaused, setSpotlightPaused] = useState(false);
  const [votePulse, setVotePulse] = useState(false);
  const spotlightIndexRef = useRef(0);
  const spotlightFadeTimerRef = useRef(null);
  const previousTotalVotesRef = useRef(0);

  const loadAllVotes = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoadingVotes(true);
    }
    setVotesError('');

    try {
      const entries = await Promise.all(
        POLLS.map(async poll => {
          const raw = await fetchVoteCounts(poll.id);
          if (!raw) return [poll.id, null];
          const mapped = mapVotesToOptions(raw, poll.options);
          const total = Object.values(mapped).reduce((a, b) => a + b, 0);
          return [poll.id, total];
        })
      );

      const failed = entries.filter(([, total]) => total == null).length;
      if (failed > 0) {
        setVotesError('Some live vote totals could not be loaded.');
      }

      setAllVotes(
        Object.fromEntries(entries.map(([id, total]) => [id, total ?? 0]))
      );

      const cityPoll = POLLS.find(poll => poll.id === 'african-cities-vote') || POLLS[0];
      const cityRaw = await fetchVoteCounts(cityPoll.id);
      if (cityRaw) {
        const mappedCityVotes = mapVotesToOptions(cityRaw, cityPoll.options);
        const rankedCities = cityPoll.options
          .map(option => ({
            id: option.id,
            label: option.label,
            votes: mappedCityVotes[option.id] ?? 0,
          }))
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 3);
        setCityLeaders(rankedCities);
      } else {
        setCityLeaders([]);
      }

      setLastUpdatedAt(new Date());
    } catch {
      setVotesError('Could not load live votes right now.');
    } finally {
      if (showLoading) {
        setIsLoadingVotes(false);
      }
    }
  }, []);

  useEffect(() => {
    loadAllVotes(true);
  }, [loadAllVotes]);

  useEffect(() => {
    const refreshId = setInterval(() => {
      loadAllVotes(false);
    }, 30000);

    return () => {
      clearInterval(refreshId);
    };
  }, [loadAllVotes]);

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
    return pollCards.filter(({ poll }) => {
      const tags = POLL_FILTER_TAGS[poll.id] || [];
      const matchesChip = activeFilter === 'all' || tags.includes(activeFilter);
      if (!matchesChip) return false;

      if (!normalized) return true;

      const optionsText = poll.options.map(opt => opt.label).join(' ').toLowerCase();
      return (
        poll.title.toLowerCase().includes(normalized) ||
        poll.question.toLowerCase().includes(normalized) ||
        optionsText.includes(normalized)
      );
    });
  }, [pollCards, query, activeFilter]);

  const sortedFilteredPolls = useMemo(() => {
    const next = [...filteredPolls];

    if (sortMode === 'a-z') {
      return next.sort((a, b) => a.poll.title.localeCompare(b.poll.title));
    }

    if (sortMode === 'new') {
      return next.sort((a, b) => b.index - a.index);
    }

    return next.sort((a, b) => b.total - a.total);
  }, [filteredPolls, sortMode]);

  const featuredPoll = useMemo(() => {
    return [...pollCards].sort((a, b) => b.total - a.total)[0] || null;
  }, [pollCards]);

  const maxPollVotes = useMemo(() => {
    return pollCards.reduce((max, item) => Math.max(max, item.total), 0);
  }, [pollCards]);

  const totalVotes = useMemo(
    () => Object.values(allVotes).reduce((sum, n) => sum + n, 0),
    [allVotes]
  );

  useEffect(() => {
    if (totalVotes > previousTotalVotesRef.current) {
      setVotePulse(true);
      const pulseTimer = setTimeout(() => {
        setVotePulse(false);
      }, 650);
      previousTotalVotesRef.current = totalVotes;
      return () => clearTimeout(pulseTimer);
    }

    previousTotalVotesRef.current = totalVotes;
    return undefined;
  }, [totalVotes]);

  useEffect(() => {
    if (isLoadingVotes) return;

    const dayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `acv-votes-baseline-${dayKey}`;
    const stored = window.localStorage.getItem(storageKey);

    if (stored == null) {
      window.localStorage.setItem(storageKey, String(totalVotes));
      setTodayBaseline(totalVotes);
      return;
    }

    setTodayBaseline(Number(stored) || 0);
  }, [totalVotes, isLoadingVotes]);

  const votesToday = useMemo(
    () => Math.max(0, totalVotes - todayBaseline),
    [totalVotes, todayBaseline]
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

  const handleCityLookup = e => {
    const value = e.target.value;
    setCityLookup(value);

    const normalized = value.trim().toLowerCase();
    if (!normalized) return;

    const matchIndex = CITY_SPOTLIGHTS.findIndex(city =>
      city.name.toLowerCase().startsWith(normalized) ||
      city.country.toLowerCase().startsWith(normalized)
    );

    if (matchIndex !== -1) {
      transitionSpotlight(matchIndex);
    }
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
            <button className={styles.secondaryHeroBtn} onClick={scrollToPolls} title="Jump to all available polls below">
              Browse All Polls
            </button>
          </div>
          <p className={styles.heroMicrocopy}>One wallet, one vote per poll. All votes are recorded on-chain.</p>
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
            <div className={styles.cityCategoryRow}>
              {activeSpotlight.categories.map(category => (
                <span key={category} className={styles.cityCategoryBadge}>{category}</span>
              ))}
            </div>
            <p className={styles.citySpotlightFact}>{activeSpotlight.fact}</p>
            <div className={styles.citySpotlightActions}>
              <button
                className={styles.citySpotlightCta}
                onClick={() => onSelectPoll(activeSpotlight.ctaPollIndex)}
                title="Go directly to the tech city voting poll"
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

        <div className={styles.cityLookupWrap}>
          <label className={styles.cityLookupLabel} htmlFor="city-lookup">Find Spotlight City</label>
          <input
            id="city-lookup"
            className={styles.cityLookupInput}
            type="search"
            placeholder="Search city or country (Lagos, Kenya, Cairo...)"
            value={cityLookup}
            onChange={handleCityLookup}
            aria-label="Find spotlight city"
          />
        </div>

        {votesError && (
          <div className={styles.errorBanner} role="alert" aria-live="assertive">
            <span>{votesError}</span>
            <button type="button" className={styles.errorBannerBtn} onClick={() => loadAllVotes(true)}>Retry</button>
          </div>
        )}

        {lastUpdatedAt && (
          <p className={styles.lastUpdatedStamp}>
            Last updated {lastUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}

        <div className={styles.sectionDivider} aria-hidden="true" />

        <div className={styles.statsStrip}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total On-chain Votes</span>
            <strong className={`${styles.statValue} ${votePulse ? styles.statValuePulse : ''}`.trim()}>
              {isLoadingVotes ? <div className={`${styles.skeletonBlock} ${styles.skeletonStatText}`} /> : <OdometerCounter value={totalVotes} ariaLabel={`${totalVotes} total on-chain votes`} />}
            </strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Live Participation</span>
            <strong className={styles.statValue}>
              {isLoadingVotes ? <div className={`${styles.skeletonBlock} ${styles.skeletonStatText}`} /> : <OdometerCounter value={liveParticipation} suffix="%" ariaLabel={`${liveParticipation} percent live participation`} />}
            </strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Votes Today</span>
            <strong className={styles.statValue}>
              {isLoadingVotes ? <div className={`${styles.skeletonBlock} ${styles.skeletonStatText}`} /> : <OdometerCounter value={votesToday} ariaLabel={`${votesToday} total votes today`} />}
            </strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Wallet</span>
            <strong className={styles.statValue}>{walletAddress ? 'Connected' : 'Not Connected'}</strong>
          </div>
        </div>

        {(isLoadingVotes || cityLeaders.length > 0) && (
          <section className={styles.leaderboardStrip} aria-label="Top 3 city leaderboard">
            <p className={styles.leaderboardLabel}>Top 3 Cities</p>
            <div className={styles.leaderboardRow}>
              {isLoadingVotes ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={`leader-skeleton-${i}`} className={styles.leaderItem}>
                    <div className={`${styles.skeletonBlock} ${styles.skeletonStatText}`} style={{ width: '120px' }} />
                  </div>
                ))
              ) : (
                cityLeaders.map((city, i) => (
                  <div key={city.id} className={styles.leaderItem}>
                    <span className={styles.leaderRank}>#{i + 1}</span>
                    <span className={styles.leaderName}>{city.name}</span>
                    <span className={styles.leaderVotes}>{city.votes.toLocaleString()} votes</span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        <div className={styles.sectionDivider} aria-hidden="true" />

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

        <div className={styles.sectionDivider} aria-hidden="true" />

        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="e.g., 'startup city', 'best tech stack', 'blockchain'"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search available polls by title, question, or option"
          />
        </div>

        <div className={styles.filterChips} aria-label="Quick poll filters">
          {FILTER_CHIPS.map(chip => (
            <button
              key={chip.id}
              type="button"
              className={`${styles.filterChip} ${activeFilter === chip.id ? styles.filterChipActive : ''}`.trim()}
              onClick={() => setActiveFilter(chip.id)}
              title={`Filter polls by ${chip.label.toLowerCase()}`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className={styles.sortRow}>
          <label className={styles.sortLabel} htmlFor="poll-sort">Sort Polls</label>
          <select
            id="poll-sort"
            className={styles.sortSelect}
            value={sortMode}
            onChange={e => setSortMode(e.target.value)}
            aria-label="Sort poll cards"
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>

        <div id="poll-grid" className={styles.grid}>
          {isLoadingVotes && Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-${i}`} className={styles.pollCardSkeleton} aria-hidden="true">
              <div className={`${styles.skeletonBlock} ${styles.skeletonEmoji}`} />
              <div className={`${styles.skeletonBlock} ${styles.skeletonBadge}`} />
              <div className={`${styles.skeletonBlock} ${styles.skeletonTitle}`} />
              <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} />
              <div className={`${styles.skeletonBlock} ${styles.skeletonLineShort}`} />
              <div className={styles.skeletonTagsRow}>
                <div className={`${styles.skeletonBlock} ${styles.skeletonTag}`} />
                <div className={`${styles.skeletonBlock} ${styles.skeletonTag}`} />
                <div className={`${styles.skeletonBlock} ${styles.skeletonTag}`} />
              </div>
            </div>
          ))}

          {!isLoadingVotes && (
            <>
          {sortedFilteredPolls.map(({ poll, index }, i) => (
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
              <div className={styles.pollVoteBadge}>
                {allVotes[poll.id] != null
                  ? `${allVotes[poll.id]} vote${allVotes[poll.id] !== 1 ? 's' : ''} live`
                  : 'Votes loading...'}
              </div>
              <div className={styles.pollNumber}>Poll {index + 1} of 5</div>
              <h2 className={styles.pollTitle}>{poll.title}</h2>
              <p className={styles.pollQuestion}>{poll.question}</p>
              <div className={styles.pollOptions}>
                {poll.options.map(opt => (
                  <span key={opt.id} className={styles.optionTag}>{opt.label}</span>
                ))}
              </div>
              <div className={styles.pollPopularityRow} aria-label="Relative popularity">
                <div className={styles.pollPopularityTrack}>
                  <div
                    className={styles.pollPopularityFill}
                    style={{ width: `${maxPollVotes > 0 ? Math.round(((allVotes[poll.id] ?? 0) / maxPollVotes) * 100) : 0}%` }}
                  />
                </div>
                <span className={styles.pollPopularityLabel}>
                  {maxPollVotes > 0 ? `${Math.round(((allVotes[poll.id] ?? 0) / maxPollVotes) * 100)}% of leader` : '0% of leader'}
                </span>
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
            </>
          )}
        </div>

        {sortedFilteredPolls.length === 0 && (
          <div className={styles.emptyState} role="status" aria-live="polite">
            <div className={styles.emptyStateArt} aria-hidden="true">🔎🌍</div>
            <div className={styles.emptyStateTitle}>No matching polls</div>
            <div className={styles.emptyStateText}>Try a different keyword, filter, or sort option.</div>
          </div>
        )}

        <footer className={styles.footer}>
          <p className={styles.footerCopy}>Built on Stacks · Powered by Clarity smart contracts</p>
          <p className={styles.footerCopy}>Each vote is a permanent on-chain transaction</p>
          <div className={styles.footerLinks}>
            <a href="https://stacks.co" target="_blank" rel="noreferrer">Stacks</a>
            <a href="https://explorer.hiro.so" target="_blank" rel="noreferrer">Explorer</a>
            <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
          </div>
          <div className={styles.footerHandles}>
            <span>@africantechvotes</span>
            <span>@stacksafrica</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

import React from 'react';
import styles from './CityCard.module.css';

export default function CityCard({ city, votes, totalVotes, selected, disabled, onSelect }) {
  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

  return (
    <div
      className={[
        styles.card,
        styles[city.id],
        selected  ? styles.selected  : '',
        disabled  ? styles.disabled  : '',
      ].join(' ')}
      onClick={() => !disabled && onSelect(city.id)}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={e => e.key === 'Enter' && !disabled && onSelect(city.id)}
      aria-pressed={selected}
      aria-label={`Vote for ${city.label}`}
    >
      <div className={styles.flag}>{city.flag}</div>
      <div className={styles.name}>{city.label}</div>
      <div className={styles.country}>{city.country}</div>

      <div className={styles.voteCount}>
        {votes === null ? '— votes' : votes === 1 ? '1 vote' : `${votes} votes`}
      </div>

      <div className={styles.barBg}>
        <div className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>

      {pct > 0 && <div className={styles.pct}>{pct}%</div>}

      {selected && <div className={styles.checkmark}>✓</div>}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { WalletProvider } from './WalletContext';
import { POLLS } from './stacksUtils';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import VotePage from './pages/VotePage';

const TRANSITION_MS = 320;

export default function App() {
  // -1 = home, 0–4 = poll index
  const [activePoll, setActivePoll] = useState(-1);
  const [pendingPoll, setPendingPoll] = useState(-1);
  const [transitionPhase, setTransitionPhase] = useState('idle');
  const [transitionDirection, setTransitionDirection] = useState('forward');

  useEffect(() => {
    if (pendingPoll === activePoll) return;

    setTransitionPhase('exiting');
    let enterTimer;
    const exitTimer = setTimeout(() => {
      setActivePoll(pendingPoll);
      setTransitionPhase('entering');

      enterTimer = setTimeout(() => {
        setTransitionPhase('idle');
      }, TRANSITION_MS);
    }, TRANSITION_MS);

    return () => {
      clearTimeout(exitTimer);
      if (enterTimer) clearTimeout(enterTimer);
    };
  }, [pendingPoll, activePoll]);

  function navigateTo(nextPoll) {
    if (nextPoll === pendingPoll) return;
    setTransitionDirection(nextPoll > activePoll ? 'forward' : 'backward');
    setPendingPoll(nextPoll);
    window.scrollTo(0, 0);
  }

  function goHome()  { navigateTo(-1); }
  function goToPoll(i) { navigateTo(i); }
  function goNext() { navigateTo(Math.min(activePoll + 1, POLLS.length - 1)); }
  function goPrev() { navigateTo(Math.max(activePoll - 1, 0)); }

  const transitionClass = [
    'app-view-stage',
    transitionPhase !== 'idle' ? `phase-${transitionPhase}` : '',
    transitionDirection === 'forward' ? 'dir-forward' : 'dir-backward',
  ].join(' ').trim();

  return (
    <WalletProvider>
      <Navbar
        activePollIndex={activePoll}
        totalPolls={POLLS.length}
        onNavigate={goHome}
      />

      <main className={transitionClass} style={{ '--view-transition-ms': `${TRANSITION_MS}ms` }}>
        {activePoll === -1 ? (
          <HomePage onSelectPoll={goToPoll} />
        ) : (
          <VotePage
            poll={POLLS[activePoll]}
            pollIndex={activePoll}
            totalPolls={POLLS.length}
            onBack={goHome}
            onNext={goNext}
            onPrev={goPrev}
            onJumpToPoll={goToPoll}
          />
        )}
      </main>
    </WalletProvider>
  );
}

import React, { useState } from 'react';
import { WalletProvider } from './WalletContext';
import { POLLS } from './stacksUtils';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import VotePage from './pages/VotePage';

export default function App() {
  // -1 = home, 0–4 = poll index
  const [activePoll, setActivePoll] = useState(-1);

  function goHome()               { setActivePoll(-1); window.scrollTo(0, 0); }
  function goToPoll(i)            { setActivePoll(i);  window.scrollTo(0, 0); }
  function goNext()               { setActivePoll(p => Math.min(p + 1, POLLS.length - 1)); window.scrollTo(0,0); }
  function goPrev()               { setActivePoll(p => Math.max(p - 1, 0));                window.scrollTo(0,0); }

  return (
    <WalletProvider>
      <Navbar activePollIndex={activePoll} onNavigate={goHome} />

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
        />
      )}
    </WalletProvider>
  );
}

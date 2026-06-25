import { useState, useRef, useEffect } from 'react';
import { playerDatabase } from './players';

// 🚨 PASTE YOUR API KEY HERE!
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';

function App() {
  const [appState, setAppState] = useState('config'); // config, draft, match, inningsBreak, postMatch
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState(playerDatabase);

  // Match State - Split into two innings
  const [innings, setInnings] = useState(1);
  
  const [score1, setScore1] = useState(0);
  const [wickets1, setWickets1] = useState(0);
  const [balls1, setBalls1] = useState(0);

  const [score2, setScore2] = useState(0);
  const [wickets2, setWickets2] = useState(0);
  const [balls2, setBalls2] = useState(0);

  const [commentaryFeed, setCommentaryFeed] = useState([]);
  const [currentBatter, setCurrentBatter] = useState(null);
  const [currentBowler, setCurrentBowler] = useState(null);
  
  // Visual FX State
  const [vfx, setVfx] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const commentaryEndRef = useRef(null);

  // Auto-scroll commentary
  useEffect(() => {
    commentaryEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [commentaryFeed]);

  const draftPlayer = (player, team) => {
    if (team === 1) setTeam1([...team1, player]);
    if (team === 2) setTeam2([...team2, player]);
    setAvailablePlayers(availablePlayers.filter(p => p.id !== player.id));
  };

  const startMatch = () => {
    if (team1.length === 0 || team2.length === 0) return alert("Draft players first!");
    setCurrentBatter(team1.find(p => p.role === 'Batter' || p.role === 'All-Rounder') || team1[0]);
    setCurrentBowler(team2.find(p => p.role === 'Bowler' || p.role === 'All-Rounder') || team2[0]);
    setAppState('match');
  };

  const startSecondInnings = () => {
    setInnings(2);
    setCommentaryFeed([]); // Clear commentary for the new innings
    // Swap roles: Team 2 bats, Team 1 bowls
    setCurrentBatter(team2.find(p => p.role === 'Batter' || p.role === 'All-Rounder') || team2[0]);
    setCurrentBowler(team1.find(p => p.role === 'Bowler' || p.role === 'All-Rounder') || team1[0]);
    setAppState('match');
  };

  // --- GEMINI AI COMMENTARY ENGINE ---
  const generateCommentary = async (runs, isWicket, batter, bowler) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      return `[API KEY MISSING] Add your key at the top of App.jsx!`;
    }

    let prompt = `You are an energetic T20 cricket commentator. Write ONE short, thrilling sentence of live commentary. 
    Bowler: ${bowler.name}. Batter: ${batter.name}. `;
    
    if (isWicket) prompt += `Outcome: OUT! It's a spectacular wicket. Make it dramatic.`;
    else if (runs === 6) prompt += `Outcome: 6 runs! It's a massive six. Make it hype.`;
    else if (runs === 4) prompt += `Outcome: 4 runs! A beautiful boundary.`;
    else if (runs === 0) prompt += `Outcome: Dot ball. Good bowling.`;
    else prompt += `Outcome: ${runs} run(s) taken.`;

    // Add match context for the run chase!
    if (innings === 2) {
      prompt += ` Context: Team 2 is chasing a target of ${score1 + 1}.`;
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9 }
        })
      });
      
      const data = await response.json();
      if (!response.ok) return `[API REJECTED] ${data.error?.message}`;
      return data.candidates[0].content.parts[0].text.replace(/[*"]/g, '');
    } catch (error) {
      return `[NETWORK ERROR] Could not reach AI server.`;
    }
  };

  // --- MATCH SIMULATION ENGINE ---
  const playBall = async () => {
    if (isSimulating) return;
    
    // Check if innings is already over before allowing a bowl
    if (innings === 1 && wickets1 >= 10) return;
    if (innings === 2 && (wickets2 >= 10 || score2 > score1)) return;

    setIsSimulating(true);
    setVfx(null);

    const outcomes = [0, 1, 1, 2, 4, 4, 6, 'W'];
    const result = outcomes[Math.floor(Math.random() * outcomes.length)];
    
    const isWicket = result === 'W';
    const runs = isWicket ? 0 : result;

    if (runs === 6 || runs === 4) setVfx('rocket');
    if (isWicket) setVfx('explosion');

    // Calculate new stats
    const currentBalls = (innings === 1 ? balls1 : balls2) + 1;
    const currentScore = (innings === 1 ? score1 : score2) + runs;
    const currentWickets = (innings === 1 ? wickets1 : wickets2) + (isWicket ? 1 : 0);

    // Apply stats to the correct innings
    if (innings === 1) {
      if (isWicket) setWickets1(currentWickets); else setScore1(currentScore);
      setBalls1(currentBalls);
    } else {
      if (isWicket) setWickets2(currentWickets); else setScore2(currentScore);
      setBalls2(currentBalls);
    }

    setCommentaryFeed(prev => [...prev, { ball: currentBalls, text: "Simulating...", type: 'loading' }]);
    
    const aiText = await generateCommentary(runs, isWicket, currentBatter, currentBowler);
    
    setCommentaryFeed(prev => {
      const newFeed = [...prev];
      newFeed.pop(); 
      newFeed.push({ 
        ball: currentBalls, 
        text: aiText, 
        runs: result,
        type: isWicket ? 'wicket' : (runs === 6 || runs === 4) ? 'boundary' : 'normal'
      });
      return newFeed;
    });

    // Handle Wicket Replacements
    if (isWicket && currentWickets < 10) {
      const battingTeam = innings === 1 ? team1 : team2;
      const remainingPlayers = battingTeam.filter(p => p.id !== currentBatter.id);
      if (remainingPlayers.length > 0) {
        setCurrentBatter(remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)]);
      }
    }

    // Wait for animations, then check win/loss conditions
    setTimeout(() => {
      setVfx(null);
      setIsSimulating(false);

      if (innings === 2) {
        // Did they pass the target? Or lose all wickets?
        if (currentScore > score1 || currentWickets >= 10) {
          setAppState('postMatch');
        }
      }
    }, 1200); 
  };

  // UI Helpers
  const activeScore = innings === 1 ? score1 : score2;
  const activeWickets = innings === 1 ? wickets1 : wickets2;
  const activeBalls = innings === 1 ? balls1 : balls2;
  
  const overs = Math.floor(activeBalls / 6);
  const legalBalls = activeBalls % 6;
  const target = score1 + 1;
  const runsNeeded = target - score2;

  // Render
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden relative">
      
      {/* VFX Overlay */}
      {vfx === 'rocket' && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center animate-rocket text-8xl">🚀</div>
      )}
      {vfx === 'explosion' && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center animate-explosion text-9xl">💥</div>
      )}

      {/* Header */}
      <header className="bg-black/50 backdrop-blur-md border-b border-emerald-500/30 p-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            CRICVERSE <span className="text-white">PRO</span>
          </h1>
          <div className="text-sm font-bold bg-emerald-500/20 text-emerald-400 px-4 py-1 rounded-full border border-emerald-500/30">
            {appState === 'postMatch' ? 'FULL TIME' : appState === 'match' ? `INNINGS ${innings} LIVE` : 'STUDIO SETUP'}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-8">
        
        {/* --- DRAFT SCREEN --- */}
        {(appState === 'config' || appState === 'draft') && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Pre-Match Draft</h2>
              <button onClick={startMatch} className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                ENTER STADIUM ➔
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                <h3 className="text-emerald-400 font-bold mb-2 sticky top-0 bg-slate-900 py-2">Available Players</h3>
                {availablePlayers.map(p => (
                  <div key={p.id} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center border border-slate-700">
                    <div>
                      <span className="font-bold">{p.name}</span>
                      <span className="text-xs text-slate-400 ml-2 bg-slate-950 px-2 py-1 rounded">{p.role}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => draftPlayer(p, 1)} className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded font-bold hover:bg-emerald-500 hover:text-black">T1</button>
                      <button onClick={() => draftPlayer(p, 2)} className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded font-bold hover:bg-cyan-500 hover:text-black">T2</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- LIVE MATCH DASHBOARD --- */}
        {appState === 'match' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              
              {/* Target HUD for 2nd Innings */}
              {innings === 2 && (
                <div className="bg-cyan-950/50 border border-cyan-500/30 rounded-2xl p-4 flex justify-between items-center animate-fade-in shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <div>
                    <span className="text-cyan-400 font-bold uppercase text-sm tracking-widest block">Run Chase Target</span>
                    <span className="text-3xl font-black text-white">{target}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold uppercase text-sm tracking-widest block">Need</span>
                    <span className="text-2xl font-black text-white">{runsNeeded > 0 ? runsNeeded : 0} runs to win</span>
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500"></div>
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">Team {innings} Batting</h3>
                    <div className="text-7xl font-black tracking-tighter font-mono">
                      {activeScore}<span className="text-4xl text-slate-500">/{activeWickets}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">Overs</h3>
                    <div className="text-5xl font-black text-cyan-400 font-mono">
                      {overs}.{legalBalls}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-700/50">
                  <div>
                    <div className="text-xs text-emerald-400 font-bold uppercase mb-1">🏏 Striker</div>
                    <div className="font-bold text-xl">{currentBatter?.name || 'TBD'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-cyan-400 font-bold uppercase mb-1">🥎 Bowler</div>
                    <div className="font-bold text-xl">{currentBowler?.name || 'TBD'}</div>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTON */}
              {innings === 1 && activeWickets >= 10 ? (
                <button onClick={() => setAppState('inningsBreak')} className="w-full py-6 rounded-2xl text-2xl font-black uppercase tracking-widest transition-all shadow-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 animate-pulse">
                  PROCEED TO INNINGS BREAK ➔
                </button>
              ) : (
                <button 
                  onClick={playBall}
                  disabled={isSimulating}
                  className={`w-full py-6 rounded-2xl text-2xl font-black uppercase tracking-widest transition-all shadow-xl
                    ${isSimulating ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-95'}`}
                >
                  {isSimulating ? 'SIMULATING...' : 'BOWL NEXT BALL'}
                </button>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col h-[500px]">
              <h3 className="flex items-center text-lg font-bold text-slate-200 mb-4 pb-4 border-b border-slate-800">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2"></span>
                Live AI Commentary
              </h3>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {commentaryFeed.length === 0 && <p className="text-slate-500 text-center mt-10 italic">Waiting for first ball...</p>}
                {commentaryFeed.map((comm, idx) => (
                  <div key={idx} className="animate-fade-in flex gap-3">
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm font-mono
                      ${comm.type === 'wicket' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                        comm.type === 'boundary' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                        'bg-slate-800 text-slate-400'}`}>
                      {comm.runs}
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-r-xl rounded-bl-xl text-sm border border-slate-700/50 flex-1">
                      {comm.text}
                    </div>
                  </div>
                ))}
                <div ref={commentaryEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* --- INNINGS BREAK SCREEN --- */}
        {appState === 'inningsBreak' && (
          <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl text-center mt-10 animate-fade-in">
            <h2 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">INNINGS BREAK</h2>
            <p className="text-slate-400 mb-8 font-bold uppercase tracking-widest">Team 1 Innings Complete</p>
            
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 mb-8 inline-block shadow-inner">
              <div className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-2">Team 1 Final Score</div>
              <div className="text-8xl font-black text-white font-mono mb-2">{score1}<span className="text-5xl text-slate-600">/{wickets1}</span></div>
            </div>

            <div className="bg-cyan-500/10 p-6 rounded-2xl border border-cyan-500/30 shadow-lg max-w-sm mx-auto mb-10">
              <div className="text-sm text-cyan-400 uppercase font-bold">Team 2 Target to Win</div>
              <div className="text-5xl font-black text-cyan-400 mt-2">{score1 + 1}</div>
            </div>

            <button onClick={startSecondInnings} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black px-12 py-5 rounded-2xl text-xl transition-all shadow-[0_0_30px_rgba(6,182,212,0.4)] active:scale-95">
              START 2ND INNINGS ➔
            </button>
          </div>
        )}

        {/* --- POST MATCH (FULL TIME) SCREEN --- */}
        {appState === 'postMatch' && (
          <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl text-center mt-10 animate-fade-in">
            <h2 className="text-6xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              MATCH OVER
            </h2>
            
            <div className="text-2xl font-bold text-white mb-10 bg-slate-800 inline-block px-8 py-3 rounded-full border border-slate-700">
              {score2 > score1 
                ? `🏆 Team 2 Wins by ${10 - wickets2} wickets!` 
                : score1 > score2 
                  ? `🏆 Team 1 Wins by ${score1 - score2} runs!` 
                  : "🤝 It's a Tie!"}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div className={`p-8 rounded-2xl border ${score1 > score2 ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
                <h3 className="text-slate-400 font-bold uppercase tracking-widest mb-4">Team 1</h3>
                <div className="text-6xl font-black font-mono">{score1}<span className="text-3xl text-slate-500">/{wickets1}</span></div>
                <p className="text-slate-500 mt-2 font-mono">{Math.floor(balls1/6)}.{balls1%6} Overs</p>
              </div>
              
              <div className={`p-8 rounded-2xl border ${score2 > score1 ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-950 border-slate-800'}`}>
                <h3 className="text-slate-400 font-bold uppercase tracking-widest mb-4">Team 2</h3>
                <div className="text-6xl font-black font-mono">{score2}<span className="text-3xl text-slate-500">/{wickets2}</span></div>
                <p className="text-slate-500 mt-2 font-mono">{Math.floor(balls2/6)}.{balls2%6} Overs</p>
              </div>
            </div>

            <button onClick={() => window.location.reload()} className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-8 py-4 rounded-xl transition-colors border border-slate-700 shadow-xl">
              ↻ Start New Match
            </button>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
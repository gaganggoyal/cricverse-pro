import { useState, useRef, useEffect } from 'react';
import { playerDatabase } from './players';

// ⚠️ PASTE YOUR API KEY HERE
const GEMINI_API_KEY = 'AQ.Ab8RN6I87Wir3iRdpMP6MI09fvFC3TuE3sFjjCIGu6Su3wEQhA';

function App() {
  const [appState, setAppState] = useState('config'); // config, draft, match
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState(playerDatabase);

  // Match State
  const [score, setScore] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [balls, setBalls] = useState(0);
  const [commentaryFeed, setCommentaryFeed] = useState([]);
  const [currentBatter, setCurrentBatter] = useState(null);
  const [currentBowler, setCurrentBowler] = useState(null);
  
  // Visual FX State
  const [vfx, setVfx] = useState(null); // 'rocket', 'explosion', or null
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
    // Set opening players
    setCurrentBatter(team1.find(p => p.role === 'Batter' || p.role === 'All-Rounder') || team1[0]);
    setCurrentBowler(team2.find(p => p.role === 'Bowler' || p.role === 'All-Rounder') || team2[0]);
    setAppState('match');
  };

// --- UPGRADED GEMINI AI COMMENTARY ENGINE ---
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

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9 }
        })
      });
      
      const data = await response.json();

      // 🚨 NEW: Actually check if Google rejected the request!
      if (!response.ok) {
        console.error("Google AI Error:", data);
        return `[API REJECTED] ${data.error?.message || "Check browser console!"}`;
      }

      return data.candidates[0].content.parts[0].text.replace(/[*"]/g, '');
    } catch (error) {
      console.error("Network/Crash Error:", error);
      return `[NETWORK ERROR] Could not reach AI server.`;
    }
  };

  // --- MATCH SIMULATION ENGINE ---
  const playBall = async () => {
    if (isSimulating || wickets >= 10) return;
    setIsSimulating(true);
    setVfx(null);

    // 1. Math Simulation (Weighted randomness based on format)
    const outcomes = [0, 1, 1, 2, 4, 4, 6, 'W'];
    const result = outcomes[Math.floor(Math.random() * outcomes.length)];
    
    const isWicket = result === 'W';
    const runs = isWicket ? 0 : result;

    // 2. Trigger Visual Effects
    if (runs === 6 || runs === 4) setVfx('rocket');
    if (isWicket) setVfx('explosion');

    // 3. Update Scoreboard immediately
    if (isWicket) setWickets(w => w + 1);
    else setScore(s => s + runs);
    setBalls(b => b + 1);

    // 4. Fetch AI Commentary in background
    setCommentaryFeed(prev => [...prev, { ball: balls + 1, text: "Simulating...", type: 'loading' }]);
    
    const aiText = await generateCommentary(runs, isWicket, currentBatter, currentBowler);
    
    // 5. Update Feed with final AI text
    setCommentaryFeed(prev => {
      const newFeed = [...prev];
      newFeed.pop(); // remove loading state
      newFeed.push({ 
        ball: balls + 1, 
        text: aiText, 
        runs: result,
        type: isWicket ? 'wicket' : (runs === 6 || runs === 4) ? 'boundary' : 'normal'
      });
      return newFeed;
    });

    // 6. Handle Wicket Replacement Logic
    if (isWicket) {
      const remainingPlayers = team1.filter(p => p.id !== currentBatter.id);
      if (wickets + 1 < 10 && remainingPlayers.length > 0) {
        // Just picking the next available player for now
        setCurrentBatter(remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)]);
      }
    }

    setTimeout(() => {
      setVfx(null);
      setIsSimulating(false);
    }, 1200); // Wait for animations to finish
  };

  const overs = Math.floor(balls / 6);
  const legalBalls = balls % 6;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden relative">
      
      {/* VFX Overlay */}
      {vfx === 'rocket' && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center animate-rocket text-8xl">
          🚀
        </div>
      )}
      {vfx === 'explosion' && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center animate-explosion text-9xl">
          💥
        </div>
      )}

      {/* Header */}
      <header className="bg-black/50 backdrop-blur-md border-b border-emerald-500/30 p-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            CRICVERSE <span className="text-white">PRO</span>
          </h1>
          <div className="text-sm font-bold bg-emerald-500/20 text-emerald-400 px-4 py-1 rounded-full border border-emerald-500/30">
            {appState === 'match' ? 'LIVE BROADCAST' : 'STUDIO SETUP'}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-8">
        
        {/* --- DRAFT SCREEN (Condensed for quick setup) --- */}
        {(appState === 'config' || appState === 'draft') && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Pre-Match Draft</h2>
              <button 
                onClick={startMatch}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                ENTER STADIUM ➔
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                <h3 className="text-emerald-400 font-bold mb-2 sticky top-0 bg-slate-900 py-2">Available Players</h3>
                {availablePlayers.map(p => (
                  <div key={p.id} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center border border-slate-700">
                    <div>
                      <span className="font-bold">{p.name}</span>
                      <span className="text-xs text-slate-400 ml-2 bg-slate-950 px-2 py-1 rounded">{p.role}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => draftPlayer(p, 1)} className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded font-bold hover:bg-emerald-500 hover:text-black transition-colors">T1</button>
                      <button onClick={() => draftPlayer(p, 2)} className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded font-bold hover:bg-cyan-500 hover:text-black transition-colors">T2</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-500/30">
                  <h3 className="text-emerald-400 font-bold mb-4">Team 1 ({team1.length})</h3>
                  {team1.map(p => <div key={p.id} className="text-sm py-1 border-b border-slate-700/50">{p.name}</div>)}
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-cyan-500/30">
                  <h3 className="text-cyan-400 font-bold mb-4">Team 2 ({team2.length})</h3>
                  {team2.map(p => <div key={p.id} className="text-sm py-1 border-b border-slate-700/50">{p.name}</div>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- LIVE MATCH DASHBOARD --- */}
        {appState === 'match' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Score & Controls */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Broadcast Scoreboard */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500"></div>
                
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">Team 1</h3>
                    <div className="text-7xl font-black tracking-tighter font-mono">
                      {score}<span className="text-4xl text-slate-500">/{wickets}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">Overs</h3>
                    <div className="text-5xl font-black text-cyan-400 font-mono">
                      {overs}.{legalBalls}
                    </div>
                  </div>
                </div>

                {/* Current Players */}
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

              {/* Action Button */}
              <button 
                onClick={playBall}
                disabled={isSimulating || wickets >= 10}
                className={`w-full py-6 rounded-2xl text-2xl font-black uppercase tracking-widest transition-all shadow-xl
                  ${isSimulating || wickets >= 10 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 hover:scale-[1.02] shadow-emerald-500/20 active:scale-95'
                  }`}
              >
                {wickets >= 10 ? 'INNINGS OVER' : isSimulating ? 'SIMULATING...' : 'BOWL NEXT BALL'}
              </button>
            </div>

            {/* Right Column: AI Commentary Feed */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col h-[500px]">
              <h3 className="flex items-center text-lg font-bold text-slate-200 mb-4 pb-4 border-b border-slate-800">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2"></span>
                Live AI Commentary
              </h3>
              
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {commentaryFeed.length === 0 && (
                  <p className="text-slate-500 text-center mt-10 italic">Waiting for first ball...</p>
                )}
                
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
      </main>
    </div>
  );
}

export default App;
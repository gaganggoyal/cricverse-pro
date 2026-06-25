import { useState, useRef, useEffect } from 'react';
import { playerDatabase } from './players';

// 🚨 PASTE YOUR API KEY HERE!
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';

function App() {
  const [appState, setAppState] = useState('config'); 
  const [team1Name, setTeam1Name] = useState('Mumbai Indians');
  const [team2Name, setTeam2Name] = useState('Chennai Super Kings');
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState(playerDatabase);

  const [tossWinner, setTossWinner] = useState(null);
  const [isFlipping, setIsFlipping] = useState(false);

  const [innings, setInnings] = useState(1);
  const [score1, setScore1] = useState(0);
  const [wickets1, setWickets1] = useState(0);
  const [balls1, setBalls1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [wickets2, setWickets2] = useState(0);
  const [balls2, setBalls2] = useState(0);

  const [playerStats, setPlayerStats] = useState({});
  const [commentaryFeed, setCommentaryFeed] = useState([]);
  const [currentBatter, setCurrentBatter] = useState(null);
  const [currentBowler, setCurrentBowler] = useState(null);
  const [partnership, setPartnership] = useState({ runs: 0, balls: 0 });
  const [thisOver, setThisOver] = useState([]); 

  const [needsBowlerSelection, setNeedsBowlerSelection] = useState(false);
  const [previousBowler, setPreviousBowler] = useState(null);

  const [vfx, setVfx] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isMuted, setIsMuted] = useState(false); 
  const commentaryEndRef = useRef(null);

  // --- NEW: SAVE GAME DETECTION STATE ---
  const [savedGameExists, setSavedGameExists] = useState(false);

  // 1. Check for save file when the app first loads
  useEffect(() => {
    if (localStorage.getItem('cricverseProSave')) {
      setSavedGameExists(true);
    }
    commentaryEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [commentaryFeed]);

  // 2. AUTO-SAVE ENGINE: Triggers every time core state changes!
  useEffect(() => {
    if (appState !== 'config') {
      const gameState = {
        appState, team1Name, team2Name, team1, team2, availablePlayers,
        tossWinner, innings, score1, wickets1, balls1, score2, wickets2, balls2,
        playerStats, commentaryFeed, currentBatter, currentBowler, previousBowler,
        partnership, thisOver, needsBowlerSelection
      };
      localStorage.setItem('cricverseProSave', JSON.stringify(gameState));
    }
  }, [appState, team1Name, team2Name, team1, team2, availablePlayers, tossWinner, innings, score1, wickets1, balls1, score2, wickets2, balls2, playerStats, commentaryFeed, currentBatter, currentBowler, previousBowler, partnership, thisOver, needsBowlerSelection]);

  // 3. LOAD GAME FUNCTION
  const loadGame = () => {
    const saved = localStorage.getItem('cricverseProSave');
    if (saved) {
      const data = JSON.parse(saved);
      setAppState(data.appState); setTeam1Name(data.team1Name); setTeam2Name(data.team2Name);
      setTeam1(data.team1); setTeam2(data.team2); setAvailablePlayers(data.availablePlayers);
      setTossWinner(data.tossWinner); setInnings(data.innings); 
      setScore1(data.score1); setWickets1(data.wickets1); setBalls1(data.balls1);
      setScore2(data.score2); setWickets2(data.wickets2); setBalls2(data.balls2);
      setPlayerStats(data.playerStats); setCommentaryFeed(data.commentaryFeed);
      setCurrentBatter(data.currentBatter); setCurrentBowler(data.currentBowler);
      setPreviousBowler(data.previousBowler); setPartnership(data.partnership);
      setThisOver(data.thisOver); setNeedsBowlerSelection(data.needsBowlerSelection);
    }
  };

  // 4. RESET MATCH FUNCTION
  const startNewMatch = () => {
    localStorage.removeItem('cricverseProSave'); // Delete the save file!
    window.location.reload();
  };

  const playAudio = (type) => {
    if (isMuted) return;
    const sounds = { hit: '/hit.mp3', cheer: '/cheer.mp3', out: '/out.mp3' };
    const audio = new Audio(sounds[type]);
    audio.volume = type === 'hit' ? 1.0 : 0.4;
    audio.play().catch(e => console.warn("Browser blocked audio"));
  };

  const draftPlayer = (player, team) => {
    if (team === 1) setTeam1([...team1, player]);
    if (team === 2) setTeam2([...team2, player]);
    setAvailablePlayers(availablePlayers.filter(p => p.id !== player.id));
  };

  const flipCoin = () => {
    setIsFlipping(true);
    setTimeout(() => {
      setTossWinner(Math.random() > 0.5 ? team1Name : team2Name);
      setIsFlipping(false);
    }, 1500);
  };

  const handleTossChoice = (choice) => {
    let finalBattingTeam = team1;
    let finalBowlingTeam = team2;
    if ((tossWinner === team1Name && choice === 'Bowl') || (tossWinner === team2Name && choice === 'Bat')) {
      finalBattingTeam = team2; finalBowlingTeam = team1;
      setTeam1(team2); setTeam2(team1);
      setTeam1Name(team2Name); setTeam2Name(team1Name);
    }

    const initialStats = {};
    [...finalBattingTeam, ...finalBowlingTeam].forEach(p => {
      initialStats[p.id] = { runs: 0, ballsFaced: 0, wickets: 0, runsGiven: 0, ballsBowled: 0 };
    });
    setPlayerStats(initialStats); setPartnership({ runs: 0, balls: 0 }); setThisOver([]);
    setCurrentBatter(finalBattingTeam.find(p => p.role === 'Batter' || p.role === 'All-Rounder') || finalBattingTeam[0]);
    
    setCurrentBowler(null); setPreviousBowler(null); setNeedsBowlerSelection(true);
    setAppState('match');
  };

  const startSecondInnings = () => {
    setInnings(2);
    setCommentaryFeed([]); 
    setPartnership({ runs: 0, balls: 0 });
    setThisOver([]);
    setCurrentBatter(team2.find(p => p.role === 'Batter' || p.role === 'All-Rounder') || team2[0]);
    
    setCurrentBowler(null); setPreviousBowler(null); setNeedsBowlerSelection(true);
    setAppState('match');
  };

  const generateCommentary = async (result, isWicket, isExtra, batter, bowler) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') return `[API KEY MISSING] Add key at top of App.jsx!`;
    let prompt = `You are a live T20 cricket commentator. Match: ${team1Name} vs ${team2Name}. Write ONE short, thrilling sentence of live commentary. Bowler: ${bowler.name}. Batter: ${batter.name}. `;
    if (isWicket) prompt += `Outcome: OUT! It's a spectacular wicket. Make it dramatic.`;
    else if (result === 'Wd') prompt += `Outcome: Wide ball! Terrible line by the bowler.`;
    else if (result === 'Nb') prompt += `Outcome: No ball! The bowler overstepped.`;
    else if (result === 6) prompt += `Outcome: 6 runs! Massive six!`;
    else if (result === 4) prompt += `Outcome: 4 runs! Beautiful boundary.`;
    else if (result === 0) prompt += `Outcome: Dot ball. Good defense or miss.`;
    else prompt += `Outcome: ${result} run(s) taken.`;
    if (innings === 2) prompt += ` Context: ${team2Name} is chasing a target of ${score1 + 1}.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9 } })
      });
      const data = await response.json();
      if (!response.ok) return `[API REJECTED] ${data.error?.message}`;
      return data.candidates[0].content.parts[0].text.replace(/[*"]/g, '');
    } catch (error) { return `[NETWORK ERROR] Could not reach AI server.`; }
  };

  const processDelivery = () => {
    const outcomes = [0, 1, 1, 2, 4, 4, 6, 'W', 'Wd', 'Nb'];
    const result = outcomes[Math.floor(Math.random() * outcomes.length)];
    const isWicket = result === 'W';
    const isExtra = result === 'Wd' || result === 'Nb';
    return { result, isWicket, isExtra, totalRunsThisBall: isWicket ? 0 : isExtra ? 1 : result, batterRuns: isExtra ? 0 : (isWicket ? 0 : result) };
  };

  const playBall = async () => {
    if (isSimulating || needsBowlerSelection) return;
    if (innings === 1 && wickets1 >= 10) return;
    if (innings === 2 && (wickets2 >= 10 || score2 > score1)) return;

    setIsSimulating(true);
    setVfx(null);

    const { result, isWicket, isExtra, totalRunsThisBall, batterRuns } = processDelivery();

    if (isWicket) { setVfx('explosion'); playAudio('out'); }
    else if (result === 6 || result === 4) { setVfx('rocket'); playAudio('hit'); setTimeout(() => playAudio('cheer'), 300); } 
    else if (totalRunsThisBall > 0 && !isExtra) { playAudio('hit'); }

    let newThisOver = [...thisOver];
    if (newThisOver.filter(r => r !== 'Wd' && r !== 'Nb').length === 6) newThisOver = [];
    newThisOver.push(result);
    setThisOver(newThisOver);

    setPartnership(prev => {
      if (isWicket) return { runs: 0, balls: 0 };
      return { runs: prev.runs + totalRunsThisBall, balls: prev.balls + (isExtra ? 0 : 1) };
    });

    const currentBalls = (innings === 1 ? balls1 : balls2) + (isExtra ? 0 : 1);
    const currentScore = (innings === 1 ? score1 : score2) + totalRunsThisBall;
    const currentWickets = (innings === 1 ? wickets1 : wickets2) + (isWicket ? 1 : 0);

    if (innings === 1) { if (isWicket) setWickets1(currentWickets); else setScore1(currentScore); setBalls1(currentBalls); } 
    else { if (isWicket) setWickets2(currentWickets); else setScore2(currentScore); setBalls2(currentBalls); }

    setPlayerStats(prev => {
      const newStats = structuredClone(prev);
      if (newStats[currentBatter.id]) { newStats[currentBatter.id].runs += batterRuns; if (!isExtra) newStats[currentBatter.id].ballsFaced += 1; }
      if (newStats[currentBowler.id]) { newStats[currentBowler.id].runsGiven += totalRunsThisBall; if (!isExtra) newStats[currentBowler.id].ballsBowled += 1; if (isWicket) newStats[currentBowler.id].wickets += 1; }
      return newStats;
    });

    setCommentaryFeed(prev => [...prev, { ball: currentBalls, text: "Simulating...", type: 'loading' }]);
    const aiText = await generateCommentary(result, isWicket, isExtra, currentBatter, currentBowler);
    
    setCommentaryFeed(prev => {
      const newFeed = [...prev]; newFeed.pop(); 
      newFeed.push({ ball: currentBalls, text: aiText, runs: result, type: isWicket ? 'wicket' : isExtra ? 'extra' : (result === 6 || result === 4) ? 'boundary' : 'normal' });
      return newFeed;
    });

    if (isWicket && currentWickets < 10) {
      const battingTeam = innings === 1 ? team1 : team2;
      const remainingPlayers = battingTeam.filter(p => p.id !== currentBatter.id && playerStats[p.id]?.ballsFaced === 0);
      if (remainingPlayers.length > 0) setCurrentBatter(remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)]);
    }

    const isEndOfInnings = currentWickets >= 10 || (innings === 2 && currentScore > score1);
    if (!isExtra && currentBalls > 0 && currentBalls % 6 === 0 && !isEndOfInnings) {
      setPreviousBowler(currentBowler);
      setNeedsBowlerSelection(true);
    }

    setTimeout(() => {
      setVfx(null);
      setIsSimulating(false);
      if (isEndOfInnings) setAppState('postMatch');
    }, 1200); 
  };

  const autoSimulate = () => {
    if (isSimulating || needsBowlerSelection) return;
    
    let tempBalls = innings === 1 ? balls1 : balls2;
    let tempScore = innings === 1 ? score1 : score2;
    let tempWickets = innings === 1 ? wickets1 : wickets2;
    let tempStats = structuredClone(playerStats);
    let tempBatter = currentBatter;
    let tempBowler = currentBowler;
    let tempPrevBowler = previousBowler;
    
    while (tempWickets < 10) {
      if (innings === 2 && tempScore > score1) break; 
      const { result, isWicket, isExtra, totalRunsThisBall, batterRuns } = processDelivery();

      if (!isExtra) tempBalls++;
      if (isWicket) tempWickets++; else tempScore += totalRunsThisBall;

      if (tempStats[tempBatter.id]) { tempStats[tempBatter.id].runs += batterRuns; if (!isExtra) tempStats[tempBatter.id].ballsFaced += 1; }
      if (tempStats[tempBowler.id]) { tempStats[tempBowler.id].runsGiven += totalRunsThisBall; if (!isExtra) tempStats[tempBowler.id].ballsBowled += 1; if (isWicket) tempStats[tempBowler.id].wickets += 1; }

      if (isWicket && tempWickets < 10) {
        const battingTeam = innings === 1 ? team1 : team2;
        const remainingPlayers = battingTeam.filter(p => p.id !== tempBatter.id && tempStats[p.id]?.ballsFaced === 0);
        if (remainingPlayers.length > 0) tempBatter = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
      }

      if (!isExtra && tempBalls > 0 && tempBalls % 6 === 0 && tempWickets < 10 && !(innings === 2 && tempScore > score1)) {
        const bowlingTeam = innings === 1 ? team2 : team1;
        const validBowlers = bowlingTeam.filter(p => p.id !== tempBowler.id && (tempStats[p.id]?.ballsBowled || 0) < 24);
        let nextBowlers = validBowlers.filter(p => p.role === 'Bowler' || p.role === 'All-Rounder');
        if (nextBowlers.length === 0) nextBowlers = validBowlers; 
        if (nextBowlers.length === 0) nextBowlers = bowlingTeam.filter(p => p.id !== tempBowler.id); 
        
        tempPrevBowler = tempBowler;
        tempBowler = nextBowlers[Math.floor(Math.random() * nextBowlers.length)];
      }
    }

    if (innings === 1) { setScore1(tempScore); setWickets1(tempWickets); setBalls1(tempBalls); } 
    else { setScore2(tempScore); setWickets2(tempWickets); setBalls2(tempBalls); }
    
    setPlayerStats(tempStats); setCurrentBatter(tempBatter); setCurrentBowler(tempBowler); setPreviousBowler(tempPrevBowler);
    setThisOver([]); 
    setCommentaryFeed(prev => [...prev, { ball: tempBalls, text: `⚡ Innings auto-simulated to completion.`, type: 'normal' }]);
    if (innings === 2 && (tempScore > score1 || tempWickets >= 10)) setAppState('postMatch');
  };

  const activeScore = innings === 1 ? score1 : score2;
  const activeWickets = innings === 1 ? wickets1 : wickets2;
  const activeBalls = innings === 1 ? balls1 : balls2;
  const overs = Math.floor(activeBalls / 6);
  const legalBalls = activeBalls % 6;
  const fieldingTeam = innings === 1 ? team2 : team1;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden relative selection:bg-emerald-500/30">
      {vfx === 'rocket' && <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center animate-rocket text-8xl">🚀</div>}
      {vfx === 'explosion' && <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center animate-explosion text-9xl">💥</div>}

      <header className="bg-black/50 backdrop-blur-md border-b border-emerald-500/30 p-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            CRICVERSE <span className="text-white">PRO</span>
          </h1>
          <div className="flex gap-4 items-center">
            <button onClick={() => setIsMuted(!isMuted)} className="text-2xl hover:scale-110 transition-transform" title={isMuted ? "Unmute" : "Mute"}>{isMuted ? '🔇' : '🔊'}</button>
            <div className="text-sm font-bold bg-emerald-500/20 text-emerald-400 px-4 py-1 rounded-full border border-emerald-500/30">
              {appState.toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-8">
        
        {appState === 'config' && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl mt-10 animate-fade-in text-center">
            <h2 className="text-3xl font-black mb-8 text-white">Match Setup</h2>
            <div className="space-y-6 mb-8 text-left">
              <div>
                <label className="block text-emerald-400 font-bold mb-2 uppercase text-xs tracking-widest">Home Team Name</label>
                <input type="text" value={team1Name} onChange={(e) => setTeam1Name(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white font-bold focus:border-emerald-500 focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-cyan-400 font-bold mb-2 uppercase text-xs tracking-widest">Away Team Name</label>
                <input type="text" value={team2Name} onChange={(e) => setTeam2Name(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white font-bold focus:border-cyan-500 focus:outline-none transition-colors" />
              </div>
            </div>
            
            <button onClick={() => setAppState('draft')} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              PROCEED TO DRAFT ➔
            </button>

            {/* --- NEW RESUME BUTTON --- */}
            {savedGameExists && (
              <button 
                onClick={loadGame} 
                className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-black px-8 py-4 rounded-xl transition-all shadow-lg"
              >
                🔄 RESUME SAVED MATCH
              </button>
            )}
          </div>
        )}

        {appState === 'draft' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Pre-Match Draft</h2>
              <button onClick={() => { if (team1.length === 0 || team2.length === 0) return alert("Draft players first!"); setAppState('toss'); }} className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">PROCEED TO TOSS ➔</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {availablePlayers.map(p => (
                  <div key={p.id} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center border border-slate-700">
                    <div><span className="font-bold">{p.name}</span><span className="text-xs text-slate-400 ml-2 bg-slate-950 px-2 py-1 rounded">{p.role}</span></div>
                    <div className="flex gap-2">
                      <button onClick={() => draftPlayer(p, 1)} className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded font-bold hover:bg-emerald-500 hover:text-black">{team1Name}</button>
                      <button onClick={() => draftPlayer(p, 2)} className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded font-bold hover:bg-cyan-500 hover:text-black">{team2Name}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {appState === 'toss' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 p-12 rounded-3xl shadow-2xl mt-10 animate-fade-in text-center">
            <h2 className="text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">THE COIN TOSS</h2>
            <div className="flex justify-center items-center gap-8 mb-12">
              <div className="text-xl font-bold text-emerald-400">{team1Name}</div><div className="text-slate-500 font-black italic">VS</div><div className="text-xl font-bold text-cyan-400">{team2Name}</div>
            </div>
            {!tossWinner ? (
              <button onClick={flipCoin} disabled={isFlipping} className={`w-40 h-40 rounded-full mx-auto flex items-center justify-center text-4xl font-black transition-all border-4 ${isFlipping ? 'bg-amber-500 border-amber-300 animate-spin text-black scale-110' : 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.1)]'}`}>
                {isFlipping ? '🪙' : 'FLIP'}
              </button>
            ) : (
              <div className="animate-fade-in">
                <div className="text-3xl font-black text-white mb-2">{tossWinner}</div>
                <div className="text-slate-400 font-bold uppercase tracking-widest mb-8">won the toss and elected to...</div>
                <div className="flex gap-6 justify-center">
                  <button onClick={() => handleTossChoice('Bat')} className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-12 py-5 rounded-2xl text-xl shadow-xl hover:scale-105 transition-all">🏏 BAT FIRST</button>
                  <button onClick={() => handleTossChoice('Bowl')} className="bg-cyan-500 hover:bg-cyan-400 text-black font-black px-12 py-5 rounded-2xl text-xl shadow-xl hover:scale-105 transition-all">🥎 BOWL FIRST</button>
                </div>
              </div>
            )}
          </div>
        )}

        {appState === 'match' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              
              {innings === 2 && (
                <div className="bg-cyan-950/50 border border-cyan-500/30 rounded-2xl p-4 flex justify-between items-center shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <div><span className="text-cyan-400 font-bold uppercase text-sm tracking-widest block">Run Chase Target</span><span className="text-3xl font-black text-white">{score1 + 1}</span></div>
                  <div className="text-right"><span className="text-emerald-400 font-bold uppercase text-sm tracking-widest block">Need</span><span className="text-2xl font-black text-white">{(score1 + 1) - score2 > 0 ? (score1 + 1) - score2 : 0} runs</span></div>
                </div>
              )}

              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500"></div>
                
                <div className="absolute top-4 right-8 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2">This Over:</span>
                  {thisOver.map((ball, idx) => (
                    <div key={idx} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-inner ${ball === 'W' ? 'bg-red-500 text-white' : ball === 'Wd' || ball === 'Nb' ? 'bg-amber-500 text-black' : ball === 6 || ball === 4 ? 'bg-emerald-500 text-black' : 'bg-slate-700 text-white'}`}>{ball}</div>
                  ))}
                  {thisOver.length === 0 && <span className="text-sm text-slate-600 italic">Waiting...</span>}
                </div>

                <div className="flex justify-between items-end mb-8 mt-6">
                  <div>
                    <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">{innings === 1 ? team1Name : team2Name} Batting</h3>
                    <div className="text-7xl font-black tracking-tighter font-mono flex items-baseline gap-2">{activeScore}<span className="text-4xl text-slate-500">/{activeWickets}</span></div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">Overs</h3>
                    <div className="text-5xl font-black text-cyan-400 font-mono">{overs}.{legalBalls}</div>
                  </div>
                </div>

                <div className="bg-slate-950/30 border-y border-slate-700/50 py-2 px-4 mb-4 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current Partnership</span>
                  <span className="font-mono font-bold text-emerald-400">{partnership.runs} runs <span className="text-slate-500">({partnership.balls} balls)</span></span>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-700/50">
                  <div>
                    <div className="text-xs text-emerald-400 font-bold uppercase mb-1">🏏 Striker</div>
                    <div className="font-bold text-xl">{currentBatter?.name || 'TBD'}</div>
                    <div className="text-sm font-mono text-slate-400 mt-1">{playerStats[currentBatter?.id]?.runs || 0} runs <span className="text-slate-600">({playerStats[currentBatter?.id]?.ballsFaced || 0} balls)</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-cyan-400 font-bold uppercase mb-1">🥎 Bowler</div>
                    <div className="font-bold text-xl">{currentBowler?.name || 'Waiting...'}</div>
                    <div className="text-sm font-mono text-slate-400 mt-1">{playerStats[currentBowler?.id]?.wickets || 0} W <span className="text-slate-600">/ {playerStats[currentBowler?.id]?.runsGiven || 0} runs</span></div>
                  </div>
                </div>
              </div>

              {innings === 1 && activeWickets >= 10 ? (
                <button onClick={() => setAppState('inningsBreak')} className="w-full py-6 rounded-2xl text-2xl font-black uppercase tracking-widest transition-all shadow-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 animate-pulse">PROCEED TO INNINGS BREAK ➔</button>
              ) : needsBowlerSelection ? (
                <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-3xl shadow-2xl animate-fade-in ring-2 ring-emerald-500/20">
                  <h3 className="text-emerald-400 font-bold uppercase tracking-widest mb-4 flex items-center justify-between">
                    <span>Select Bowler for Next Over</span><span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">Quota: 4 Overs</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {fieldingTeam.map(p => {
                      const stats = playerStats[p.id];
                      const oversBowled = Math.floor(stats.ballsBowled / 6);
                      const isMaxedOut = stats.ballsBowled >= 24;
                      const isPrevBowler = previousBowler?.id === p.id;
                      const disabled = isMaxedOut || isPrevBowler;

                      return (
                        <button key={p.id} disabled={disabled}
                          onClick={() => { setCurrentBowler(p); setNeedsBowlerSelection(false); setThisOver([]); }}
                          className={`p-3 rounded-xl flex flex-col items-start transition-all border ${disabled ? 'bg-slate-950 border-slate-800 opacity-50 cursor-not-allowed' : 'bg-slate-800 border-slate-700 hover:bg-emerald-500 hover:text-black hover:border-emerald-400'}`}
                        >
                          <span className="font-bold">{p.name}</span>
                          <span className="text-xs mt-1 font-mono">{isMaxedOut ? '🔒 Quota Reached' : isPrevBowler ? '⏳ Resting' : `${oversBowled}/4 Overs`}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  <button onClick={playBall} disabled={isSimulating} className={`flex-1 py-6 rounded-2xl text-2xl font-black uppercase tracking-widest transition-all shadow-xl ${isSimulating ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 active:scale-95'}`}>
                    {isSimulating ? 'SIMULATING...' : 'BOWL NEXT BALL'}
                  </button>
                  <button onClick={autoSimulate} disabled={isSimulating} className={`px-8 rounded-2xl text-lg font-bold uppercase transition-all shadow-xl ${isSimulating ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-400 active:scale-95'}`}>
                    ⚡ QUICK SIM
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col h-[500px]">
              <h3 className="flex items-center text-lg font-bold text-slate-200 mb-4 pb-4 border-b border-slate-800"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2"></span>Live AI Commentary</h3>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {commentaryFeed.length === 0 && <p className="text-slate-500 text-center mt-10 italic">Waiting for first ball...</p>}
                {commentaryFeed.map((comm, idx) => (
                  <div key={idx} className="animate-fade-in flex gap-3">
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm font-mono ${comm.type === 'wicket' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : comm.type === 'extra' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : comm.type === 'boundary' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                      {comm.runs !== undefined ? comm.runs : '⚡'}
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-r-xl rounded-bl-xl text-sm border border-slate-700/50 flex-1">{comm.text}</div>
                  </div>
                ))}
                <div ref={commentaryEndRef} />
              </div>
            </div>
          </div>
        )}

        {appState === 'inningsBreak' && (
          <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl text-center mt-10 animate-fade-in">
            <h2 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">INNINGS BREAK</h2>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 mb-8 inline-block shadow-inner">
              <div className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-2">{team1Name} Final Score</div>
              <div className="text-8xl font-black text-white font-mono mb-2">{score1}<span className="text-5xl text-slate-600">/{wickets1}</span></div>
            </div>
            <button onClick={startSecondInnings} className="bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black px-12 py-5 rounded-2xl text-xl hover:scale-[1.02] active:scale-95 transition-all w-full md:w-auto">START 2ND INNINGS ➔</button>
          </div>
        )}

        {appState === 'postMatch' && (
          <div className="max-w-6xl mx-auto bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl mt-10 animate-fade-in">
            <div className="text-center mb-10">
              <h2 className="text-6xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">MATCH OVER</h2>
              <div className="text-2xl font-bold text-white bg-slate-800 inline-block px-8 py-3 rounded-full border border-slate-700 shadow-lg">
                {score2 > score1 ? `🏆 ${team2Name} Wins by ${10 - wickets2} wickets!` : score1 > score2 ? `🏆 ${team1Name} Wins by ${score1 - score2} runs!` : "🤝 It's a Tie!"}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                  <h3 className="font-black text-xl">{team1Name} Batting</h3>
                  <div className="font-mono text-xl text-emerald-400">{score1}/{wickets1}</div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-800 pb-2">
                    <div className="flex-1">Batter</div><div className="w-12 text-center">R</div><div className="w-12 text-center">B</div>
                  </div>
                  {team1.map(p => playerStats[p.id]?.ballsFaced > 0 && (
                    <div key={p.id} className="flex text-sm items-center py-1 border-b border-slate-800/50">
                      <div className="flex-1 font-bold">{p.name}</div><div className="w-12 text-center font-mono text-emerald-400">{playerStats[p.id].runs}</div><div className="w-12 text-center font-mono text-slate-400">{playerStats[p.id].ballsFaced}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                  <h3 className="font-black text-xl">{team2Name} Batting</h3>
                  <div className="font-mono text-xl text-cyan-400">{score2}/{wickets2}</div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-800 pb-2">
                    <div className="flex-1">Batter</div><div className="w-12 text-center">R</div><div className="w-12 text-center">B</div>
                  </div>
                  {team2.map(p => playerStats[p.id]?.ballsFaced > 0 && (
                    <div key={p.id} className="flex text-sm items-center py-1 border-b border-slate-800/50">
                      <div className="flex-1 font-bold">{p.name}</div><div className="w-12 text-center font-mono text-cyan-400">{playerStats[p.id].runs}</div><div className="w-12 text-center font-mono text-slate-400">{playerStats[p.id].ballsFaced}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* --- UPDATED TO WIPE SAVE FILE ON RESTART --- */}
            <div className="text-center">
              <button onClick={startNewMatch} className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-8 py-4 rounded-xl transition-colors border border-slate-700 shadow-xl">
                ↻ Start New Match
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
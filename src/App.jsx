import { useState, useRef, useEffect } from 'react';
import { playerDatabase } from './players';

function App() {
  // --- STATE MANAGEMENT ---
  const [appState, setAppState] = useState('config'); 
  const [team1Name, setTeam1Name] = useState('Mumbai Indians');
  const [team2Name, setTeam2Name] = useState('Chennai Super Kings');
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);

  const [tossWinner, setTossWinner] = useState(null);
  const [isFlipping, setIsFlipping] = useState(false);

  // Server-Driven State
  const [serverId, setServerId] = useState(null);
  const [serverData, setServerData] = useState(null);
  const [prevBalls, setPrevBalls] = useState(0);
  const [commentaryFeed, setCommentaryFeed] = useState([]);
  const commentaryEndRef = useRef(null);

  // Auto-scroll for commentary
  useEffect(() => {
    commentaryEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [commentaryFeed]);

  // Live Polling Engine
  useEffect(() => {
    if (appState !== 'match' || !serverId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/matches/${serverId}/score`);
        if (!res.ok) return;
        const data = await res.json();
        setServerData(data);
      } catch (err) {
        console.log("Waiting for server...");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [appState, serverId]);

  // Read AI Commentary from Server
  useEffect(() => {
    if (serverData && serverData.balls > prevBalls) {
      setPrevBalls(serverData.balls);
      const d = serverData.last_delivery;
      
      if (d && d.speed) {
        const aiText = d.commentary || "Awaiting AI analysis...";

        setCommentaryFeed(prev => [...prev, {
          ball: serverData.balls,
          text: aiText,
          runs: d.result,
          type: d.result === 'W' ? 'wicket' : (d.result === 6 || d.result === 4) ? 'boundary' : 'normal'
        }]);
      }
    }
  }, [serverData, prevBalls]);

  // --- UI ACTIONS ---
  
  // NEW: Dropdown selection logic
  const addPlayerToTeam = (playerId, teamNum) => {
    if (!playerId) return;
    const player = playerDatabase.find(p => p.id === parseInt(playerId));
    
    if (teamNum === 1 && !team1.find(p => p.id === player.id)) setTeam1([...team1, player]);
    if (teamNum === 2 && !team2.find(p => p.id === player.id)) setTeam2([...team2, player]);
  };

  const removePlayer = (playerId, teamNum) => {
    if (teamNum === 1) setTeam1(team1.filter(p => p.id !== playerId));
    if (teamNum === 2) setTeam2(team2.filter(p => p.id !== playerId));
  };

  const flipCoin = () => {
    setIsFlipping(true);
    setTimeout(() => {
      setTossWinner(Math.random() > 0.5 ? team1Name : team2Name);
      setIsFlipping(false);
    }, 1500);
  };

  const startServerMatch = async () => {
    try {
      let battingFirst = team1;
      let bowlingFirst = team2;
      
      if (tossWinner === team2Name) {
        battingFirst = team2;
        bowlingFirst = team1;
      }

      const createRes = await fetch('http://127.0.0.1:8000/matches/', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batting_team: battingFirst,
          bowling_team: bowlingFirst
        })
      });
      
      const matchData = await createRes.json();
      const newId = matchData.id;
      setServerId(newId);

      await fetch(`http://127.0.0.1:8000/matches/${newId}/start`, { method: 'POST' });
      setAppState('match');
    } catch (err) {
      alert("Error: Cannot connect to Python server. Is FastAPI running?");
    }
  };

  const renderRoleBadge = (role) => {
    let colors = 'bg-slate-700 text-slate-300 border-slate-600';
    if (role === 'Batter') colors = 'bg-blue-900/40 text-blue-400 border-blue-500/30';
    if (role === 'Bowler') colors = 'bg-rose-900/40 text-rose-400 border-rose-500/30';
    if (role === 'All-Rounder') colors = 'bg-purple-900/40 text-purple-400 border-purple-500/30';
    return <div className={`w-10 h-6 flex items-center justify-center rounded text-[9px] font-black tracking-widest border ${colors}`}>{role.substring(0,4).toUpperCase()}</div>;
  };

  // Safe Server Data Variables
  const activeScore = serverData?.score || 0;
  const activeWickets = serverData?.wickets || 0;
  const activeBalls = serverData?.balls || 0;
  const overs = Math.floor(activeBalls / 6);
  const legalBalls = activeBalls % 6;
  const striker = serverData?.striker || { name: "Waiting...", runs: 0, balls: 0 };
  const bowler = serverData?.bowler || { name: "Waiting...", wickets: 0, runs: 0 };
  const lastDelivery = serverData?.last_delivery;
  const thisOver = serverData?.recent_overs || [];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden">
      <header className="bg-slate-950 border-b border-slate-800 p-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-black text-xs">CP</div>
            CRICVERSE <span className="text-emerald-500">PRO</span>
          </h1>
          <div className="text-xs font-bold bg-slate-900 text-slate-300 px-3 py-1 rounded border border-slate-800 uppercase tracking-widest">
            {appState}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-8">
        
        {/* --- 1. CONFIG SCREEN --- */}
        {appState === 'config' && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl mt-10">
            <h2 className="text-xl font-bold mb-6 text-white uppercase tracking-widest border-b border-slate-800 pb-4">Match Setup</h2>
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-slate-500 font-bold mb-2 uppercase text-[10px] tracking-widest">Home Team</label>
                <input type="text" value={team1Name} onChange={(e) => setTeam1Name(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white font-bold focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-2 uppercase text-[10px] tracking-widest">Away Team</label>
                <input type="text" value={team2Name} onChange={(e) => setTeam2Name(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white font-bold focus:border-cyan-500 outline-none" />
              </div>
            </div>
            <button onClick={() => setAppState('draft')} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black px-6 py-3 rounded uppercase tracking-widest text-sm transition-colors">Proceed to Draft</button>
          </div>
        )}

        {/* --- 2. DRAFT SCREEN (WITH DROPDOWNS) --- */}
        {appState === 'draft' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white uppercase tracking-widest">Team Selection</h2>
              <button 
                onClick={() => {
                  if (team1.length < 2 || team2.length < 2) return alert("Select at least 2 players per team!");
                  setAppState('toss');
                }} 
                className="bg-emerald-500 text-black font-bold px-6 py-2 rounded text-sm uppercase tracking-widest hover:bg-emerald-400 transition-colors"
              >
                Confirm Rosters
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Team 1 Panel */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg">
                <h3 className="font-black text-emerald-500 uppercase tracking-widest mb-4">{team1Name} ({team1.length} Players)</h3>
                <select 
                  onChange={(e) => { addPlayerToTeam(e.target.value, 1); e.target.value = ""; }} 
                  className="w-full bg-slate-900 border border-slate-700 p-3 rounded mb-4 text-sm font-bold focus:border-emerald-500 outline-none"
                >
                  <option value="">+ Add a player...</option>
                  {playerDatabase.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                  ))}
                </select>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {team1.map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded">
                      <div className="flex items-center gap-3">
                        {renderRoleBadge(p.role)}
                        <span className="text-sm font-bold text-slate-200">{p.name}</span>
                      </div>
                      <button onClick={() => removePlayer(p.id, 1)} className="text-red-500 hover:bg-red-500/20 px-2 py-1 rounded text-xs font-bold transition-colors">Remove</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team 2 Panel */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg">
                <h3 className="font-black text-cyan-500 uppercase tracking-widest mb-4">{team2Name} ({team2.length} Players)</h3>
                <select 
                  onChange={(e) => { addPlayerToTeam(e.target.value, 2); e.target.value = ""; }} 
                  className="w-full bg-slate-900 border border-slate-700 p-3 rounded mb-4 text-sm font-bold focus:border-cyan-500 outline-none"
                >
                  <option value="">+ Add a player...</option>
                  {playerDatabase.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                  ))}
                </select>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {team2.map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded">
                      <div className="flex items-center gap-3">
                        {renderRoleBadge(p.role)}
                        <span className="text-sm font-bold text-slate-200">{p.name}</span>
                      </div>
                      <button onClick={() => removePlayer(p.id, 2)} className="text-red-500 hover:bg-red-500/20 px-2 py-1 rounded text-xs font-bold transition-colors">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- 3. TOSS SCREEN --- */}
        {appState === 'toss' && (
          <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 p-10 rounded-xl shadow-2xl mt-10 text-center animate-fade-in">
            <h2 className="text-xl font-bold mb-8 text-white uppercase tracking-widest border-b border-slate-800 pb-4">The Toss</h2>
            <div className="flex justify-center items-center gap-6 mb-10">
              <div className="font-bold text-emerald-400">{team1Name}</div><div className="text-slate-600 text-sm font-black italic">VS</div><div className="font-bold text-cyan-400">{team2Name}</div>
            </div>
            {!tossWinner ? (
              <button onClick={flipCoin} disabled={isFlipping} className={`w-32 h-32 rounded-full mx-auto flex items-center justify-center text-xl font-black uppercase tracking-widest transition-all border-4 ${isFlipping ? 'bg-slate-800 border-slate-600 animate-spin text-slate-500' : 'bg-slate-950 border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-black'}`}>
                {isFlipping ? '...' : 'Flip'}
              </button>
            ) : (
              <div className="animate-fade-in">
                <div className="text-2xl font-black text-white mb-2">{tossWinner}</div>
                <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8">won the toss!</div>
                <button onClick={startServerMatch} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-10 py-4 rounded text-sm uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  Connect to Server & Start Match
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- 4. MATCH SCREEN (LIVE CENTER) --- */}
        {appState === 'match' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="lg:col-span-2 space-y-6">
              
              <div className="w-full bg-slate-900 rounded-xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col p-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-5">
                  <h3 className="text-emerald-500 font-bold tracking-widest text-xs uppercase flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Live Server Feed (ID: {serverId})</h3>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-center">
                     <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Striker</div>
                     <div>
                       <div className="text-lg font-bold text-white truncate">{striker.name}</div>
                       <div className="text-4xl font-mono text-emerald-400 mt-2 leading-none">
                         {striker.runs}
                         <span className="text-xl text-slate-500 font-mono ml-1">({striker.balls})</span>
                       </div>
                     </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-center">
                     <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Bowler</div>
                     <div>
                       <div className="text-lg font-bold text-white truncate">{bowler.name}</div>
                       <div className="text-4xl font-mono text-cyan-400 mt-2 leading-none">
                         {bowler.wickets}
                         <span className="text-xl text-slate-500 font-mono ml-1">- {bowler.runs}</span>
                       </div>
                     </div>
                  </div>
                </div>

                {lastDelivery && (
                  <div className="mt-5 bg-slate-950 border border-slate-800 rounded flex justify-between p-3">
                    <div className="text-left">
                      <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Speed Gun</span><br/>
                      <span className="text-white text-sm font-mono font-bold">{lastDelivery.speed} <span className="text-xs text-slate-500">km/h</span></span>
                    </div>
                    <div className="text-center border-l border-r border-slate-800 px-6">
                      <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Pitch Map</span><br/>
                      <span className="text-white text-xs font-bold uppercase tracking-wider">{lastDelivery.length}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Shot Zone</span><br/>
                      <span className="text-white text-xs font-bold uppercase tracking-wider">{lastDelivery.direction || 'NO SHOT'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-4 right-6 flex items-center gap-1">
                  {thisOver.map((ball, idx) => (
                    <div key={idx} className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] font-mono ${ball === 'W' ? 'bg-red-500/20 text-red-500 border border-red-500/50' : ball === 'Wd' || ball === 'Nb' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50' : ball === 6 || ball === 4 ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/50' : 'bg-slate-800 text-slate-300'}`}>{ball}</div>
                  ))}
                </div>

                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h3 className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-1">Total Score</h3>
                    <div className="text-5xl font-black tracking-tighter font-mono leading-none">{activeScore}<span className="text-3xl text-slate-600">/{activeWickets}</span></div>
                  </div>
                  <div className="text-right">
                    <h3 className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-1">Overs</h3>
                    <div className="text-3xl font-black text-white font-mono leading-none">{overs}.{legalBalls}</div>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-center text-emerald-400 font-bold text-sm uppercase tracking-widest">
                Live Broadcast in Progress...
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[550px]">
              <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-4 pb-3 border-b border-slate-800">
                Live Commentary
              </h3>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {commentaryFeed.length === 0 && <p className="text-slate-600 text-center mt-10 text-sm font-mono">Awaiting first delivery from server...</p>}
                {commentaryFeed.map((comm, idx) => (
                  <div key={idx} className="animate-fade-in flex gap-3 border-b border-slate-800/50 pb-3">
                    <div className={`shrink-0 w-8 h-8 rounded flex items-center justify-center font-bold text-xs font-mono border ${comm.type === 'wicket' ? 'bg-red-500/10 text-red-500 border-red-500/30' : comm.type === 'extra' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : comm.type === 'boundary' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {comm.runs !== undefined ? comm.runs : '...'}
                    </div>
                    <div className="text-sm text-slate-300 flex-1 leading-relaxed mt-1">
                      <span className="font-mono text-[10px] text-slate-500 block mb-1">Over {Math.floor((comm.ball-1)/6)}.{(comm.ball-1)%6 + 1}</span>
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
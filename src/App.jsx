import { useState, useRef, useEffect } from 'react';
import { playerDatabase } from './players';

function App() {
  // --- STATE MANAGEMENT ---
  const [appState, setAppState] = useState('auth'); 
  const [currentUser, setCurrentUser] = useState(null);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState('login'); 
  const [formData, setFormData] = useState({ name: '', username: '', email: '', mobile: '', password: '', referral: '', agreeTerms: false });
  const [otpValue, setOtpValue] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Dashboard State
  const [matchHistory, setMatchHistory] = useState([]);
  const [viewingScorecard, setViewingScorecard] = useState(null);

  // Match Config & Setup Flow State
  const [matchFormat, setMatchFormat] = useState('T20'); // 'T10' or 'T20'
  const [team1Name, setTeam1Name] = useState('Mumbai Indians');
  const [team2Name, setTeam2Name] = useState('Chennai Super Kings');
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [search1, setSearch1] = useState('');
  const [search2, setSearch2] = useState('');
  
  // Interactive Toss State
  const [tossPhase, setTossPhase] = useState('call'); 
  const [coinFace, setCoinFace] = useState('?');
  const [tossWinnerTeam, setTossWinnerTeam] = useState('');
  const [matchDecision, setMatchDecision] = useState(''); 

  // Server-Driven Live State
  const [serverId, setServerId] = useState(null);
  const [serverData, setServerData] = useState(null);
  const [prevBalls, setPrevBalls] = useState(0);
  const [commentaryFeed, setCommentaryFeed] = useState([]);
  const commentaryEndRef = useRef(null);

  useEffect(() => { commentaryEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [commentaryFeed]);

  // LOCAL STORAGE
  useEffect(() => {
    const savedUser = localStorage.getItem('cricverse_user');
    if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        fetchHistory(parsed.id);
        setAppState('dashboard');
    }
  }, []);

  // Live Polling
  useEffect(() => {
    if (appState !== 'match' || !serverId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/matches/${serverId}/score`);
        if (!res.ok) return;
        const data = await res.json();
        setServerData(data);
        if (!data.is_active && data.balls > 0) {
            setViewingScorecard(data);
            setAppState('scorecard'); 
        }
      } catch (err) { console.log("Waiting for server..."); }
    }, 2000);
    return () => clearInterval(interval);
  }, [appState, serverId]);

  // AI Commentary Reader
  useEffect(() => {
    if (serverData && serverData.balls > prevBalls) {
      setPrevBalls(serverData.balls);
      const d = serverData.last_delivery;
      if (d && d.speed) {
        const aiText = d.commentary || "Awaiting AI analysis...";
        setCommentaryFeed(prev => [...prev, { ball: serverData.balls, text: aiText, runs: d.result, type: d.result === 'W' ? 'wicket' : (d.result === 6 || d.result === 4) ? 'boundary' : 'normal' }]);
      }
    }
  }, [serverData, prevBalls]);

  // --- ACTIONS ---

  const handleLogout = () => {
      localStorage.removeItem('cricverse_user');
      setCurrentUser(null); setAppState('auth'); setAuthMode('login');
      setFormData({ name: '', username: '', email: '', mobile: '', password: '', referral: '', agreeTerms: false });
  };

  const handleLogin = async () => {
    setAuthError(''); setAuthSuccess('');
    if (!formData.username || !formData.password) return setAuthError("Please fill in all fields.");
    try {
      const res = await fetch(`http://127.0.0.1:8000/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: formData.username, password: formData.password }) });
      const data = await res.json();
      if (data.error) return setAuthError(data.error);
      localStorage.setItem('cricverse_user', JSON.stringify(data));
      setCurrentUser(data); fetchHistory(data.id); setAppState('dashboard');
    } catch (err) { setAuthError("Servers offline."); }
  };

  const handleVerifyOTP = async () => {
    setAuthError('');
    if (otpValue !== "123456") return setAuthError("Invalid OTP. (Hint: Use 123456)");
    try {
      const res = await fetch(`http://127.0.0.1:8000/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: formData.name, username: formData.username, mobile: formData.mobile, email: formData.email, password: formData.password, referral_code: formData.referral }) });
      const data = await res.json();
      if (data.error) return setAuthError(data.error);
      localStorage.setItem('cricverse_user', JSON.stringify(data));
      setCurrentUser(data); fetchHistory(data.id); setAppState('dashboard');
    } catch (err) { setAuthError("Servers offline."); }
  };

  const fetchHistory = async (userId) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/users/${userId}/matches`);
      const data = await res.json();
      setMatchHistory(data);
    } catch (err) { console.log("Failed to fetch history"); }
  };

  const handleMatchClick = async (match) => {
    if (match.status === 'In Progress') {
        setServerId(match.id);
        setAppState('match');
        fetch(`http://127.0.0.1:8000/matches/${match.id}/start`, { method: 'POST' });
    } else {
        try {
            const res = await fetch(`http://127.0.0.1:8000/matches/${match.id}/score`);
            const data = await res.json();
            setViewingScorecard(data);
            setAppState('scorecard');
        } catch (err) { alert("Failed to fetch scorecard."); }
    }
  };

  // --- DRAFT & STRATEGY LOGIC ---
  const addPlayerToTeam = (player, teamNum) => {
    const newPlayer = { ...player, isCaptain: false, allocated_overs: 0 };
    if (teamNum === 1 && team1.length < 11) setTeam1([...team1, newPlayer]);
    if (teamNum === 2 && team2.length < 11) setTeam2([...team2, newPlayer]);
  };

  const removePlayer = (playerId, teamNum) => {
    if (teamNum === 1) setTeam1(team1.filter(p => p.id !== playerId));
    if (teamNum === 2) setTeam2(team2.filter(p => p.id !== playerId));
  };

  const setCaptain = (playerId, teamNum) => {
      const updateTeam = (team) => team.map(p => p.id === playerId ? { ...p, isCaptain: true } : { ...p, isCaptain: false });
      teamNum === 1 ? setTeam1(updateTeam(team1)) : setTeam2(updateTeam(team2));
  };

  const getFilteredPlayers = (query) => {
      if (!query) return [];
      const lowerQuery = query.toLowerCase();
      return playerDatabase
          .filter(p => p.name.toLowerCase().includes(lowerQuery))
          .sort((a, b) => {
              const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
              const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
              if (aStarts && !bStarts) return -1; 
              if (!aStarts && bStarts) return 1;
              return a.name.localeCompare(b.name);
          });
  };

  const movePlayerOrder = (teamNum, index, direction) => {
      const team = teamNum === 1 ? [...team1] : [...team2];
      if (direction === 'up' && index > 0) {
          [team[index - 1], team[index]] = [team[index], team[index - 1]];
      } else if (direction === 'down' && index < team.length - 1) {
          [team[index + 1], team[index]] = [team[index], team[index + 1]];
      }
      teamNum === 1 ? setTeam1(team) : setTeam2(team);
  };

  const updateBowlerQuota = (teamNum, playerId, delta) => {
      const totalOversAllowed = matchFormat === 'T10' ? 10 : 20;
      const maxPerBowler = matchFormat === 'T10' ? 2 : 4;
      const team = teamNum === 1 ? [...team1] : [...team2];
      
      const currentTotal = team.reduce((sum, p) => sum + (p.allocated_overs || 0), 0);
      const playerIndex = team.findIndex(p => p.id === playerId);
      const currentVal = team[playerIndex].allocated_overs || 0;
      
      let newVal = currentVal + delta;
      if (newVal < 0) newVal = 0;
      if (newVal > maxPerBowler) newVal = maxPerBowler;
      
      // Prevent exceeding total match overs
      if (delta > 0 && currentTotal >= totalOversAllowed) return; 

      team[playerIndex].allocated_overs = newVal;
      teamNum === 1 ? setTeam1(team) : setTeam2(team);
  };

  const validateStrategy = () => {
      const requiredOvers = matchFormat === 'T10' ? 10 : 20;
      const t1Overs = team1.reduce((sum, p) => sum + (p.allocated_overs || 0), 0);
      const t2Overs = team2.reduce((sum, p) => sum + (p.allocated_overs || 0), 0);
      
      if (t1Overs !== requiredOvers) return alert(`Allocate exactly ${requiredOvers} bowling overs for ${team1Name}. Currently: ${t1Overs}`);
      if (t2Overs !== requiredOvers) return alert(`Allocate exactly ${requiredOvers} bowling overs for ${team2Name}. Currently: ${t2Overs}`);
      setAppState('review');
  };

  const startTossFlip = () => {
      setTossPhase('flip');
      setTimeout(() => {
          const landedOnHeads = Math.random() > 0.5;
          setCoinFace(landedOnHeads ? 'HEADS' : 'TAILS');
          setTossWinnerTeam(Math.random() > 0.5 ? team1Name : team2Name);
          setTossPhase('decision');
      }, 2000);
  };

  const startServerMatch = async () => {
    try {
      let battingFirst = team1;
      let bowlingFirst = team2;
      
      if ((tossWinnerTeam === team1Name && matchDecision === 'Bowl') || (tossWinnerTeam === team2Name && matchDecision === 'Bat')) {
          battingFirst = team2; bowlingFirst = team1;
      }

      const res = await fetch('http://127.0.0.1:8000/matches/', { 
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, batting_team: battingFirst, bowling_team: bowlingFirst, format: matchFormat })
      });
      
      const matchData = await res.json();
      setServerId(matchData.id);
      await fetch(`http://127.0.0.1:8000/matches/${matchData.id}/start`, { method: 'POST' });
      setAppState('match');
    } catch (err) { alert("Error connecting to server."); }
  };

  // Safe Math & Helpers
  const t1OversTotal = team1.reduce((sum, p) => sum + (p.allocated_overs || 0), 0);
  const t2OversTotal = team2.reduce((sum, p) => sum + (p.allocated_overs || 0), 0);
  const totalFormatOvers = matchFormat === 'T10' ? 10 : 20;

  const activeScore = serverData?.score || 0;
  const activeWickets = serverData?.wickets || 0;
  const activeBalls = serverData?.balls || 0;
  const overs = Math.floor(activeBalls / 6);
  const legalBalls = activeBalls % 6;
  const striker = serverData?.striker || { name: "Waiting...", runs: 0, balls: 0 };
  const bowler = serverData?.bowler || { name: "Waiting...", wickets: 0, runs: 0 };
  const lastDelivery = serverData?.last_delivery;
  const thisOver = serverData?.recent_overs || [];
  
  const cap1 = team1.find(p => p.isCaptain)?.name || "Captain 1";
  const cap2 = team2.find(p => p.isCaptain)?.name || "Captain 2";

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden">
      
      <style>{`
        .coin-container { display: flex; justify-content: center; align-items: center; height: 140px; perspective: 800px; }
        .coin { width: 120px; height: 120px; border-radius: 50%; transform-style: preserve-3d; display: flex; justify-content: center; align-items: center; }
        .revolving { animation: spin 0.3s linear infinite; }
        @keyframes spin { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }
      `}</style>

      <header className="bg-slate-950 border-b border-slate-800 p-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2 cursor-pointer" onClick={() => currentUser && setAppState('dashboard')}>
            <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-black text-xs">CP</div>
            CRICVERSE <span className="text-emerald-500">PRO</span>
          </h1>
          <div className="flex items-center gap-4">
            {currentUser && (
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-400">Welcome, {currentUser.username}</span>
                    <button onClick={handleLogout} className="text-xs bg-slate-800 hover:bg-red-500 hover:text-white px-2 py-1 rounded transition-colors text-slate-400">Logout</button>
                </div>
            )}
            <div className="text-xs font-bold bg-slate-900 text-slate-300 px-3 py-1 rounded border border-slate-800 uppercase tracking-widest">{appState}</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-8">
        
        {/* --- 1. AUTH SCREEN --- */}
        {appState === 'auth' && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl mt-10 text-center animate-fade-in">
            <h2 className="text-xl font-bold mb-6 text-white uppercase tracking-widest border-b border-slate-800 pb-4">
               {authMode === 'login' ? 'Account Login' : authMode === 'otp' ? 'Verification' : authMode === 'forgot' ? 'Reset Password' : 'Create Account'}
            </h2>
            
            {authError && <div className="bg-red-500/20 text-red-500 p-3 mb-6 rounded text-sm font-bold border border-red-500/30 text-left">{authError}</div>}
            {authSuccess && <div className="bg-emerald-500/20 text-emerald-500 p-3 mb-6 rounded text-sm font-bold border border-emerald-500/30 text-left">{authSuccess}</div>}
            
            {authMode === 'login' && (
              <div className="space-y-4 text-left">
                <input type="text" placeholder="Username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                <input type="password" placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white mb-2 focus:border-emerald-500 outline-none" />
                <div className="text-right mb-4"><button onClick={() => setAuthMode('forgot')} className="text-xs text-slate-500 hover:text-emerald-400">Forgot Password?</button></div>
                <button onClick={handleLogin} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded text-sm uppercase tracking-widest transition-colors">Secure Login</button>
                <div className="mt-4 text-sm text-slate-500 text-center">New player? <button onClick={() => setAuthMode('register')} className="text-emerald-500 font-bold hover:underline">Register here</button></div>
              </div>
            )}

            {authMode === 'register' && (
              <div className="space-y-4 text-left">
                <input type="text" placeholder="Full Name *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                <input type="text" placeholder="Username *" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                <input type="tel" placeholder="Mobile Number *" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                <input type="password" placeholder="Password *" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                
                <label className="flex items-start gap-2 mt-4 cursor-pointer">
                  <input type="checkbox" checked={formData.agreeTerms} onChange={e => setFormData({...formData, agreeTerms: e.target.checked})} className="mt-1" />
                  <span className="text-xs text-slate-400">I agree to the Terms of Service.</span>
                </label>

                <button onClick={() => { if(!formData.agreeTerms) return setAuthError("Agree to terms"); setAuthMode('otp'); }} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 mt-4 rounded text-sm uppercase tracking-widest transition-colors">Continue to Verification</button>
              </div>
            )}

            {authMode === 'otp' && (
              <div className="space-y-4 text-left">
                <p className="text-sm text-slate-400 text-center mb-6">OTP sent to <b className="text-white">{formData.mobile}</b>.</p>
                <input type="text" placeholder="123456" maxLength="6" value={otpValue} onChange={e => setOtpValue(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-4 text-center text-2xl font-mono text-white tracking-[0.5em] focus:border-emerald-500 outline-none" />
                <button onClick={handleVerifyOTP} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 mt-2 rounded text-sm uppercase tracking-widest transition-colors">Verify & Create Account</button>
              </div>
            )}
          </div>
        )}

        {/* --- 2. DASHBOARD --- */}
        {appState === 'dashboard' && (
          <div className="max-w-4xl mx-auto animate-fade-in mt-10">
            <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-black uppercase tracking-widest text-slate-300">Manager Dashboard</h2>
              <button onClick={() => { setTeam1([]); setTeam2([]); setTossPhase('call'); setAppState('config'); }} className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-6 py-3 rounded uppercase tracking-widest text-sm transition-colors shadow-lg">Start New Series</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matchHistory.length === 0 && <p className="text-slate-600 font-mono text-sm">No matches played yet.</p>}
              {matchHistory.map(m => (
                <div key={m.id} onClick={() => handleMatchClick(m)} className={`border p-5 rounded-lg flex justify-between items-center transition-all cursor-pointer hover:-translate-y-1 ${m.status === 'In Progress' ? 'bg-slate-900 border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${m.status === 'In Progress' ? 'text-emerald-500' : 'text-slate-500'}`}>{m.format} Match #{m.id}</div>
                    <div className="text-xl font-mono font-bold text-white">{m.score}/{m.wickets}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-500 font-mono text-sm">{Math.floor(m.balls/6)}.{m.balls%6} / {m.format === 'T10' ? 10 : 20} Ov</div>
                    <div className="text-[10px] font-bold text-slate-600 uppercase mt-1">{m.status === 'In Progress' ? 'Resume' : 'Scorecard'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- 3. CONFIG SCREEN --- */}
        {appState === 'config' && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl mt-10">
            <h2 className="text-xl font-bold mb-6 text-white uppercase tracking-widest border-b border-slate-800 pb-4">Match Setup</h2>
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-slate-500 font-bold mb-2 uppercase text-[10px] tracking-widest">Match Format</label>
                <div className="flex gap-2">
                    <button onClick={() => setMatchFormat('T10')} className={`flex-1 py-3 font-bold rounded text-sm uppercase transition-colors ${matchFormat === 'T10' ? 'bg-emerald-500 text-black' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>T10 (10 Overs)</button>
                    <button onClick={() => setMatchFormat('T20')} className={`flex-1 py-3 font-bold rounded text-sm uppercase transition-colors ${matchFormat === 'T20' ? 'bg-emerald-500 text-black' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>T20 (20 Overs)</button>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-slate-500 font-bold mb-2 uppercase text-[10px] tracking-widest">Home Team</label>
                <input type="text" value={team1Name} onChange={(e) => setTeam1Name(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white font-bold focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-slate-500 font-bold mb-2 uppercase text-[10px] tracking-widest">Away Team</label>
                <input type="text" value={team2Name} onChange={(e) => setTeam2Name(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white font-bold focus:border-cyan-500 outline-none" />
              </div>
            </div>
            <button onClick={() => setAppState('draft')} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black px-6 py-3 rounded uppercase tracking-widest text-sm transition-colors">Step 1: Player Draft →</button>
          </div>
        )}

        {/* --- STEP 1: DRAFT (WITH 11-PLAYER RULE & CAPTAINS) --- */}
        {appState === 'draft' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white uppercase tracking-widest">Step 1: Select Squads & Captains</h2>
              <button 
                onClick={() => { 
                    if (team1.length !== 11 || team2.length !== 11) return alert(`Select exactly 11 players for each team.`); 
                    if (!team1.find(p=>p.isCaptain) || !team2.find(p=>p.isCaptain)) return alert(`Assign a Captain (C) for both teams.`);
                    setAppState('strategy'); 
                }} 
                className="bg-emerald-500 text-black font-bold px-6 py-2 rounded text-sm uppercase tracking-widest hover:bg-emerald-400 transition-colors">
                Step 2: Strategy →
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Team 1 Draft */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg">
                <h3 className="font-black text-emerald-500 uppercase tracking-widest mb-4">{team1Name} ({team1.length}/11)</h3>
                
                {team1.length < 11 ? (
                    <input type="text" placeholder="Search players (e.g. 'Smi')" value={search1} onChange={e => setSearch1(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded mb-2 text-sm font-bold focus:border-emerald-500 outline-none" />
                ) : (
                    <div className="bg-emerald-500/20 text-emerald-400 font-bold text-center p-3 rounded mb-2 text-sm border border-emerald-500/30">✓ 11/11 Squad Selected</div>
                )}
                
                {search1 && team1.length < 11 && (
                  <div className="bg-slate-800 rounded border border-slate-700 mb-4 max-h-[150px] overflow-y-auto custom-scrollbar">
                    {getFilteredPlayers(search1).map(p => {
                      const isTaken1 = team1.find(t => t.id === p.id); const isTaken2 = team2.find(t => t.id === p.id);
                      return (<button key={p.id} disabled={isTaken1 || isTaken2} onClick={() => { addPlayerToTeam(p, 1); setSearch1(''); }} className={`w-full text-left p-2 border-b border-slate-700/50 text-xs font-bold transition-colors ${isTaken1 ? 'bg-emerald-500/20 text-emerald-500 cursor-not-allowed' : isTaken2 ? 'bg-slate-900 text-slate-600 cursor-not-allowed' : 'hover:bg-slate-700 text-white'}`}>{p.name} {isTaken2 && "(At Opponent)"} {isTaken1 && "(Drafted)"}</button>)
                    })}
                  </div>
                )}

                <div className="space-y-2 mt-4">
                  {team1.map(p => (
                    <div key={p.id} className={`flex justify-between items-center border p-2 rounded ${p.isCaptain ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-900 border-slate-800'}`}>
                      <div className="flex items-center gap-3">
                          <button onClick={() => setCaptain(p.id, 1)} className={`w-6 h-6 rounded-full text-[10px] font-black border transition-colors ${p.isCaptain ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-slate-800 text-slate-500 border-slate-600 hover:bg-slate-700'}`}>C</button>
                          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-black">{p.role.substring(0,3).toUpperCase()}</span>
                          <span className="text-sm font-bold text-slate-200">{p.name}</span>
                      </div>
                      <button onClick={() => removePlayer(p.id, 1)} className="text-red-500 hover:bg-red-500/20 px-2 py-1 rounded text-xs font-bold transition-colors">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team 2 Draft */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg">
                <h3 className="font-black text-cyan-500 uppercase tracking-widest mb-4">{team2Name} ({team2.length}/11)</h3>
                {team2.length < 11 ? (
                    <input type="text" placeholder="Search players (e.g. 'Man')" value={search2} onChange={e => setSearch2(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded mb-2 text-sm font-bold focus:border-cyan-500 outline-none" />
                ) : (
                    <div className="bg-cyan-500/20 text-cyan-400 font-bold text-center p-3 rounded mb-2 text-sm border border-cyan-500/30">✓ 11/11 Squad Selected</div>
                )}
                
                {search2 && team2.length < 11 && (
                  <div className="bg-slate-800 rounded border border-slate-700 mb-4 max-h-[150px] overflow-y-auto custom-scrollbar">
                    {getFilteredPlayers(search2).map(p => {
                      const isTaken2 = team2.find(t => t.id === p.id); const isTaken1 = team1.find(t => t.id === p.id);
                      return (<button key={p.id} disabled={isTaken1 || isTaken2} onClick={() => { addPlayerToTeam(p, 2); setSearch2(''); }} className={`w-full text-left p-2 border-b border-slate-700/50 text-xs font-bold transition-colors ${isTaken2 ? 'bg-cyan-500/20 text-cyan-500 cursor-not-allowed' : isTaken1 ? 'bg-slate-900 text-slate-600 cursor-not-allowed' : 'hover:bg-slate-700 text-white'}`}>{p.name} {isTaken1 && "(At Opponent)"} {isTaken2 && "(Drafted)"}</button>)
                    })}
                  </div>
                )}
                
                <div className="space-y-2 mt-4">
                  {team2.map(p => (
                    <div key={p.id} className={`flex justify-between items-center border p-2 rounded ${p.isCaptain ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-900 border-slate-800'}`}>
                      <div className="flex items-center gap-3">
                          <button onClick={() => setCaptain(p.id, 2)} className={`w-6 h-6 rounded-full text-[10px] font-black border transition-colors ${p.isCaptain ? 'bg-cyan-500 text-black border-cyan-500' : 'bg-slate-800 text-slate-500 border-slate-600 hover:bg-slate-700'}`}>C</button>
                          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-black">{p.role.substring(0,3).toUpperCase()}</span>
                          <span className="text-sm font-bold text-slate-200">{p.name}</span>
                      </div>
                      <button onClick={() => removePlayer(p.id, 2)} className="text-red-500 hover:bg-red-500/20 px-2 py-1 rounded text-xs font-bold transition-colors">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- STEP 2: STRATEGY (BATTING ORDER & BOWLING QUOTAS) --- */}
        {appState === 'strategy' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl animate-fade-in">
             <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white uppercase tracking-widest">Step 2: Formations & Quotas</h2>
              <button onClick={validateStrategy} className="bg-emerald-500 text-black font-bold px-6 py-2 rounded text-sm uppercase tracking-widest hover:bg-emerald-400 transition-colors">
                Step 3: Review Teams →
              </button>
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6 bg-slate-950 p-3 rounded border border-slate-800">
                Instruction: Order your batters (1-11) using the arrows. Assign exactly {totalFormatOvers} bowling overs per team. Engine handles bowling rotation automatically based on quotas.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Team 1 Strategy */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-black text-emerald-500 uppercase">{team1Name}</h3>
                        <div className={`text-xs font-bold px-3 py-1 rounded border ${t1OversTotal === totalFormatOvers ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' : 'bg-amber-500/20 text-amber-500 border-amber-500/50'}`}>
                            Overs Allocated: {t1OversTotal} / {totalFormatOvers}
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        {team1.map((p, idx) => (
                            <div key={p.id} className="flex justify-between items-center bg-slate-950 border border-slate-800 p-2 rounded">
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col gap-1 mr-2">
                                        <button onClick={() => movePlayerOrder(1, idx, 'up')} className="text-slate-500 hover:text-white">▲</button>
                                        <button onClick={() => movePlayerOrder(1, idx, 'down')} className="text-slate-500 hover:text-white">▼</button>
                                    </div>
                                    <span className="text-xs text-slate-500 font-mono w-4">{idx + 1}.</span>
                                    <span className="text-sm font-bold w-24 truncate">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                    <span className="text-[9px] uppercase text-slate-500 font-bold mr-2">Overs:</span>
                                    <button onClick={() => updateBowlerQuota(1, p.id, -1)} className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold">-</button>
                                    <span className="text-sm font-mono w-4 text-center font-bold">{p.allocated_overs}</span>
                                    <button onClick={() => updateBowlerQuota(1, p.id, 1)} className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold">+</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Team 2 Strategy */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-black text-cyan-500 uppercase">{team2Name}</h3>
                        <div className={`text-xs font-bold px-3 py-1 rounded border ${t2OversTotal === totalFormatOvers ? 'bg-cyan-500/20 text-cyan-500 border-cyan-500/50' : 'bg-amber-500/20 text-amber-500 border-amber-500/50'}`}>
                            Overs Allocated: {t2OversTotal} / {totalFormatOvers}
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        {team2.map((p, idx) => (
                            <div key={p.id} className="flex justify-between items-center bg-slate-950 border border-slate-800 p-2 rounded">
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col gap-1 mr-2">
                                        <button onClick={() => movePlayerOrder(2, idx, 'up')} className="text-slate-500 hover:text-white">▲</button>
                                        <button onClick={() => movePlayerOrder(2, idx, 'down')} className="text-slate-500 hover:text-white">▼</button>
                                    </div>
                                    <span className="text-xs text-slate-500 font-mono w-4">{idx + 1}.</span>
                                    <span className="text-sm font-bold w-24 truncate">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                    <span className="text-[9px] uppercase text-slate-500 font-bold mr-2">Overs:</span>
                                    <button onClick={() => updateBowlerQuota(2, p.id, -1)} className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold">-</button>
                                    <span className="text-sm font-mono w-4 text-center font-bold">{p.allocated_overs}</span>
                                    <button onClick={() => updateBowlerQuota(2, p.id, 1)} className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold">+</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* --- STEP 3: FINAL REVIEW --- */}
        {appState === 'review' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl animate-fade-in">
             <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white uppercase tracking-widest">Step 3: Match Overview</h2>
              <button onClick={() => setAppState('toss')} className="bg-emerald-500 text-black font-bold px-8 py-3 rounded text-sm uppercase tracking-widest hover:bg-emerald-400 transition-colors shadow-lg">
                Proceed to Toss
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <h3 className="font-black text-emerald-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">{team1Name} XI</h3>
                    <ul className="text-sm font-bold space-y-2">
                        {team1.map((p, i) => (
                            <li key={p.id} className="flex justify-between">
                                <span><span className="text-slate-500 font-mono mr-2">{i+1}.</span> {p.name} {p.isCaptain && <span className="text-emerald-500 text-xs">(C)</span>}</span>
                                {p.allocated_overs > 0 && <span className="text-[10px] bg-slate-800 px-2 rounded font-mono text-slate-400">{p.allocated_overs} Ov</span>}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <h3 className="font-black text-cyan-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">{team2Name} XI</h3>
                    <ul className="text-sm font-bold space-y-2">
                        {team2.map((p, i) => (
                            <li key={p.id} className="flex justify-between">
                                <span><span className="text-slate-500 font-mono mr-2">{i+1}.</span> {p.name} {p.isCaptain && <span className="text-cyan-500 text-xs">(C)</span>}</span>
                                {p.allocated_overs > 0 && <span className="text-[10px] bg-slate-800 px-2 rounded font-mono text-slate-400">{p.allocated_overs} Ov</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
          </div>
        )}

        {/* --- 5. INTERACTIVE CAPTAINS TOSS SCREEN --- */}
        {appState === 'toss' && (
          <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 p-10 rounded-xl shadow-2xl mt-10 text-center animate-fade-in relative overflow-hidden">
            <h2 className="text-xl font-bold mb-6 text-white uppercase tracking-widest border-b border-slate-800 pb-4">Captains Toss</h2>
            
            <div className="flex justify-between items-center mb-8 px-4">
               <div className="text-left">
                   <div className="text-emerald-500 text-xs font-bold uppercase">{team1Name}</div>
                   <div className="font-black text-lg">{cap1} <span className="text-slate-500 text-xs">(C)</span></div>
               </div>
               <div className="font-black text-slate-700 italic">VS</div>
               <div className="text-right">
                   <div className="text-cyan-500 text-xs font-bold uppercase">{team2Name}</div>
                   <div className="font-black text-lg">{cap2} <span className="text-slate-500 text-xs">(C)</span></div>
               </div>
            </div>

            <div className="coin-container bg-slate-950/50 rounded-lg border border-slate-800 mb-8 py-6">
              <div className={`coin bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 border-4 border-yellow-600 shadow-[0_0_40px_rgba(234,179,8,0.3)] ${tossPhase === 'flip' ? 'revolving' : ''}`}>
                 <div className="text-yellow-100 font-black text-2xl uppercase tracking-widest drop-shadow-md">{tossPhase === 'flip' ? '' : coinFace}</div>
              </div>
            </div>

            {tossPhase === 'call' && (
                <div className="animate-fade-in">
                    <p className="text-slate-400 text-sm mb-4">Away Captain <b className="text-white">{cap2}</b>, call the toss:</p>
                    <div className="flex gap-4 justify-center">
                        <button onClick={startTossFlip} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold px-8 py-3 rounded text-sm uppercase transition-colors">Heads</button>
                        <button onClick={startTossFlip} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold px-8 py-3 rounded text-sm uppercase transition-colors">Tails</button>
                    </div>
                </div>
            )}

            {tossPhase === 'decision' && (
                <div className="animate-fade-in">
                    <p className="text-xl font-black text-white mb-1">{tossWinnerTeam} won the toss!</p>
                    <p className="text-slate-400 text-sm mb-6">Captain <b className="text-white">{tossWinnerTeam === team1Name ? cap1 : cap2}</b>, what is your decision?</p>
                    <div className="flex gap-4 justify-center">
                        <button onClick={() => { setMatchDecision('Bat'); setTossPhase('result'); }} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-3 rounded text-sm uppercase transition-colors">We will Bat</button>
                        <button onClick={() => { setMatchDecision('Bowl'); setTossPhase('result'); }} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 py-3 rounded text-sm uppercase transition-colors">We will Bowl</button>
                    </div>
                </div>
            )}

            {tossPhase === 'result' && (
                <div className="animate-fade-in">
                    <div className="text-xl font-black text-white mb-2">{tossWinnerTeam} won the toss</div>
                    <div className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-8">and elected to <span className="text-emerald-400">{matchDecision}</span> first.</div>
                    <button onClick={startServerMatch} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-10 py-4 rounded w-full text-sm uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      Connect to Server & Start Match
                    </button>
                </div>
            )}
          </div>
        )}

        {/* --- 6. MATCH SCREEN --- */}
        {appState === 'match' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="lg:col-span-2 space-y-6">
              
              <div className="w-full bg-slate-900 rounded-xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col p-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-5">
                  <h3 className="text-emerald-500 font-bold tracking-widest text-xs uppercase flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> Live Server Feed</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-center">
                     <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Striker</div>
                     <div>
                       <div className="text-lg font-bold text-white truncate">{striker.name}</div>
                       <div className="text-4xl font-mono text-emerald-400 mt-2 leading-none">{striker.runs}<span className="text-xl text-slate-500 font-mono ml-1">({striker.balls})</span></div>
                     </div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-center">
                     <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Bowler</div>
                     <div>
                       <div className="text-lg font-bold text-white truncate">{bowler.name}</div>
                       <div className="text-4xl font-mono text-cyan-400 mt-2 leading-none">{bowler.wickets}<span className="text-xl text-slate-500 font-mono ml-1">- {bowler.runs}</span></div>
                     </div>
                  </div>
                </div>

                {lastDelivery && (
                  <div className="mt-5 bg-slate-950 border border-slate-800 rounded flex justify-between p-3">
                    <div className="text-left"><span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Speed</span><br/><span className="text-white text-sm font-mono font-bold">{lastDelivery.speed} <span className="text-xs text-slate-500">km/h</span></span></div>
                    <div className="text-center border-l border-r border-slate-800 px-6"><span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Pitch Map</span><br/><span className="text-white text-xs font-bold uppercase tracking-wider">{lastDelivery.length}</span></div>
                    <div className="text-right"><span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase">Shot Zone</span><br/><span className="text-white text-xs font-bold uppercase tracking-wider">{lastDelivery.direction || 'NO SHOT'}</span></div>
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
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col h-[550px]">
              <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-4 pb-3 border-b border-slate-800">Live Commentary</h3>
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

        {/* --- 7. POST MATCH SCORECARD --- */}
        {appState === 'scorecard' && viewingScorecard && (
          <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl mt-10 animate-fade-in">
             <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                 <h2 className="text-2xl font-black uppercase tracking-widest text-white">{viewingScorecard.format} Scorecard</h2>
                 <button onClick={() => setAppState('dashboard')} className="text-emerald-500 text-sm font-bold uppercase tracking-widest hover:underline">← Back to Dashboard</button>
             </div>

             <div className="flex justify-between items-end mb-8 bg-slate-950 p-6 rounded-lg border border-slate-800">
                <div>
                   <h3 className="text-xs uppercase font-bold text-slate-500 tracking-widest mb-1">Final Score</h3>
                   <div className="text-5xl font-mono font-black text-white">{viewingScorecard.score}/{viewingScorecard.wickets}</div>
                </div>
                <div className="text-right">
                   <div className="text-xl font-mono text-slate-400">{Math.floor(viewingScorecard.balls/6)}.{viewingScorecard.balls%6} Overs</div>
                </div>
             </div>

             <h3 className="font-bold text-emerald-500 uppercase tracking-widest mb-4">Batting Innings</h3>
             <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden mb-8">
                 <table className="w-full text-left text-sm">
                     <thead className="bg-slate-900 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                         <tr><th className="p-3">Batter</th><th className="p-3">Status</th><th className="p-3 text-right">R</th><th className="p-3 text-right">B</th><th className="p-3 text-right">4s</th><th className="p-3 text-right">6s</th><th className="p-3 text-right">SR</th></tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800 font-mono">
                         {viewingScorecard.batting_team?.map(p => (
                             <tr key={p.id} className="hover:bg-slate-900/50">
                                 <td className="p-3 font-bold text-white font-sans">{p.name} {p.isCaptain && <span className="text-emerald-500 text-[10px]">(C)</span>}</td>
                                 <td className="p-3 text-slate-400 text-xs">{p.status}</td>
                                 <td className="p-3 text-right font-bold text-emerald-400">{p.runs}</td>
                                 <td className="p-3 text-right text-slate-300">{p.balls}</td>
                                 <td className="p-3 text-right text-slate-400">{p.fours}</td>
                                 <td className="p-3 text-right text-slate-400">{p.sixes}</td>
                                 <td className="p-3 text-right text-slate-500">{p.balls > 0 ? ((p.runs/p.balls)*100).toFixed(1) : '-'}</td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>

             <h3 className="font-bold text-cyan-500 uppercase tracking-widest mb-4">Bowling Analysis</h3>
             <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                 <table className="w-full text-left text-sm">
                     <thead className="bg-slate-900 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                         <tr><th className="p-3">Bowler</th><th className="p-3 text-right">O</th><th className="p-3 text-right">R</th><th className="p-3 text-right">W</th><th className="p-3 text-right">Econ</th></tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800 font-mono">
                         {viewingScorecard.bowling_team?.filter(p => p.balls_bowled > 0).map(p => {
                             const overs = Math.floor(p.balls_bowled/6);
                             const rem = p.balls_bowled%6;
                             const overStr = `${overs}.${rem}`;
                             const econ = p.balls_bowled > 0 ? ((p.runs_conceded / p.balls_bowled) * 6).toFixed(1) : '-';
                             return (
                                 <tr key={p.id} className="hover:bg-slate-900/50">
                                     <td className="p-3 font-bold text-white font-sans">{p.name} {p.isCaptain && <span className="text-cyan-500 text-[10px]">(C)</span>}</td>
                                     <td className="p-3 text-right text-slate-300">{overStr}</td>
                                     <td className="p-3 text-right text-slate-400">{p.runs_conceded}</td>
                                     <td className="p-3 text-right font-bold text-cyan-400">{p.wickets}</td>
                                     <td className="p-3 text-right text-slate-500">{econ}</td>
                                 </tr>
                             )
                         })}
                     </tbody>
                 </table>
             </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
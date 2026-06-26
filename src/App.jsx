import { useState, useRef, useEffect } from 'react';
import { playerDatabase } from './players';

function App() {
  // --- STATE MANAGEMENT ---
  const [appState, setAppState] = useState('auth'); 
  const [currentUser, setCurrentUser] = useState(null);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'otp', 'forgot'
  const [formData, setFormData] = useState({ name: '', username: '', email: '', mobile: '', password: '', referral: '', agreeTerms: false });
  const [otpValue, setOtpValue] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Dashboard & Scorecard State
  const [matchHistory, setMatchHistory] = useState([]);
  const [viewingScorecard, setViewingScorecard] = useState(null);

  // Match Config & Draft State
  const [team1Name, setTeam1Name] = useState('Mumbai Indians');
  const [team2Name, setTeam2Name] = useState('Chennai Super Kings');
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [search1, setSearch1] = useState('');
  const [search2, setSearch2] = useState('');

  // Interactive Toss State
  const [tossPhase, setTossPhase] = useState('call'); // 'call', 'flip', 'decision', 'result'
  const [coinFace, setCoinFace] = useState('?');
  const [tossWinnerTeam, setTossWinnerTeam] = useState('');
  const [matchDecision, setMatchDecision] = useState(''); // 'Bat' or 'Bowl'

  // Server-Driven Live State
  const [serverId, setServerId] = useState(null);
  const [serverData, setServerData] = useState(null);
  const [prevBalls, setPrevBalls] = useState(0);
  const [commentaryFeed, setCommentaryFeed] = useState([]);
  const commentaryEndRef = useRef(null);

  useEffect(() => { commentaryEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [commentaryFeed]);

  // LOCAL STORAGE: Remember User on Mount
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
      setCurrentUser(null);
      setAppState('auth');
      setAuthMode('login');
      setFormData({ name: '', username: '', email: '', mobile: '', password: '', referral: '', agreeTerms: false });
  };

  const handleLogin = async () => {
    setAuthError(''); setAuthSuccess('');
    if (!formData.username || !formData.password) return setAuthError("Please fill in all fields.");
    try {
      const res = await fetch(`http://127.0.0.1:8000/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password })
      });
      const data = await res.json();
      if (data.error) return setAuthError(data.error);
      
      localStorage.setItem('cricverse_user', JSON.stringify(data)); // Save cookie
      setCurrentUser(data);
      fetchHistory(data.id);
      setAppState('dashboard');
    } catch (err) { setAuthError("We are unable to reach the servers right now. Please check your connection."); }
  };

  const handleRegisterInitiate = () => {
    setAuthError(''); setAuthSuccess('');
    if (!formData.name || !formData.username || !formData.mobile || !formData.password) return setAuthError("Please fill out all mandatory fields.");
    if (!formData.agreeTerms) return setAuthError("You must agree to the Terms & Conditions.");
    setAuthMode('otp'); 
  };

  const handleVerifyOTP = async () => {
    setAuthError('');
    if (otpValue !== "123456") return setAuthError("Invalid OTP. (Hint: Use 123456)");
    try {
      const res = await fetch(`http://127.0.0.1:8000/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: formData.name, username: formData.username, mobile: formData.mobile, 
            email: formData.email, password: formData.password, referral_code: formData.referral 
        })
      });
      const data = await res.json();
      if (data.error) return setAuthError(data.error);
      
      localStorage.setItem('cricverse_user', JSON.stringify(data)); // Save cookie
      setCurrentUser(data);
      fetchHistory(data.id);
      setAppState('dashboard');
    } catch (err) { setAuthError("We are unable to reach the servers right now."); }
  };

  const handleForgotPassword = async () => {
      setAuthError(''); setAuthSuccess('');
      if (!formData.username || !formData.mobile || !formData.password) return setAuthError("Provide Username, Mobile, and your New Password.");
      try {
        const res = await fetch(`http://127.0.0.1:8000/reset-password`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: formData.username, mobile: formData.mobile, new_password: formData.password })
        });
        const data = await res.json();
        if (data.error) return setAuthError(data.error);
        setAuthSuccess("Password successfully updated. You can now login.");
        setAuthMode('login');
      } catch (err) { setAuthError("Server unreachable."); }
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
        // VITAL FIX: Tell backend to resume loop if it was paused
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

  const addPlayerToTeam = (player, teamNum) => {
    if (teamNum === 1 && !team1.find(p => p.id === player.id) && team1.length < 11) setTeam1([...team1, player]);
    if (teamNum === 2 && !team2.find(p => p.id === player.id) && team2.length < 11) setTeam2([...team2, player]);
  };

  const removePlayer = (playerId, teamNum) => {
    if (teamNum === 1) setTeam1(team1.filter(p => p.id !== playerId));
    if (teamNum === 2) setTeam2(team2.filter(p => p.id !== playerId));
  };

  // Upgraded Alphabetical Search Engine
  const getFilteredPlayers = (query) => {
      if (!query) return [];
      const lowerQuery = query.toLowerCase();
      return playerDatabase
          .filter(p => p.name.toLowerCase().includes(lowerQuery))
          .sort((a, b) => {
              const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
              const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
              if (aStarts && !bStarts) return -1; // Push exact starts to top
              if (!aStarts && bStarts) return 1;
              return a.name.localeCompare(b.name); // Alphabetize the rest
          });
  };

  // Interactive Toss Flow
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
      
      // Calculate who bats based on the captain's decision
      if ((tossWinnerTeam === team1Name && matchDecision === 'Bowl') || 
          (tossWinnerTeam === team2Name && matchDecision === 'Bat')) {
          battingFirst = team2; bowlingFirst = team1;
      }

      const createRes = await fetch('http://127.0.0.1:8000/matches/', { 
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, batting_team: battingFirst, bowling_team: bowlingFirst })
      });
      
      const matchData = await createRes.json();
      setServerId(matchData.id);
      await fetch(`http://127.0.0.1:8000/matches/${matchData.id}/start`, { method: 'POST' });
      setAppState('match');
    } catch (err) { alert("Error connecting to server."); }
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
  
  const cap1 = team1[0]?.name || "Captain 1";
  const cap2 = team2[0]?.name || "Captain 2";

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden">
      
      {/* REVOLVING COIN CSS */}
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
                
                <div className="text-right mb-4">
                    <button onClick={() => setAuthMode('forgot')} className="text-xs text-slate-500 hover:text-emerald-400">Forgot Password?</button>
                </div>

                <button onClick={handleLogin} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded text-sm uppercase tracking-widest transition-colors">Secure Login</button>
                <div className="mt-4 text-sm text-slate-500 text-center">New player? <button onClick={() => setAuthMode('register')} className="text-emerald-500 font-bold hover:underline">Register here</button></div>
              </div>
            )}

            {authMode === 'forgot' && (
              <div className="space-y-4 text-left">
                <p className="text-xs text-slate-400 mb-4">Enter your registered Username and Mobile number to authenticate your identity.</p>
                <input type="text" placeholder="Username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                <input type="tel" placeholder="Mobile Number" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                <input type="password" placeholder="Create New Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white mb-4 focus:border-emerald-500 outline-none" />
                
                <button onClick={handleForgotPassword} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded text-sm uppercase tracking-widest transition-colors">Reset Password</button>
                <div className="mt-4 text-sm text-slate-500 text-center"><button onClick={() => setAuthMode('login')} className="text-emerald-500 font-bold hover:underline">Cancel</button></div>
              </div>
            )}

            {authMode === 'register' && (
              <div className="space-y-4 text-left">
                <input type="text" placeholder="Full Name *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                <input type="text" placeholder="Username *" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                <input type="tel" placeholder="Mobile Number *" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                <input type="email" placeholder="Email Address (Optional)" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                <input type="password" placeholder="Password *" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                <input type="text" placeholder="Referral Code (Optional)" value={formData.referral} onChange={e => setFormData({...formData, referral: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white focus:border-emerald-500 outline-none" />
                
                <label className="flex items-start gap-2 mt-4 cursor-pointer">
                  <input type="checkbox" checked={formData.agreeTerms} onChange={e => setFormData({...formData, agreeTerms: e.target.checked})} className="mt-1" />
                  <span className="text-xs text-slate-400">I agree to the Terms of Service, Privacy Policy, and confirm I am of legal age to use this application.</span>
                </label>

                <button onClick={handleRegisterInitiate} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 mt-4 rounded text-sm uppercase tracking-widest transition-colors">Continue to Verification</button>
                <div className="mt-4 text-sm text-slate-500 text-center">Already have an account? <button onClick={() => setAuthMode('login')} className="text-emerald-500 font-bold hover:underline">Login</button></div>
              </div>
            )}

            {authMode === 'otp' && (
              <div className="space-y-4 text-left">
                <p className="text-sm text-slate-400 text-center mb-6">An OTP has been sent to <b className="text-white">{formData.mobile}</b> to verify your identity and prevent bots.</p>
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded mb-4 text-center">
                    <span className="text-amber-500 text-xs font-bold uppercase tracking-widest">Simulator Note: Use OTP 123456</span>
                </div>
                <input type="text" placeholder="Enter 6-digit OTP" maxLength="6" value={otpValue} onChange={e => setOtpValue(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-4 text-center text-2xl font-mono text-white tracking-[0.5em] focus:border-emerald-500 outline-none" />
                <button onClick={handleVerifyOTP} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 mt-2 rounded text-sm uppercase tracking-widest transition-colors">Verify & Create Account</button>
                <button onClick={() => setAuthMode('register')} className="w-full text-slate-500 text-sm font-bold mt-2 hover:text-white">Cancel</button>
              </div>
            )}
          </div>
        )}

        {/* --- 2. DASHBOARD / HISTORY --- */}
        {appState === 'dashboard' && (
          <div className="max-w-4xl mx-auto animate-fade-in mt-10">
            <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-black uppercase tracking-widest text-slate-300">Manager Dashboard</h2>
              <button onClick={() => { setTeam1([]); setTeam2([]); setTossPhase('call'); setAppState('config'); }} className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-6 py-3 rounded uppercase tracking-widest text-sm transition-colors shadow-lg">Start New Series</button>
            </div>
            
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Past & Active Matches ({matchHistory.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matchHistory.length === 0 && <p className="text-slate-600 font-mono text-sm">No matches played yet.</p>}
              {matchHistory.map(m => (
                <div key={m.id} onClick={() => handleMatchClick(m)} className={`border p-5 rounded-lg flex justify-between items-center transition-all cursor-pointer hover:-translate-y-1 ${m.status === 'In Progress' ? 'bg-slate-900 border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${m.status === 'In Progress' ? 'text-emerald-500' : 'text-slate-500'}`}>Match #{m.id} • {m.status}</div>
                    <div className="text-xl font-mono font-bold text-white">{m.score}/{m.wickets}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-500 font-mono text-sm">{Math.floor(m.balls/6)}.{m.balls%6} Overs</div>
                    <div className="text-[10px] font-bold text-slate-600 uppercase mt-1">{m.status === 'In Progress' ? 'Click to Resume' : 'View Scorecard'}</div>
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

        {/* --- 4. SEARCHABLE DRAFT (WITH 11-PLAYER RULE) --- */}
        {appState === 'draft' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white uppercase tracking-widest">Live Team Draft</h2>
              <button 
                onClick={() => { 
                    if (team1.length !== 11 || team2.length !== 11) return alert(`You must select EXACTLY 11 players for each team.\n\n${team1Name}: ${team1.length}/11\n${team2Name}: ${team2.length}/11`); 
                    setAppState('toss'); 
                }} 
                className="bg-emerald-500 text-black font-bold px-6 py-2 rounded text-sm uppercase tracking-widest hover:bg-emerald-400 transition-colors">
                Confirm Rosters
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Team 1 Panel */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg">
                <h3 className="font-black text-emerald-500 uppercase tracking-widest mb-4">{team1Name} ({team1.length}/11)</h3>
                <input type="text" placeholder="Search players..." value={search1} onChange={e => setSearch1(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded mb-2 text-sm font-bold focus:border-emerald-500 outline-none" />
                {search1 && (
                  <div className="bg-slate-800 rounded border border-slate-700 mb-4 max-h-[150px] overflow-y-auto custom-scrollbar">
                    {getFilteredPlayers(search1).map(p => {
                      const isTaken1 = team1.find(t => t.id === p.id); const isTaken2 = team2.find(t => t.id === p.id);
                      return (<button key={p.id} disabled={isTaken1 || isTaken2 || team1.length >= 11} onClick={() => { addPlayerToTeam(p, 1); setSearch1(''); }} className={`w-full text-left p-2 border-b border-slate-700/50 text-xs font-bold transition-colors ${isTaken1 ? 'bg-emerald-500/20 text-emerald-500 cursor-not-allowed' : isTaken2 ? 'bg-slate-900 text-slate-600 cursor-not-allowed' : 'hover:bg-slate-700 text-white'}`}>{p.name} {isTaken2 && "(At Opponent)"} {isTaken1 && "(Drafted)"}</button>)
                    })}
                  </div>
                )}
                <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {team1.map((p, idx) => (
                    <div key={p.id} className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded">
                      <div className="flex items-center gap-3">
                          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-black">{p.role.substring(0,3).toUpperCase()}</span>
                          <span className="text-sm font-bold text-slate-200">{p.name} {idx === 0 && <span className="text-emerald-500">(C)</span>}</span>
                      </div>
                      <button onClick={() => removePlayer(p.id, 1)} className="text-red-500 hover:bg-red-500/20 px-2 py-1 rounded text-xs font-bold transition-colors">Remove</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team 2 Panel */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg">
                <h3 className="font-black text-cyan-500 uppercase tracking-widest mb-4">{team2Name} ({team2.length}/11)</h3>
                <input type="text" placeholder="Search players..." value={search2} onChange={e => setSearch2(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded mb-2 text-sm font-bold focus:border-cyan-500 outline-none" />
                {search2 && (
                  <div className="bg-slate-800 rounded border border-slate-700 mb-4 max-h-[150px] overflow-y-auto custom-scrollbar">
                    {getFilteredPlayers(search2).map(p => {
                      const isTaken2 = team2.find(t => t.id === p.id); const isTaken1 = team1.find(t => t.id === p.id);
                      return (<button key={p.id} disabled={isTaken1 || isTaken2 || team2.length >= 11} onClick={() => { addPlayerToTeam(p, 2); setSearch2(''); }} className={`w-full text-left p-2 border-b border-slate-700/50 text-xs font-bold transition-colors ${isTaken2 ? 'bg-cyan-500/20 text-cyan-500 cursor-not-allowed' : isTaken1 ? 'bg-slate-900 text-slate-600 cursor-not-allowed' : 'hover:bg-slate-700 text-white'}`}>{p.name} {isTaken1 && "(At Opponent)"} {isTaken2 && "(Drafted)"}</button>)
                    })}
                  </div>
                )}
                <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {team2.map((p, idx) => (
                    <div key={p.id} className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded">
                      <div className="flex items-center gap-3">
                          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-black">{p.role.substring(0,3).toUpperCase()}</span>
                          <span className="text-sm font-bold text-slate-200">{p.name} {idx === 0 && <span className="text-cyan-500">(C)</span>}</span>
                      </div>
                      <button onClick={() => removePlayer(p.id, 2)} className="text-red-500 hover:bg-red-500/20 px-2 py-1 rounded text-xs font-bold transition-colors">Remove</button>
                    </div>
                  ))}
                </div>
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
                 <h2 className="text-2xl font-black uppercase tracking-widest text-white">Match Scorecard</h2>
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
                                 <td className="p-3 font-bold text-white font-sans">{p.name}</td>
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
                                     <td className="p-3 font-bold text-white font-sans">{p.name}</td>
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
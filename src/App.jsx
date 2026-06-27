import { useState, useRef, useEffect } from 'react';
import { playerDatabase as importedDatabase } from './players';

// Franchise Data + Rajasthan Royals
const franchiseTeams = [
    { name: 'Mumbai Indians', code: 'MI' },
    { name: 'Chennai Super Kings', code: 'CSK' },
    { name: 'Royal Challengers Bengaluru', code: 'RCB' },
    { name: 'Rajasthan Royals', code: 'RR' },
    { name: 'MI Women', code: 'MI-W' },
    { name: 'RCB Women', code: 'RCB-W' }
];

// Dynamically Add Vaibhav Suryavanshi to the database
const playerDatabase = [
    ...importedDatabase,
    { id: 99991, name: "Vaibhav Suryavanshi", role: "Batsman", team: "RR", batRating: 84, bowlRating: 20 }
];

function App() {
  const [appState, setAppState] = useState('auth'); 
  const [currentUser, setCurrentUser] = useState(null);
  
  const [authMode, setAuthMode] = useState('login'); 
  const [formData, setFormData] = useState({ name: '', username: '', email: '', mobile: '', password: '', referral: '', agreeTerms: false });
  const [authError, setAuthError] = useState('');
  
  const [matchHistory, setMatchHistory] = useState([]);
  const [viewingScorecard, setViewingScorecard] = useState(null);

  // Match Config
  const [matchFormat, setMatchFormat] = useState('T20'); 
  const [team1Name, setTeam1Name] = useState('My Team'); 
  const [team2Name, setTeam2Name] = useState('Opponent Team');
  
  const [team1, setTeam1] = useState([]); 
  const [team2, setTeam2] = useState([]);
  const [search1, setSearch1] = useState(''); 
  const [search2, setSearch2] = useState('');
  const [selectedFranchise1, setSelectedFranchise1] = useState(''); 
  const [selectedFranchise2, setSelectedFranchise2] = useState('');

  const [captain1, setCaptain1] = useState(''); 
  const [captain2, setCaptain2] = useState('');
  const [orderT1, setOrderT1] = useState([]); 
  const [orderT2, setOrderT2] = useState([]);

  // Toss State
  const [tossPhase, setTossPhase] = useState('call'); 
  const [coinFace, setCoinFace] = useState('?');
  const [tossWinnerTeam, setTossWinnerTeam] = useState('');
  const [matchDecision, setMatchDecision] = useState(''); 
  const [oppCall, setOppCall] = useState('');

  // Live Center
  const [serverId, setServerId] = useState(null);
  const [serverData, setServerData] = useState(null);
  const [prevBalls, setPrevBalls] = useState(0);
  const [commentaryFeed, setCommentaryFeed] = useState([]);
  const [isStarting, setIsStarting] = useState(false);
  
  const [selectedLang, setSelectedLang] = useState('English');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  
  const commentaryEndRef = useRef(null);
  const batSound = useRef(null);
  const wicketSound = useRef(null);
  const cheerSound = useRef(null);

  // --- AUDIO INITIALIZATION ---
  useEffect(() => {
      try {
          if (typeof window !== 'undefined') {
              batSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
              wicketSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2811/2811-preview.mp3');
              cheerSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
          }
      } catch (err) {
          console.log("Audio skipped.");
      }
  }, []);

  function safePlayAudio(audioRef) {
      if (audioRef && audioRef.current) {
          audioRef.current.play().catch(() => console.log("Sound blocked by browser."));
      }
  }

  useEffect(() => { 
      commentaryEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [commentaryFeed]);

  // --- SAFE LOCAL STORAGE ---
  useEffect(() => {
    try {
        const savedUser = localStorage.getItem('cricverse_user');
        if (savedUser) { 
            const parsed = JSON.parse(savedUser); 
            setCurrentUser(parsed); 
            fetchHistory(parsed.id); 
            setAppState('dashboard'); 
        }
    } catch (e) {
        localStorage.removeItem('cricverse_user');
    }
  }, []);

  // --- STABLE LIVE MATCH TICKER (PACING SLOWED DOWN) ---
  useEffect(() => {
    if (appState !== 'match' || !serverId) return;

    let timer;
    const playNext = async () => {
        if (!isPlaying) return;
        
        // Wait for audio to finish speaking
        if (isAudioEnabled && window.speechSynthesis?.speaking) {
            timer = setTimeout(playNext, 1000);
            return;
        }

        try {
            await fetch(`http://127.0.0.1:8000/matches/${serverId}/next-ball`, { method: 'POST' });
            const res = await fetch(`http://127.0.0.1:8000/matches/${serverId}/score`);
            if (!res.ok) return;
            
            const data = await res.json();
            setServerData(data);
            
            if (data.status === "Innings Break") { 
                setIsPlaying(false); 
            }
            else if (data.status === "Completed") { 
                setIsPlaying(false); 
                setViewingScorecard(data); 
                setAppState('scorecard'); 
            }
            else { 
                // Increased delay for a much more comfortable, slower pacing
                timer = setTimeout(playNext, 5500); 
            }
        } catch (err) {
            console.error("Waiting for backend...");
        }
    };

    timer = setTimeout(playNext, 5500);
    return () => clearTimeout(timer);
  }, [appState, serverId, isPlaying, isAudioEnabled]);

  // --- COMMENTARY RECEIVER ---
  useEffect(() => {
    if (serverData && serverData.balls > prevBalls) {
      setPrevBalls(serverData.balls);
      const d = serverData.last_delivery;
      if (d && d.speed) {
        const aiText = d.commentary || "Awaiting commentary...";
        
        setCommentaryFeed(prev => [
            ...prev, 
            { 
                ball: serverData.balls, 
                text: aiText, 
                runs: d.result, 
                type: d.result === 'W' ? 'wicket' : (d.result === 6 || d.result === 4) ? 'boundary' : 'normal' 
            }
        ]);
        
        if (isAudioEnabled) {
            if (d.is_wicket) {
                safePlayAudio(wicketSound);
            } else if (d.result === 4 || d.result === 6) { 
                safePlayAudio(batSound); 
                setTimeout(() => safePlayAudio(cheerSound), 400); 
            } else if (d.result > 0) {
                safePlayAudio(batSound);
            }

            if (window.speechSynthesis) {
                window.speechSynthesis.cancel(); 
                const cleanText = aiText.replace(/[.,!?"]/g, ''); 
                const utterance = new SpeechSynthesisUtterance(cleanText);
                utterance.lang = serverData.language === 'English' ? 'en-IN' : 'hi-IN';
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        }
      }
    }
  }, [serverData, prevBalls, isAudioEnabled]);

  // --- CORE FUNCTIONS ---
  async function handleAuth(endpoint) {
    setAuthError('');
    if (!formData.username || !formData.password) return setAuthError("Please fill in all fields.");
    try {
      const res = await fetch(`http://127.0.0.1:8000/${endpoint}`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(formData) 
      });
      const data = await res.json();
      
      if (data.error) return setAuthError(data.error);
      
      localStorage.setItem('cricverse_user', JSON.stringify(data));
      setCurrentUser(data); 
      fetchHistory(data.id); 
      setAppState('dashboard');
    } catch (err) { 
        setAuthError("Server Offline. Ensure Python is running."); 
    }
  }

  function handleLogout() {
      localStorage.removeItem('cricverse_user'); 
      setCurrentUser(null); 
      setAppState('auth'); 
      setAuthMode('login');
      setFormData({ name: '', username: '', email: '', mobile: '', password: '', referral: '', agreeTerms: false });
  }

  async function fetchHistory(userId) {
    try { 
        const res = await fetch(`http://127.0.0.1:8000/users/${userId}/matches`); 
        const data = await res.json();
        if (Array.isArray(data)) { 
            setMatchHistory(data); 
        } else { 
            setMatchHistory([]); 
        }
    } catch (err) { 
        setMatchHistory([]); 
    }
  }

  async function handleMatchClick(match) {
    try {
        const res = await fetch(`http://127.0.0.1:8000/matches/${match.id}/score`);
        const data = await res.json();
        setServerId(match.id); 
        setServerData(data); 
        setSelectedLang(data.language || 'English');
        
        if (data.status === 'Completed') { 
            setViewingScorecard(data); 
            setAppState('scorecard'); 
        } else { 
            // WIPE frontend memory counter so we don't mute an in-progress game
            setPrevBalls(data.balls);
            setIsPlaying(false); 
            setAppState('match'); 
        }
    } catch (err) { 
        alert("Failed to fetch match. Server may be offline."); 
    }
  }

  async function handleFastForward() {
      setIsPlaying(false);
      try {
          await fetch(`http://127.0.0.1:8000/matches/${serverId}/fast-forward`, { method: 'POST' });
          const res = await fetch(`http://127.0.0.1:8000/matches/${serverId}/score`);
          const data = await res.json();
          setServerData(data);
          
          if (data.status === "Innings Break") { 
              setIsPlaying(false); 
          } else if (data.status === "Completed") { 
              setViewingScorecard(data); 
              setAppState('scorecard'); 
          }
      } catch(err) { 
          alert("Error accelerating match sequences."); 
      }
  }

  async function changeLanguage(lang) {
      setSelectedLang(lang);
      if (serverId) {
          fetch(`http://127.0.0.1:8000/matches/${serverId}/language`, { 
              method: 'PUT', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ language: lang }) 
          }).catch(() => {});
      }
  }

  // --- SQUAD BUILDING ---
  function loadTeamTemplate(dbTeamCode, teamNum) {
      if (!dbTeamCode) {
          if (teamNum === 1) { setSelectedFranchise1(''); setTeam1([]); }
          if (teamNum === 2) { setSelectedFranchise2(''); setTeam2([]); }
          return;
      }
      if (teamNum === 1 && dbTeamCode === selectedFranchise2) return alert("Oops! The Opponent already selected this team.");
      if (teamNum === 2 && dbTeamCode === selectedFranchise1) return alert("Oops! You already selected this team.");
      
      const roster = playerDatabase.filter(p => p.team === dbTeamCode).slice(0, 11).map(p => ({ ...p, isCaptain: false, allocated_overs: 0 }));
      if (teamNum === 1) { 
          setSelectedFranchise1(dbTeamCode); 
          setTeam1(roster); 
      } else { 
          setSelectedFranchise2(dbTeamCode); 
          setTeam2(roster); 
      }
  }

  function addPlayerToTeam(player, teamNum) {
    const newP = { ...player, isCaptain: false, allocated_overs: 0 };
    if (teamNum === 1 && team1.length < 11) setTeam1([...team1, newP]);
    if (teamNum === 2 && team2.length < 11) setTeam2([...team2, newP]);
  }

  function removePlayer(playerId, teamNum) {
    if (teamNum === 1) { 
        setTeam1(team1.filter(p => p.id !== playerId)); 
        setSelectedFranchise1(''); 
    }
    if (teamNum === 2) { 
        setTeam2(team2.filter(p => p.id !== playerId)); 
        setSelectedFranchise2(''); 
    }
  }

  function getFilteredPlayers(query) {
      if (!query) return [];
      return playerDatabase.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  }

  function handleBattingNumberChange(teamNum, currentIndex, newPosStr) {
      let newPos = parseInt(newPosStr) - 1;
      if (isNaN(newPos) || newPos < 0) newPos = 0; 
      if (newPos > 10) newPos = 10;
      
      const team = teamNum === 1 ? [...team1] : [...team2];
      const [movedPlayer] = team.splice(currentIndex, 1);
      team.splice(newPos, 0, movedPlayer); 
      
      teamNum === 1 ? setTeam1(team) : setTeam2(team);
  }

  function movePlayerArrow(teamNum, idx, dir) {
      const team = teamNum === 1 ? [...team1] : [...team2];
      if (dir === 'up' && idx > 0) {
          [team[idx - 1], team[idx]] = [team[idx], team[idx - 1]];
      } else if (dir === 'down' && idx < team.length - 1) {
          [team[idx + 1], team[idx]] = [team[idx], team[idx + 1]];
      }
      teamNum === 1 ? setTeam1(team) : setTeam2(team);
  }

  // --- FAILSAFE BOWLING QUOTAS ---
  function autoAssignQuotas(teamArray, format) {
      try {
          if (!teamArray || !Array.isArray(teamArray)) return [];
          const maxBalls = format === 'T10' ? 10 : 20; 
          const maxPerB = format === 'T10' ? 2 : 4;
          
          let newTeam = teamArray.map(p => ({ ...p, allocated_overs: 0 }));
          let bowlers = newTeam.filter(p => p && p.role && (p.role.includes('Bowl') || p.role.includes('All')));
          
          if (bowlers.length === 0) bowlers = newTeam; 
          
          let allocated = 0; 
          let failsafe = 0; 
          
          while (allocated < maxBalls && failsafe < 500) {
              failsafe++;
              let added = false;
              for (let b of bowlers) { 
                  if (b && b.allocated_overs < maxPerB && allocated < maxBalls) { 
                      b.allocated_overs++; 
                      allocated++; 
                      added = true;
                  } 
              }
              if (!added) bowlers = newTeam; 
          }
          return newTeam;
      } catch (err) { 
          return teamArray || []; 
      }
  }

  function proceedToOvers() {
      try {
          const reqOvers = matchFormat === 'T10' ? 10 : 20;
          const t1Total = (team1 || []).reduce((sum, p) => sum + (p && p.allocated_overs ? p.allocated_overs : 0), 0);
          const t2Total = (team2 || []).reduce((sum, p) => sum + (p && p.allocated_overs ? p.allocated_overs : 0), 0);
          
          if (t1Total !== reqOvers) {
              setTeam1(autoAssignQuotas(team1, matchFormat));
          }
          if (t2Total !== reqOvers) {
              setTeam2(autoAssignQuotas(team2, matchFormat));
          }
          setAppState('bowlingQuotas');
      } catch (err) {
          setAppState('bowlingQuotas');
      }
  }

  function updateBowlerQuota(teamNum, playerId, delta) {
      const maxFormat = matchFormat === 'T10' ? 10 : 20; 
      const maxPerB = matchFormat === 'T10' ? 2 : 4;
      const team = teamNum === 1 ? [...team1] : [...team2];
      
      const currentTotal = team.reduce((s, p) => s + (p.allocated_overs || 0), 0);
      const idx = team.findIndex(p => p.id === playerId);
      
      if (idx === -1) return;

      let newVal = (team[idx].allocated_overs || 0) + delta;
      
      if (newVal < 0) newVal = 0; 
      if (newVal > maxPerB) newVal = maxPerB;
      if (delta > 0 && currentTotal >= maxFormat) return; 
      
      team[idx].allocated_overs = newVal;
      teamNum === 1 ? setTeam1(team) : setTeam2(team);
  }

  function validateBowlingOvers() {
      const req = matchFormat === 'T10' ? 10 : 20;
      const t1O = (team1 || []).reduce((s, p) => s + (p.allocated_overs || 0), 0);
      const t2O = (team2 || []).reduce((s, p) => s + (p.allocated_overs || 0), 0);
      
      if (t1O !== req || t2O !== req) return alert(`Both team selections require exactly ${req} overs assigned.`);
      
      const genOrder = (teamArray) => {
          try {
              let pool = []; 
              (teamArray || []).forEach(p => { 
                  if (p && p.allocated_overs) {
                      for(let i=0; i < p.allocated_overs; i++) pool.push(p.name); 
                  }
              });
              
              let order = []; 
              let last = ""; 
              let failsafe = 0;
              
              while (pool.length > 0 && failsafe < 500) { 
                  failsafe++;
                  let idx = pool.findIndex(n => n !== last); 
                  if (idx === -1) idx = 0; 
                  
                  if (pool[idx]) { 
                      order.push(pool[idx]); 
                      last = pool[idx]; 
                      pool.splice(idx, 1); 
                  } else { 
                      break; 
                  }
              }
              return order;
          } catch(err) { 
              return []; 
          }
      };
      
      setOrderT1(genOrder(team1)); 
      setOrderT2(genOrder(team2));
      setAppState('bowlingOrder');
  }

  // --- TOSS & MATCH INITIATION ---
  function initiateToss() {
      const call = Math.random() > 0.5 ? 'HEADS' : 'TAILS';
      setOppCall(call); 
      setTossPhase('call'); 
      setAppState('toss');
  }

  function handleUserFlip() {
      setTossPhase('flip');
      setTimeout(() => {
          const resultFace = Math.random() > 0.5 ? 'HEADS' : 'TAILS';
          setCoinFace(resultFace);
          if (resultFace === oppCall) { 
              setTossWinnerTeam(team2Name); 
              setMatchDecision(Math.random() > 0.5 ? 'Bat' : 'Bowl'); 
              setTossPhase('oppWin'); 
          } else { 
              setTossWinnerTeam(team1Name); 
              setTossPhase('userWin'); 
          }
      }, 2500);
  }

  async function startServerMatch() {
    if (isStarting) return; 
    setIsStarting(true);
    
    setServerData(null);
    setCommentaryFeed([]);
    setPrevBalls(0);
    
    try {
      let bat = team1 || []; 
      let bowl = team2 || []; 
      let batName = team1Name; 
      let bowlName = team2Name;
      let inn1Seq = orderT2 || []; 
      let inn2Seq = orderT1 || [];
      
      if ((tossWinnerTeam === team1Name && matchDecision === 'Bowl') || (tossWinnerTeam === team2Name && matchDecision === 'Bat')) {
          bat = team2; 
          bowl = team1; 
          batName = team2Name; 
          bowlName = team1Name; 
          inn1Seq = orderT1 || []; 
          inn2Seq = orderT2 || [];
      }
      
      const res = await fetch('http://127.0.0.1:8000/matches/', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            user_id: currentUser.id, 
            format: matchFormat, 
            batting_team: bat, 
            bowling_team: bowl, 
            batting_team_name: batName, 
            bowling_team_name: bowlName, 
            inn1_bowling_seq: inn1Seq, 
            inn2_bowling_seq: inn2Seq 
        })
      });
      
      const data = await res.json(); 
      setServerId(data.id);
      
      await fetch(`http://127.0.0.1:8000/matches/${data.id}/language`, { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ language: selectedLang }) 
      });
      
      setIsPlaying(true); 
      setAppState('match'); 
    } catch (err) { 
        alert("Server connection missing. Ensure Python is running!"); 
    }
    setIsStarting(false);
  }

  // --- UNBREAKABLE CAPTAIN LOOKUP ---
  function getCapName(teamArray, capId) {
      try {
          if (!teamArray || !Array.isArray(teamArray)) return "Captain";
          const player = teamArray.find(p => p && p.id && String(p.id) === String(capId));
          return player ? player.name : "Captain";
      } catch (err) {
          return "Captain";
      }
  }

  function getWinnerText() {
      if (!viewingScorecard) return "";
      if (viewingScorecard.match_winner === "Match Tied") return "Match Tied!";
      return `${viewingScorecard.match_winner} Won the Match!`;
  }

  // --- PERFECT MVP CALCULATOR ---
  function computeMVP() {
      if (!viewingScorecard) return null;
      let playersPool = [];
      
      if (Array.isArray(viewingScorecard.batting_team)) {
          playersPool.push(...viewingScorecard.batting_team);
      }
      if (Array.isArray(viewingScorecard.bowling_team)) {
          playersPool.push(...viewingScorecard.bowling_team);
      }
      
      let topVal = -1; 
      let mvpObject = null;
      
      playersPool.forEach(p => {
          if (p) {
              let score = (p.runs || 0) + ((p.fours || 0) * 1) + ((p.sixes || 0) * 2) + ((p.wickets || 0) * 25);
              if (score > topVal) { 
                  topVal = score; 
                  mvpObject = { 
                      name: p.name, 
                      pts: score, 
                      runs: p.runs || 0, 
                      wkts: p.wickets || 0, 
                      balls: p.balls || 0,
                      runs_conceded: p.runs_conceded || 0 
                  }; 
              }
          }
      });
      return mvpObject;
  }

  const matchMVP = computeMVP();

  // --- SAFE UI VARIABLES ---
  const reqOvers = matchFormat === 'T10' ? 10 : 20; 
  const maxPerB = matchFormat === 'T10' ? 2 : 4;
  
  const t1OversTotal = (team1 || []).reduce((sum, p) => sum + (p && p.allocated_overs ? p.allocated_overs : 0), 0);
  const t2OversTotal = (team2 || []).reduce((sum, p) => sum + (p && p.allocated_overs ? p.allocated_overs : 0), 0);
  
  const activeScore = serverData?.score || 0; 
  const activeWickets = serverData?.wickets || 0; 
  const activeBalls = serverData?.balls || 0;
  
  const overs = Math.floor(activeBalls / 6); 
  const legalBalls = activeBalls % 6; 
  const thisOver = serverData?.recent_overs || [];
  
  const strikerData = serverData?.batting_team?.find(p => p && p.name === serverData?.striker_name) || { name: "Waiting...", runs: 0, balls: 0, fours: 0, sixes: 0 };
  const nonStrikerData = serverData?.batting_team?.find(p => p && p.name === serverData?.non_striker_name) || null;
  const bowlerData = serverData?.bowling_team?.find(p => p && p.name === serverData?.bowler_name) || { name: "Waiting...", wickets: 0, runs_conceded: 0, balls_bowled: 0 };
  
  const bOvers = Math.floor((bowlerData?.balls_bowled || 0) / 6); 
  const bRem = (bowlerData?.balls_bowled || 0) % 6;

  // --- UI RENDER ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden pb-20">
      <style>{`
        .coin-container { display: flex; justify-content: center; align-items: center; height: 300px; perspective: 1000px; }
        .coin { width: 250px; height: 250px; border-radius: 50%; transform-style: preserve-3d; display: flex; justify-content: center; align-items: center; }
        .revolving { animation: spin 0.2s linear infinite; }
        @keyframes spin { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase flex items-center gap-2 cursor-pointer text-white" onClick={() => currentUser && setAppState('dashboard')}>
            <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-black text-xs">CP</div>
            CRICVERSE <span className="text-emerald-500">PRO</span>
          </h1>
          <div className="flex items-center gap-4">
            {currentUser && (<button onClick={handleLogout} className="text-xs bg-slate-800 hover:bg-red-500 hover:text-white px-3 py-1 rounded font-bold">Logout</button>)}
            <div className="text-[10px] font-bold bg-slate-950 text-slate-400 px-2 py-1 rounded border border-slate-800 uppercase">{appState}</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 lg:p-8">
        
        {/* --- 1. FULL AUTH SCREEN RESTORED --- */}
        {appState === 'auth' && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl mt-10">
            <h2 className="text-xl font-bold mb-6 text-white uppercase tracking-widest border-b border-slate-800 pb-4 text-center">{authMode === 'login' ? 'Login' : 'Create Account'}</h2>
            {authError && <div className="bg-red-500/10 text-red-400 p-3 mb-6 rounded text-sm font-bold border border-red-500/20 text-left">{authError}</div>}
            
            {authMode === 'login' && (
              <div className="space-y-4">
                <input type="text" placeholder="Username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white outline-none" />
                <input type="password" placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white outline-none" />
                <button onClick={() => handleAuth('login')} className="w-full bg-emerald-500 text-black font-bold py-3 rounded text-sm uppercase tracking-widest hover:bg-emerald-400 transition-colors mt-2">Login</button>
                <div className="mt-4 text-sm text-slate-500 text-center">New player? <button onClick={() => setAuthMode('register')} className="text-emerald-500 font-bold hover:underline">Register here</button></div>
              </div>
            )}
            
            {authMode === 'register' && (
              <div className="space-y-4 text-left">
                <input type="text" placeholder="Full Name *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white outline-none" />
                <input type="text" placeholder="Username *" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white outline-none" />
                <input type="email" placeholder="Email Address *" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white outline-none" />
                <input type="tel" placeholder="Mobile Number *" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white outline-none" />
                <input type="password" placeholder="Password *" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white outline-none" />
                <input type="text" placeholder="Referral Code (Optional)" value={formData.referral} onChange={e => setFormData({...formData, referral: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white outline-none" />
                
                <button onClick={() => handleAuth('register')} className="w-full bg-emerald-500 text-black font-bold py-3 mt-4 rounded text-sm uppercase tracking-widest transition-colors">Create Account</button>
                <div className="mt-4 text-sm text-slate-500 text-center">Already signed up? <button onClick={() => setAuthMode('login')} className="text-emerald-500 font-bold hover:underline">Login here</button></div>
              </div>
            )}
          </div>
        )}

        {/* --- 2. DASHBOARD --- */}
        {appState === 'dashboard' && (
          <div className="max-w-4xl mx-auto mt-10">
            <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-black uppercase tracking-widest text-white">Match Dashboard</h2>
              <button onClick={() => { 
                  setTeam1([]); 
                  setTeam2([]); 
                  setOrderT1([]); 
                  setOrderT2([]); 
                  setTeam1Name('My Team'); 
                  setTeam2Name('Opponent Team'); 
                  setCaptain1(''); 
                  setCaptain2(''); 
                  setServerData(null);
                  setCommentaryFeed([]);
                  setPrevBalls(0);
                  setAppState('config'); 
              }} className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-6 py-3 rounded uppercase tracking-widest text-sm shadow-lg transition-colors">Start New Match</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(!Array.isArray(matchHistory) || matchHistory.length === 0) && <p className="text-slate-500 font-mono text-sm">No matches played yet.</p>}
              
              {Array.isArray(matchHistory) && matchHistory.map(m => (
                <div key={m.id} onClick={() => handleMatchClick(m)} className="bg-slate-900 border border-slate-800 hover:border-slate-600 p-5 rounded-xl flex justify-between items-center transition-all cursor-pointer shadow-sm">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-1 text-emerald-500">{m.format} Match #{m.id}</div>
                    <div className="text-xl font-mono font-black text-white">{m.score}/{m.wickets}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 font-mono text-sm">{Math.floor(m.balls/6)}.{m.balls%6} / {m.format==='T10'?10:20} Ov</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase mt-1 bg-slate-950 px-2 py-1 rounded inline-block">{m.status === 'Completed' ? 'Match Result' : 'Resume Match'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- WIZARD STEP 1: CONFIG --- */}
        {appState === 'config' && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-xl mt-10">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
               <h2 className="text-xl font-bold text-white uppercase tracking-widest">1. Match Setup</h2>
               <button onClick={() => setAppState('dashboard')} className="text-slate-500 text-xs font-bold hover:text-white">← Cancel</button>
            </div>
            
            <div className="space-y-6 mb-8">
              <div>
                <label className="block text-slate-500 font-bold mb-2 uppercase text-[10px] tracking-widest">Match Format</label>
                <div className="flex gap-2">
                    <button onClick={() => setMatchFormat('T10')} className={`flex-1 py-3 font-bold rounded text-sm uppercase transition-colors ${matchFormat === 'T10' ? 'bg-emerald-500 text-black' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'}`}>T10 (10 Overs)</button>
                    <button onClick={() => setMatchFormat('T20')} className={`flex-1 py-3 font-bold rounded text-sm uppercase transition-colors ${matchFormat === 'T20' ? 'bg-emerald-500 text-black' : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'}`}>T20 (20 Overs)</button>
                </div>
              </div>
              <div className="space-y-4">
                  <div>
                      <label className="block text-slate-500 font-bold mb-2 uppercase text-[10px] tracking-widest">Your Team Name</label>
                      <input type="text" value={team1Name} onChange={(e) => setTeam1Name(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white text-sm font-bold outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                      <label className="block text-slate-500 font-bold mb-2 uppercase text-[10px] tracking-widest">Opponent's Name</label>
                      <input type="text" value={team2Name} onChange={(e) => setTeam2Name(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white text-sm font-bold outline-none focus:border-cyan-500" />
                  </div>
              </div>
            </div>
            
            <button onClick={() => setAppState('draft')} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black px-6 py-4 rounded uppercase tracking-widest text-sm transition-colors shadow-lg">Next: Pick Your Players →</button>
          </div>
        )}

        {/* --- WIZARD STEP 2: DRAFT (CUSTOM SEARCH RESTORED VISIBLY) --- */}
        {appState === 'draft' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <button onClick={() => setAppState('config')} className="text-slate-500 hover:text-white font-bold text-sm">← Back</button>
              <h2 className="text-lg font-bold text-white uppercase tracking-widest">2. Select Your Squads</h2>
              <button onClick={() => {
                  if ((team1 || []).length !== 11 || (team2 || []).length !== 11) return alert(`Please select exactly 11 players for both teams!`); 
                  setAppState('captains');
              }} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-2 rounded text-sm uppercase tracking-widest shadow-lg">Now, select captains →</button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* TEAM 1 DRAFT BOARD */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                    <h3 className="font-black text-emerald-500 uppercase tracking-widest">{team1Name}</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 border border-slate-700 px-2 py-1 rounded">{(team1 || []).length} / 11</span>
                        <button onClick={() => { setTeam1([]); setSelectedFranchise1(''); }} className="text-xs bg-slate-900 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white px-2 py-1 rounded transition-colors">Clear</button>
                    </div>
                </div>

                {/* Option 1: Custom Player Search */}
                <div className="mb-4 bg-slate-900 border border-slate-700 p-3 rounded">
                    <label className="block text-slate-400 text-[10px] font-bold uppercase mb-2 tracking-widest">1. Add Specific Players</label>
                    <div className="relative">
                        <input type="text" placeholder="Search and add custom player..." value={search1} onChange={e => setSearch1(e.target.value)} disabled={(team1 || []).length >= 11} className="w-full bg-slate-950 p-2 rounded text-white text-xs outline-none focus:border-emerald-500 border border-slate-800 disabled:opacity-50" />
                        
                        {search1 && (
                            <div className="absolute w-full mt-1 bg-slate-800 border border-slate-700 rounded shadow-xl max-h-40 overflow-y-auto z-20 custom-scrollbar">
                                {getFilteredPlayers(search1).map(p => {
                                    const taken = (team1 || []).find(t => t && t.id === p.id) || (team2 || []).find(t => t && t.id === p.id);
                                    return (
                                        <button key={`s1-${p.id}`} disabled={taken} onClick={() => { addPlayerToTeam(p, 1); setSearch1(''); }} className={`w-full text-left p-3 text-xs border-b border-slate-700 font-bold ${taken ? 'text-slate-500 cursor-not-allowed' : 'text-white hover:bg-slate-700'}`}>
                                            {p.name} {taken ? '(Added)' : ''}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Option 2: Full Franchise Fill */}
                <div className="mb-4 bg-slate-900 border border-slate-700 p-3 rounded">
                    <label className="block text-slate-400 text-[10px] font-bold uppercase mb-2 tracking-widest">2. Or Auto-Fill Franchise Squad</label>
                    <select value={selectedFranchise1} onChange={(e) => loadTeamTemplate(e.target.value, 1)} className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs font-bold outline-none text-white focus:border-emerald-500">
                        <option value="">Select Full Franchise Team...</option>
                        {franchiseTeams.map(t => <option key={t.code} value={t.code} disabled={selectedFranchise2 === t.code}>{t.name}</option>)}
                    </select>
                </div>

                <div className="space-y-2 mt-4 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {(team1 || []).map((p, idx) => {
                      if (!p) return null;
                      return (
                        <div key={`t1-${p.id}`} className="flex justify-between items-center border p-3 rounded-lg bg-slate-900 border-slate-800">
                          <span className="text-sm font-bold text-white">{idx+1}. {p.name}</span>
                          <button onClick={() => removePlayer(p.id, 1)} className="text-slate-600 hover:text-red-400 text-xs font-bold">Remove</button>
                        </div>
                      );
                  })}
                </div>
              </div>

              {/* TEAM 2 DRAFT BOARD */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                    <h3 className="font-black text-cyan-500 uppercase tracking-widest">{team2Name}</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 border border-slate-700 px-2 py-1 rounded">{(team2 || []).length} / 11</span>
                        <button onClick={() => { setTeam2([]); setSelectedFranchise2(''); }} className="text-xs bg-slate-900 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white px-2 py-1 rounded transition-colors">Clear</button>
                    </div>
                </div>

                {/* Option 1: Custom Player Search */}
                <div className="mb-4 bg-slate-900 border border-slate-700 p-3 rounded">
                    <label className="block text-slate-400 text-[10px] font-bold uppercase mb-2 tracking-widest">1. Add Specific Players</label>
                    <div className="relative">
                        <input type="text" placeholder="Search and add custom player..." value={search2} onChange={e => setSearch2(e.target.value)} disabled={(team2 || []).length >= 11} className="w-full bg-slate-950 p-2 rounded text-white text-xs outline-none focus:border-cyan-500 border border-slate-800 disabled:opacity-50" />
                        
                        {search2 && (
                            <div className="absolute w-full mt-1 bg-slate-800 border border-slate-700 rounded shadow-xl max-h-40 overflow-y-auto z-20 custom-scrollbar">
                                {getFilteredPlayers(search2).map(p => {
                                    const taken = (team2 || []).find(t => t && t.id === p.id) || (team1 || []).find(t => t && t.id === p.id);
                                    return (
                                        <button key={`s2-${p.id}`} disabled={taken} onClick={() => { addPlayerToTeam(p, 2); setSearch2(''); }} className={`w-full text-left p-3 text-xs border-b border-slate-700 font-bold ${taken ? 'text-slate-500 cursor-not-allowed' : 'text-white hover:bg-slate-700'}`}>
                                            {p.name} {taken ? '(Added)' : ''}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Option 2: Full Franchise Fill */}
                <div className="mb-4 bg-slate-900 border border-slate-700 p-3 rounded">
                    <label className="block text-slate-400 text-[10px] font-bold uppercase mb-2 tracking-widest">2. Or Auto-Fill Franchise Squad</label>
                    <select value={selectedFranchise2} onChange={(e) => loadTeamTemplate(e.target.value, 2)} className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-xs font-bold outline-none text-white focus:border-cyan-500">
                        <option value="">Select Full Franchise Team...</option>
                        {franchiseTeams.map(t => <option key={t.code} value={t.code} disabled={selectedFranchise1 === t.code}>{t.name}</option>)}
                    </select>
                </div>

                <div className="space-y-2 mt-4 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {(team2 || []).map((p, idx) => {
                      if (!p) return null;
                      return (
                        <div key={`t2-${p.id}`} className="flex justify-between items-center border p-3 rounded-lg bg-slate-900 border-slate-800">
                          <span className="text-sm font-bold text-white">{idx+1}. {p.name}</span>
                          <button onClick={() => removePlayer(p.id, 2)} className="text-slate-600 hover:text-red-400 text-xs font-bold">Remove</button>
                        </div>
                      );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- WIZARD STEP 3: CAPTAINS --- */}
        {appState === 'captains' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl animate-fade-in">
             <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <button onClick={() => setAppState('draft')} className="text-slate-500 hover:text-white font-bold text-sm">← Back</button>
              <h2 className="text-lg font-bold text-white uppercase tracking-widest">3. Assign Captains</h2>
              <button onClick={() => {
                  if (!captain1 || !captain2) return alert("Please select a captain for both teams!");
                  setAppState('battingOrder');
              }} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-2 rounded text-sm uppercase tracking-widest shadow-lg transition-colors">Now, select batting order →</button>
            </div>
            
            <p className="text-slate-400 text-sm mb-6 bg-slate-950 p-4 rounded-lg border border-slate-800 text-center">
                👑 Select the leader for each squad. The captain will represent the team at the match toss.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center shadow-inner">
                    <h3 className="font-black text-emerald-500 uppercase tracking-widest mb-4">{team1Name}</h3>
                    <select value={captain1} onChange={(e) => setCaptain1(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-sm font-bold text-white outline-none">
                        <option value="">Select Captain...</option>
                        {(team1 || []).map(p => {
                            if (!p) return null;
                            return <option key={`c1-${p.id}`} value={p.id}>{p.name}</option>
                        })}
                    </select>
                </div>
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center shadow-inner">
                    <h3 className="font-black text-cyan-500 uppercase tracking-widest mb-4">{team2Name}</h3>
                    <select value={captain2} onChange={(e) => setCaptain2(e.target.value)} className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-sm font-bold text-white outline-none">
                        <option value="">Select Captain...</option>
                        {(team2 || []).map(p => {
                            if (!p) return null;
                            return <option key={`c2-${p.id}`} value={p.id}>{p.name}</option>
                        })}
                    </select>
                </div>
            </div>
          </div>
        )}

        {/* --- WIZARD STEP 4: BATTING ORDER --- */}
        {appState === 'battingOrder' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl animate-fade-in">
             <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <button onClick={() => setAppState('captains')} className="text-slate-500 hover:text-white font-bold text-sm">← Back</button>
              <h2 className="text-lg font-bold text-white uppercase tracking-widest">4. Set Batting Order</h2>
              <button onClick={proceedToOvers} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-2 rounded text-sm uppercase tracking-widest shadow-lg transition-colors">Now, assign overs →</button>
            </div>
            
            <p className="text-slate-400 text-sm mb-6 bg-slate-950 p-4 rounded-lg border border-slate-800">
                🏏 <b>Easy Sort:</b> Type a number (1 to 11) in the box next to a player, OR click the large Up/Down arrows on the right!
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-inner">
                    <h3 className="font-black text-emerald-500 uppercase tracking-widest mb-4">{team1Name} Lineup</h3>
                    <div className="space-y-2">
                        {(team1 || []).map((p, idx) => {
                            if (!p) return null;
                            return (
                                <div key={`bo1-${p.id}`} className="flex justify-between items-center bg-slate-900 border border-slate-800 p-2 rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <input type="number" value={idx + 1} onChange={(e) => handleBattingNumberChange(1, idx, e.target.value)} className="w-14 bg-slate-950 border border-slate-700 text-white font-black text-center text-sm p-3 rounded outline-none focus:border-emerald-500" />
                                        <span className="text-sm font-bold text-white">{p.name} {String(captain1) === String(p.id) && <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1 rounded ml-1">C</span>}</span>
                                    </div>
                                    <div className="flex items-center gap-4 pr-2">
                                        <span className="text-[9px] bg-slate-950 text-slate-500 px-2 py-1 rounded border border-slate-800 uppercase hidden sm:inline-block">{(p.role || "").substring(0,3)}</span>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => movePlayerArrow(1, idx, 'up')} className="text-slate-400 hover:text-emerald-400 text-2xl leading-none font-bold">▲</button>
                                            <button onClick={() => movePlayerArrow(1, idx, 'down')} className="text-slate-400 hover:text-emerald-400 text-2xl leading-none font-bold">▼</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-inner">
                    <h3 className="font-black text-cyan-500 uppercase tracking-widest mb-4">{team2Name} Lineup</h3>
                    <div className="space-y-2">
                        {(team2 || []).map((p, idx) => {
                            if (!p) return null;
                            return (
                                <div key={`bo2-${p.id}`} className="flex justify-between items-center bg-slate-900 border border-slate-800 p-2 rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <input type="number" value={idx + 1} onChange={(e) => handleBattingNumberChange(2, idx, e.target.value)} className="w-14 bg-slate-950 border border-slate-700 text-white font-black text-center text-sm p-3 rounded outline-none focus:border-cyan-500" />
                                        <span className="text-sm font-bold text-white">{p.name} {String(captain2) === String(p.id) && <span className="text-[10px] text-cyan-500 bg-cyan-500/10 px-1 rounded ml-1">C</span>}</span>
                                    </div>
                                    <div className="flex items-center gap-4 pr-2">
                                        <span className="text-[9px] bg-slate-950 text-slate-500 px-2 py-1 rounded border border-slate-800 uppercase hidden sm:inline-block">{(p.role || "").substring(0,3)}</span>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => movePlayerArrow(2, idx, 'up')} className="text-slate-400 hover:text-cyan-400 text-2xl leading-none font-bold">▲</button>
                                            <button onClick={() => movePlayerArrow(2, idx, 'down')} className="text-slate-400 hover:text-cyan-400 text-2xl leading-none font-bold">▼</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* --- WIZARD STEP 5: ASSIGN OVERS --- */}
        {appState === 'bowlingQuotas' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl animate-fade-in">
             <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <button onClick={() => setAppState('battingOrder')} className="text-slate-500 hover:text-white font-bold text-sm">← Back</button>
              <h2 className="text-lg font-bold text-white uppercase tracking-widest">5. Assign Overs</h2>
              <button onClick={validateBowlingOvers} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-2 rounded text-sm uppercase tracking-widest shadow-lg transition-colors">Now, select bowling order →</button>
            </div>
            
            <p className="text-slate-400 text-sm mb-6 bg-slate-950 p-4 rounded-lg border border-slate-800">
                🎯 The game automatically assigned {reqOvers} overs to your top bowlers! You can change this below using the + and - buttons (Max {maxPerB} per bowler).
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Team 1 Bowling Overs */}
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-inner">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-3">
                        <h3 className="font-black text-emerald-500 uppercase tracking-widest">{team1Name}</h3>
                        <div className={`text-[10px] font-bold px-3 py-1 rounded border uppercase tracking-widest ${t1OversTotal === reqOvers ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'}`}>
                            Overs Given: {t1OversTotal} / {reqOvers}
                        </div>
                    </div>
                    <div className="space-y-2">
                        {(team1 || []).map((p) => {
                            if (!p) return null;
                            return (
                                <div key={`bq1-${p.id}`} className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded-lg">
                                    <span className="text-sm font-bold text-white">{p.name} <span className="text-slate-500 text-[9px] uppercase ml-2">{(p.role || "").substring(0,3)}</span></span>
                                    <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
                                        <button onClick={() => updateBowlerQuota(1, p.id, -1)} className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm font-black transition-colors">-</button>
                                        <span className="text-sm font-mono w-4 text-center font-bold text-emerald-400">{p.allocated_overs}</span>
                                        <button disabled={t1OversTotal >= reqOvers || p.allocated_overs >= maxPerB} onClick={() => updateBowlerQuota(1, p.id, 1)} className={`w-8 h-8 rounded text-sm font-black transition-colors ${(t1OversTotal >= reqOvers || p.allocated_overs >= maxPerB) ? 'bg-slate-900 text-slate-700 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>+</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Team 2 Bowling Overs */}
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-inner">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-3">
                        <h3 className="font-black text-cyan-500 uppercase tracking-widest">{team2Name}</h3>
                        <div className={`text-[10px] font-bold px-3 py-1 rounded border uppercase tracking-widest ${t2OversTotal === reqOvers ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'}`}>
                            Overs Given: {t2OversTotal} / {reqOvers}
                        </div>
                    </div>
                    <div className="space-y-2">
                        {(team2 || []).map((p) => {
                            if (!p) return null;
                            return (
                                <div key={`bq2-${p.id}`} className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded-lg">
                                    <span className="text-sm font-bold text-white">{p.name} <span className="text-slate-500 text-[9px] uppercase ml-2">{(p.role || "").substring(0,3)}</span></span>
                                    <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
                                        <button onClick={() => updateBowlerQuota(2, p.id, -1)} className="w-8 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm font-black transition-colors">-</button>
                                        <span className="text-sm font-mono w-4 text-center font-bold text-cyan-400">{p.allocated_overs}</span>
                                        <button disabled={t2OversTotal >= reqOvers || p.allocated_overs >= maxPerB} onClick={() => updateBowlerQuota(2, p.id, 1)} className={`w-8 h-8 rounded text-sm font-black transition-colors ${(t2OversTotal >= reqOvers || p.allocated_overs >= maxPerB) ? 'bg-slate-900 text-slate-700 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>+</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* --- WIZARD STEP 6: BOWLING ORDER --- */}
        {appState === 'bowlingOrder' && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl animate-fade-in">
             <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <button onClick={() => setAppState('bowlingQuotas')} className="text-slate-500 hover:text-white font-bold text-sm">← Back</button>
              <h2 className="text-lg font-bold text-white uppercase tracking-widest">6. Choose Bowling Order</h2>
              <button onClick={() => setAppState('review')} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-2 rounded text-sm uppercase tracking-widest shadow-lg transition-colors">Final Review →</button>
            </div>
            
            <p className="text-slate-400 text-sm mb-6 bg-slate-950 p-4 rounded-lg border border-slate-800">
               ✅ Good job! Simply pick who will bowl Over 1, Over 2, etc. (We guessed a good order for you, but you can change it below).
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Team 1 Bowling Sequence */}
                <div className="bg-slate-950 p-5 border border-slate-800 rounded-xl shadow-inner">
                    <h3 className="font-black text-emerald-500 uppercase mb-4 tracking-widest border-b border-slate-800 pb-2">{team1Name} Order</h3>
                    <div className="space-y-3 h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                        {(orderT1 || []).map((bowler, idx) => (
                            <div key={`seq1-${idx}`} className="flex items-center gap-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
                                <span className="text-xs text-slate-500 font-mono w-16 uppercase font-bold tracking-widest">Over {idx+1}</span>
                                <select value={bowler || ""} onChange={(e) => { const n=[...orderT1]; n[idx]=e.target.value; setOrderT1(n); }} className="bg-slate-950 border border-slate-700 p-3 rounded text-sm font-bold w-full outline-none text-white focus:border-emerald-500 transition-colors">
                                    <option value="">Select Bowler</option>
                                    {(team1 || []).filter(p => p && p.allocated_overs > 0).map(p => (
                                        <option key={`opt1-${p.id}`} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Team 2 Bowling Sequence */}
                <div className="bg-slate-950 p-5 border border-slate-800 rounded-xl shadow-inner">
                    <h3 className="font-black text-cyan-500 uppercase mb-4 tracking-widest border-b border-slate-800 pb-2">{team2Name} Order</h3>
                    <div className="space-y-3 h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                        {(orderT2 || []).map((bowler, idx) => (
                            <div key={`seq2-${idx}`} className="flex items-center gap-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
                                <span className="text-xs text-slate-500 font-mono w-16 uppercase font-bold tracking-widest">Over {idx+1}</span>
                                <select value={bowler || ""} onChange={(e) => { const n=[...orderT2]; n[idx]=e.target.value; setOrderT2(n); }} className="bg-slate-950 border border-slate-700 p-3 rounded text-sm font-bold w-full outline-none text-white focus:border-cyan-500 transition-colors">
                                    <option value="">Select Bowler</option>
                                    {(team2 || []).filter(p => p && p.allocated_overs > 0).map(p => (
                                        <option key={`opt2-${p.id}`} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* --- WIZARD STEP 7: GORGEOUS FINAL REVIEW PANEL --- */}
        {appState === 'review' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 p-8 rounded-xl shadow-2xl animate-fade-in relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
             
             <h2 className="text-3xl font-black text-white uppercase text-center mb-6 mt-2 tracking-widest">Match Setup Complete!</h2>
             
             <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 mb-8 space-y-4">
                 <div className="flex justify-between border-b border-slate-900 pb-3">
                     <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Format</span>
                     <span className="text-white font-mono font-black">{matchFormat} Match</span>
                 </div>
                 <div className="flex justify-between border-b border-slate-900 pb-3">
                     <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Your Squad</span>
                     <div className="text-right">
                         <span className="text-emerald-400 font-black block text-sm">{team1Name}</span>
                         <span className="text-[10px] text-slate-500 uppercase tracking-widest">Captain: <span className="text-white">{getCapName(team1, captain1)}</span></span>
                     </div>
                 </div>
                 <div className="flex justify-between border-b border-slate-900 pb-3">
                     <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Opponent Squad</span>
                     <div className="text-right">
                         <span className="text-cyan-400 font-black block text-sm">{team2Name}</span>
                         <span className="text-[10px] text-slate-500 uppercase tracking-widest">Captain: <span className="text-white">{getCapName(team2, captain2)}</span></span>
                     </div>
                 </div>
                 <div className="flex justify-between pb-1">
                     <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Environment</span>
                     <span className="text-amber-500 font-black text-sm">{selectedLang} Commentary</span>
                 </div>
             </div>

             <p className="text-slate-400 mb-10 max-w-lg mx-auto font-bold text-center leading-relaxed">
                 ✨ Make any last-minute changes using the Back button now. If you are ready, let's head to the pitch and ENJOY THE MATCH with all your custom selections! ✨
             </p>
             
             <div className="flex justify-center gap-4">
                 <button onClick={() => setAppState('bowlingOrder')} className="bg-slate-950 text-slate-400 border border-slate-800 font-bold px-8 py-4 rounded text-sm uppercase tracking-widest hover:bg-slate-800 hover:text-white transition-colors">← Wait, Go Back</button>
                 <button onClick={initiateToss} className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-12 py-4 rounded uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all transform hover:-translate-y-1">Proceed to Toss →</button>
             </div>
          </div>
        )}

        {/* --- BIGGER, BETTER TOSS SCREEN --- */}
        {appState === 'toss' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 p-10 rounded-xl shadow-2xl mt-10 text-center animate-fade-in relative overflow-hidden">
            <h2 className="text-3xl font-black mb-8 text-white uppercase tracking-widest border-b border-slate-800 pb-4">MATCH TOSS</h2>
            
            <div className="flex justify-between items-center mb-10 bg-slate-950 p-6 rounded-xl border border-slate-800">
               <div className="text-center">
                   <div className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest mb-1">{team1Name}</div>
                   <div className="font-black text-xl text-white">{getCapName(team1, captain1)}</div>
                   <div className="text-slate-500 text-xs mt-1 font-mono">(My Team)</div>
               </div>
               <div className="font-black text-slate-700 italic text-2xl">VS</div>
               <div className="text-center">
                   <div className="text-cyan-500 text-[10px] font-bold uppercase tracking-widest mb-1">{team2Name}</div>
                   <div className="font-black text-xl text-white">{getCapName(team2, captain2)}</div>
                   <div className="text-slate-500 text-xs mt-1 font-mono">(Opponent)</div>
               </div>
            </div>

            <div className="coin-container mb-10">
              <div className={`coin bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 border-[6px] border-yellow-600 shadow-[0_0_60px_rgba(234,179,8,0.25)] ${tossPhase === 'flip' ? 'revolving' : ''}`}>
                 <div className="text-yellow-100 font-black text-4xl uppercase tracking-widest drop-shadow-md">{tossPhase === 'flip' ? '' : coinFace}</div>
              </div>
            </div>

            {tossPhase === 'call' && (
                <div className="animate-fade-in">
                    <p className="text-slate-400 text-sm mb-6 bg-slate-800 inline-block px-6 py-2 rounded-full border border-slate-700">Opponent Captain <b className="text-white">{getCapName(team2, captain2)}</b> calls <b className="text-white uppercase">{oppCall}</b>!</p>
                    <div><button onClick={handleUserFlip} className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-12 py-4 rounded-lg text-sm uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]">Flip the Coin</button></div>
                </div>
            )}

            {tossPhase === 'userWin' && (
                <div className="animate-fade-in">
                    <p className="text-2xl font-black text-emerald-400 mb-2">You won the toss!</p>
                    <p className="text-slate-400 text-sm mb-8">You are deciding on behalf of <b className="text-white">{getCapName(team1, captain1)}</b>. What is your decision?</p>
                    <div className="flex gap-4 justify-center">
                        <button onClick={() => { setMatchDecision('Bat'); setTossPhase('result'); }} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold px-10 py-4 rounded text-sm uppercase tracking-widest transition-colors">We will Bat</button>
                        <button onClick={() => { setMatchDecision('Bowl'); setTossPhase('result'); }} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold px-10 py-4 rounded text-sm uppercase tracking-widest transition-colors">We will Bowl</button>
                    </div>
                </div>
            )}
            
            {tossPhase === 'oppWin' && (
                <div className="animate-fade-in">
                    <p className="text-2xl font-black text-cyan-400 mb-2">Opponent won the toss!</p>
                    <p className="text-slate-400 text-sm mb-8">Captain <b className="text-white">{getCapName(team2, captain2)}</b> has elected to <b className="text-white uppercase">{matchDecision}</b> first.</p>
                    <button onClick={() => setTossPhase('result')} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-12 py-4 rounded text-sm uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(6,182,212,0.2)]">Continue</button>
                </div>
            )}

            {tossPhase === 'result' && (
                <div className="animate-fade-in">
                    <div className="text-2xl font-black text-white mb-2">{tossWinnerTeam} won the toss</div>
                    <div className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-10">and elected to <span className="text-emerald-400">{matchDecision}</span> first.</div>
                    <button disabled={isStarting} onClick={startServerMatch} className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-12 py-5 rounded-lg w-full text-sm uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                      {isStarting ? "Loading Match Engine..." : "Start Match"}
                    </button>
                </div>
            )}
          </div>
        )}

        {/* --- 6. CRASH-PROOF LIVE MATCH SCREEN --- */}
        {appState === 'match' && (
          <>
            {/* LOADING GATE PREVENTS WHITE SCREEN CRASHES */}
            {!serverData ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto mt-10 shadow-2xl">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest">Loading Match...</h3>
                    <p className="text-xs text-slate-500 font-mono mt-2 uppercase">Preparing game data</p>
                </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in relative">
                
                {/* INNINGS BREAK OVERLAY */}
                {serverData?.status === "Innings Break" && (
                    <div className="absolute inset-0 bg-slate-950/90 z-50 flex items-center justify-center rounded-xl border border-emerald-500/30 backdrop-blur-sm">
                        <div className="text-center bg-slate-900 p-12 rounded-2xl shadow-2xl border border-slate-700 max-w-lg w-full">
                            <h2 className="text-3xl font-black text-emerald-500 mb-2 uppercase tracking-widest">Innings Break</h2>
                            <p className="text-slate-400 mb-8 font-bold">The first innings has concluded.</p>
                            <div className="bg-slate-950 p-8 rounded-xl mb-8 border border-slate-800 shadow-inner">
                                <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-bold">Target for {serverData?.batting_team_name}</p>
                                <p className="text-7xl font-black font-mono text-white tracking-tighter">{serverData?.target_score}</p>
                                <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-3 font-bold">From {serverData?.max_balls / 6} Overs</p>
                            </div>
                            
                            {/* PREVBALLS RESET HERE FIXES 2ND INNINGS AUDIO */}
                            <button onClick={() => { 
                                setCommentaryFeed([]); 
                                setPrevBalls(0);
                                fetch(`http://127.0.0.1:8000/matches/${serverId}/start-inn2`, { method: 'POST' }); 
                                setIsPlaying(true); 
                            }} className="bg-emerald-500 text-black px-12 py-5 font-black uppercase tracking-widest text-sm rounded-lg shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:bg-emerald-400 transition-all w-full">
                                Start 2nd Innings
                            </button>
                        </div>
                    </div>
                )}

                <div className="lg:col-span-2 space-y-6">
                  <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
                    
                    <div className="flex justify-between items-center border-b border-slate-800 bg-slate-950/50 p-4">
                      <h3 className="text-emerald-500 font-bold tracking-widest text-[10px] uppercase flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-amber-500'}`}></div> 
                          {isPlaying ? 'Live Match Active' : 'Match Paused'}
                      </h3>
                      
                      <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 bg-slate-900 rounded-lg border border-slate-700 p-1">
                              <button onClick={() => setIsPlaying(!isPlaying)} className="flex items-center justify-center px-3 py-1.5 rounded text-[10px] font-black tracking-widest bg-slate-950 hover:bg-slate-800 transition-colors">
                                  {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
                              </button>
                              <button onClick={handleFastForward} className="flex items-center justify-center px-3 py-1.5 rounded text-[10px] font-black tracking-widest bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors">
                                  ⏩ SKIP INNINGS
                              </button>
                              <button onClick={() => setIsAudioEnabled(!isAudioEnabled)} className={`flex items-center justify-center px-3 py-1.5 rounded text-[10px] font-black tracking-widest transition-colors ${isAudioEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-white'}`}>
                                  {isAudioEnabled ? '🔊 AUDIO ON' : '🔇 AUDIO OFF'}
                              </button>
                          </div>
                          <select value={selectedLang} onChange={(e) => changeLanguage(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-widest rounded-lg p-2 outline-none cursor-pointer focus:border-emerald-500 transition-colors">
                              <option value="English">ENG Audio</option>
                              <option value="Hindi">HIN Audio</option>
                              <option value="Punjabi">PUN Audio</option>
                          </select>
                      </div>
                    </div>
                    
                    <div className="p-6">
                        <div className="flex justify-between items-end mb-8 bg-slate-950 p-6 border border-slate-800 rounded-xl shadow-inner">
                          <div>
                            <h3 className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-2">{serverData?.batting_team_name} Batting</h3>
                            <div className="text-6xl font-black tracking-tighter font-mono leading-none text-white">{activeScore}<span className="text-4xl text-slate-600">/{activeWickets}</span></div>
                            {serverData?.innings === 2 && (
                                <div className="text-[10px] bg-amber-500/10 text-amber-500 px-3 py-1 rounded border border-amber-500/20 font-bold uppercase tracking-widest mt-3 inline-block">Target: {serverData?.target_score}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <h3 className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-2">Overs</h3>
                            <div className="text-4xl font-black text-emerald-400 font-mono leading-none">{overs}.{legalBalls}</div>
                            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-3 bg-slate-900 px-2 py-1 rounded inline-block">Max {serverData?.format === 'T10' ? 10 : 20}</div>
                          </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-xl mb-6 overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-900 border-b border-slate-800 text-[9px] uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="p-3 pl-5">Batter</th>
                                        <th className="p-3 text-right">R</th>
                                        <th className="p-3 text-right">B</th>
                                        <th className="p-3 text-right">4s</th>
                                        <th className="p-3 text-right">6s</th>
                                        <th className="p-3 text-right pr-5">SR</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono text-xs">
                                    <tr className="bg-slate-900/30">
                                        <td className="p-3 pl-5 font-bold text-white font-sans">{strikerData?.name || "Waiting..."} <span className="text-emerald-500 text-lg leading-none align-middle">*</span></td>
                                        <td className="p-3 text-right font-black text-white text-sm">{strikerData?.runs || 0}</td>
                                        <td className="p-3 text-right text-slate-400">{strikerData?.balls || 0}</td>
                                        <td className="p-3 text-right text-slate-400">{strikerData?.fours || 0}</td>
                                        <td className="p-3 text-right text-slate-400">{strikerData?.sixes || 0}</td>
                                        <td className="p-3 text-right text-slate-500 pr-5">{(strikerData?.balls || 0) > 0 ? ((strikerData.runs/strikerData.balls)*100).toFixed(1) : '-'}</td>
                                    </tr>
                                    {nonStrikerData && (
                                    <tr>
                                        <td className="p-3 pl-5 font-bold text-slate-400 font-sans">{nonStrikerData.name}</td>
                                        <td className="p-3 text-right font-bold text-slate-300">{nonStrikerData.runs || 0}</td>
                                        <td className="p-3 text-right text-slate-500">{nonStrikerData.balls || 0}</td>
                                        <td className="p-3 text-right text-slate-500">{nonStrikerData.fours || 0}</td>
                                        <td className="p-3 text-right text-slate-500">{nonStrikerData.sixes || 0}</td>
                                        <td className="p-3 text-right text-slate-600 pr-5">{(nonStrikerData.balls || 0) > 0 ? ((nonStrikerData.runs/nonStrikerData.balls)*100).toFixed(1) : '-'}</td>
                                    </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-900 border-b border-slate-800 text-[9px] uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="p-3 pl-5">Bowler</th>
                                        <th className="p-3 text-right">O</th>
                                        <th className="p-3 text-right">R</th>
                                        <th className="p-3 text-right">W</th>
                                        <th className="p-3 text-right pr-5">Econ</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono text-xs">
                                    <tr>
                                        <td className="p-3 pl-5 font-bold text-white font-sans">{bowlerData?.name || "Waiting..."} <span className="text-cyan-500 text-lg leading-none align-middle">*</span></td>
                                        <td className="p-3 text-right font-bold text-white">{bOvers}.{bRem}</td>
                                        <td className="p-3 text-right text-slate-400">{bowlerData?.runs_conceded || 0}</td>
                                        <td className="p-3 text-right text-cyan-400 font-black text-sm">{bowlerData?.wickets || 0}</td>
                                        <td className="p-3 text-right text-slate-500 pr-5">{(bowlerData?.balls_bowled || 0) > 0 ? ((bowlerData.runs_conceded/bowlerData.balls_bowled)*6).toFixed(1) : '-'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-xl relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-4">
                      <h3 className="text-slate-500 font-bold uppercase tracking-widest text-[10px] whitespace-nowrap">This Over</h3>
                      <div className="flex-1 h-px bg-slate-800"></div>
                    </div>
                    <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-2">
                      {thisOver.length === 0 && <span className="text-xs text-slate-600 font-mono italic">Awaiting delivery...</span>}
                      {thisOver.map((ball, idx) => (
                        <div key={`ball-${idx}`} className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black text-sm font-mono border shadow-sm ${ball === 'W' ? 'bg-red-500/20 text-red-500 border-red-500/50' : ball === 'Wd' || ball === 'Nb' ? 'bg-amber-500/20 text-amber-500 border-amber-500/50' : ball === 6 || ball === 4 ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50' : 'bg-slate-950 text-slate-300 border-slate-700'}`}>{ball}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col h-[650px] shadow-2xl">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-5 pb-4 border-b border-slate-800 flex justify-between items-center">
                      Live Play-by-Play 
                      <span className={`text-[9px] px-2 py-1 rounded border ${isAudioEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-950 text-slate-600 border-slate-800'}`}>
                          Audio: {isAudioEnabled ? 'ON' : 'OFF'}
                      </span>
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar">
                    {commentaryFeed.length === 0 && <p className="text-slate-600 text-center mt-10 text-xs font-mono italic">Match is starting...</p>}
                    {commentaryFeed.map((comm, idx) => (
                      <div key={`comm-${idx}`} className="animate-fade-in flex gap-4 border-b border-slate-800/50 pb-4">
                        <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm font-mono border shadow-sm ${comm.type === 'wicket' ? 'bg-red-500/10 text-red-500 border-red-500/30' : comm.type === 'boundary' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                            {comm.runs !== undefined ? comm.runs : '...'}
                        </div>
                        <div className="text-sm text-slate-300 flex-1 leading-relaxed">
                          <span className="font-mono text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Ov {Math.floor((comm.ball-1)/6)}.{(comm.ball-1)%6 + 1}</span>
                          {comm.text}
                        </div>
                      </div>
                    ))}
                    <div ref={commentaryEndRef} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* --- 7. POST MATCH SCORECARD --- */}
        {appState === 'scorecard' && viewingScorecard && (
          <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 p-10 rounded-2xl shadow-2xl mt-10 animate-fade-in">
             <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-6">
                 <h2 className="text-2xl font-black uppercase tracking-widest text-white">Match Result</h2>
                 <button onClick={() => setAppState('dashboard')} className="text-emerald-500 text-xs font-bold uppercase tracking-widest hover:underline bg-emerald-500/10 px-4 py-2 rounded transition-colors">← Dashboard</button>
             </div>

             <div className="text-center mb-10 bg-slate-950 p-8 rounded-xl border border-slate-800 shadow-inner">
                 <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-3">Final Outcome ({viewingScorecard?.format})</p>
                 <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 uppercase tracking-tight">{getWinnerText()}</h2>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center shadow-sm">
                   <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2">{viewingScorecard?.bowling_team_name} (1st Inn)</h3>
                   <div className="text-5xl font-mono font-black text-white">{viewingScorecard?.inn1_score}<span className="text-3xl text-slate-600">/{viewingScorecard?.inn1_wickets}</span></div>
                   <div className="text-xs font-mono font-bold text-slate-500 mt-3 bg-slate-900 inline-block px-3 py-1 rounded">{Math.floor((viewingScorecard?.inn1_balls || 0)/6)}.{(viewingScorecard?.inn1_balls || 0)%6} Overs</div>
                </div>
                <div className="bg-slate-950 p-6 rounded-xl border border-emerald-500/30 text-center relative overflow-hidden shadow-sm">
                   <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                   <h3 className="text-[10px] uppercase font-bold text-emerald-500 tracking-widest mb-2">{viewingScorecard?.batting_team_name} (2nd Inn)</h3>
                   <div className="text-5xl font-mono font-black text-white">{viewingScorecard?.score}<span className="text-3xl text-slate-600">/{viewingScorecard?.wickets}</span></div>
                   <div className="text-xs font-mono font-bold text-slate-500 mt-3 bg-slate-900 inline-block px-3 py-1 rounded">{Math.floor((viewingScorecard?.balls || 0)/6)}.{(viewingScorecard?.balls || 0)%6} Overs</div>
                </div>
             </div>

             {/* SAFE SHOWCASE PERFORMERS: MVP CALCULATION */}
             {matchMVP && (
                 <div className="bg-gradient-to-r from-slate-950 to-slate-900 border border-amber-500/20 p-6 rounded-xl mb-10 shadow-md flex justify-between items-center">
                     <div>
                         <p className="text-[10px] uppercase font-bold text-amber-500 tracking-widest mb-1">🌟 Player of the Match</p>
                         <h3 className="text-2xl font-black text-white">{matchMVP.name}</h3>
                     </div>
                     <div className="text-right font-mono">
                         <span className="text-xl font-black text-amber-400 block">{matchMVP.runs} Runs</span>
                         {matchMVP.wkts > 0 && <span className="text-sm text-slate-400 font-bold block">{matchMVP.wkts} Wickets</span>}
                     </div>
                 </div>
             )}

             <h3 className="font-black text-emerald-500 uppercase tracking-widest mb-3 text-sm">{viewingScorecard?.batting_team_name} Innings</h3>
             <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden mb-10 shadow-sm">
                 <table className="w-full text-left text-sm">
                     <thead className="bg-slate-900 border-b border-slate-800 text-[9px] uppercase tracking-widest text-slate-500">
                         <tr>
                             <th className="p-4 pl-6">Batter</th>
                             <th className="p-4">Status</th>
                             <th className="p-4 text-right">R</th>
                             <th className="p-4 text-right">B</th>
                             <th className="p-4 text-right">4s</th>
                             <th className="p-4 text-right">6s</th>
                             <th className="p-4 text-right pr-6">SR</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
                         {(Array.isArray(viewingScorecard?.batting_team) ? viewingScorecard.batting_team : []).map(p => {
                             if (!p) return null;
                             return (
                                 <tr key={`bat-${p.id}`} className="hover:bg-slate-900/50 transition-colors">
                                     <td className="p-4 pl-6 font-bold text-white font-sans">{p.name} {p.isCaptain && <span className="text-emerald-500 text-[9px] bg-emerald-500/10 px-1 rounded ml-1 border border-emerald-500/20">C</span>}</td>
                                     <td className="p-4 text-slate-400 text-[10px] uppercase tracking-wider">{p.status}</td>
                                     <td className="p-4 text-right font-black text-emerald-400 text-sm">{p.runs}</td>
                                     <td className="p-4 text-right text-slate-400">{p.balls}</td>
                                     <td className="p-4 text-right text-slate-500">{p.fours}</td>
                                     <td className="p-4 text-right text-slate-500">{p.sixes}</td>
                                     <td className="p-4 text-right text-slate-600 pr-6 font-bold">{p.balls > 0 ? ((p.runs/p.balls)*100).toFixed(1) : '-'}</td>
                                 </tr>
                             );
                         })}
                     </tbody>
                 </table>
             </div>
             
             <h3 className="font-black text-cyan-500 uppercase tracking-widest mb-3 text-sm">{viewingScorecard?.bowling_team_name} Innings</h3>
             <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden mb-10 shadow-sm">
                 <table className="w-full text-left text-sm">
                     <thead className="bg-slate-900 border-b border-slate-800 text-[9px] uppercase tracking-widest text-slate-500">
                         <tr>
                             <th className="p-4 pl-6">Bowler</th>
                             <th className="p-4 text-right">O</th>
                             <th className="p-4 text-right">M</th>
                             <th className="p-4 text-right">R</th>
                             <th className="p-4 text-right">W</th>
                             <th className="p-4 text-right pr-6">Econ</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
                         {(Array.isArray(viewingScorecard?.bowling_team) ? viewingScorecard.bowling_team : []).filter(p => p && p.balls_bowled > 0).map(p => {
                             const o = Math.floor(p.balls_bowled/6); 
                             const r = p.balls_bowled%6;
                             return (
                                 <tr key={`bowl-${p.id}`} className="hover:bg-slate-900/50 transition-colors">
                                     <td className="p-4 pl-6 font-bold text-white font-sans">{p.name} {p.isCaptain && <span className="text-cyan-500 text-[9px] bg-cyan-500/10 px-1 rounded ml-1 border border-cyan-500/20">C</span>}</td>
                                     <td className="p-4 text-right text-slate-300 font-bold">{o}.{r}</td>
                                     <td className="p-4 text-right text-slate-600">0</td>
                                     <td className="p-4 text-right text-slate-400">{p.runs_conceded}</td>
                                     <td className="p-4 text-right font-black text-cyan-400 text-sm">{p.wickets}</td>
                                     <td className="p-4 text-right text-slate-500 pr-6 font-bold">{p.balls_bowled > 0 ? ((p.runs_conceded / p.balls_bowled) * 6).toFixed(1) : '-'}</td>
                                 </tr>
                             );
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
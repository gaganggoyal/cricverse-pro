import React, { useState, useEffect, useRef } from 'react';

// --- CONFIGURATION ---
const GEMINI_API_KEY = "api_keygit push -u origin main"; // Put your Gemini API key here

// --- PLAYER DATABASE ---
const PLAYER_DATABASE = [
  { id: 1, name: 'Virat Kohli', role: 'Batter', style: 'RHB' },
  { id: 2, name: 'Rohit Sharma', role: 'Batter', style: 'RHB' },
  { id: 3, name: 'Jasprit Bumrah', role: 'Bowler', style: 'RAF' },
  { id: 4, name: 'MS Dhoni', role: 'Wicketkeeper', style: 'RHB' },
  { id: 5, name: 'Pat Cummins', role: 'Bowler', style: 'RAF' },
  { id: 6, name: 'Steve Smith', role: 'Batter', style: 'RHB' },
  { id: 7, name: 'Mitchell Starc', role: 'Bowler', style: 'LAF' },
  { id: 8, name: 'Glenn Maxwell', role: 'All-rounder', style: 'RHB' },
  { id: 9, name: 'Babar Azam', role: 'Batter', style: 'RHB' },
  { id: 10, name: 'Shaheen Afridi', role: 'Bowler', style: 'LAF' },
  { id: 11, name: 'Ben Stokes', role: 'All-rounder', style: 'LHB' },
  { id: 12, name: 'Jos Buttler', role: 'Wicketkeeper', style: 'RHB' },
  { id: 13, name: 'Rashid Khan', role: 'Bowler', style: 'Leg Spin' },
  { id: 14, name: 'Kane Williamson', role: 'Batter', style: 'RHB' },
  { id: 15, name: 'Trent Boult', role: 'Bowler', style: 'LAF' },
  { id: 16, name: 'Kagiso Rabada', role: 'Bowler', style: 'RAF' },
  { id: 17, name: 'Quinton de Kock', role: 'Wicketkeeper', style: 'LHB' },
  { id: 18, name: 'Hardik Pandya', role: 'All-rounder', style: 'RHB' },
  { id: 19, name: 'Ravindra Jadeja', role: 'All-rounder', style: 'LHB' },
  { id: 20, name: 'David Warner', role: 'Batter', style: 'LHB' },
  { id: 21, name: 'Suryakumar Yadav', role: 'Batter', style: 'RHB' },
  { id: 22, name: 'Shakib Al Hasan', role: 'All-rounder', style: 'LHB' },
  { id: 23, name: 'Sunil Narine', role: 'All-rounder', style: 'Off Spin' },
  { id: 24, name: 'Jofra Archer', role: 'Bowler', style: 'RAF' }
];

export default function App() {
  // --- APP STATE ---
  const [appStage, setAppStage] = useState('DRAFT'); // DRAFT, CONFIG, SIMULATION, POST_MATCH

  // --- DRAFT STATE ---
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [currentPick, setCurrentPick] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // --- CONFIG STATE ---
  const [matchFormat, setMatchFormat] = useState('T20');
  const [stadium, setStadium] = useState('Lords');
  const [pitch, setPitch] = useState('Green');
  const [time, setTime] = useState('Day');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- MATCH STATE ---
  const [runs, setRuns] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [balls, setBalls] = useState(0);
  const [commentary, setCommentary] = useState([]);
  const commentaryEndRef = useRef(null);

  // Auto-scroll commentary
  useEffect(() => {
    commentaryEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commentary]);

  // --- DRAFT LOGIC ---
  const filteredPlayers = PLAYER_DATABASE.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !team1.find(t => t.id === p.id) &&
    !team2.find(t => t.id === p.id)
  );

  const draftPlayer = (player) => {
    if (currentPick === 1 && team1.length < 11) {
      setTeam1([...team1, player]);
      setCurrentPick(2);
    } else if (currentPick === 2 && team2.length < 11) {
      setTeam2([...team2, player]);
      setCurrentPick(1);
    }
  };

  const finalizeDraft = () => {
    if (team1.length === 11 && team2.length === 11) {
      setAppStage('CONFIG');
    } else {
      alert("Both teams must have exactly 11 players!");
    }
  };

  // --- GEMINI AI INTEGRATION ---
  const getGeminiResponse = async (prompt) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_API_KEY_HERE") {
      return "AI offline: Please add your Gemini API Key to App.jsx to enable expert analysis.";
    }
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Commentary box experiencing technical difficulties.";
    }
  };

  const fetchPreMatchAnalysis = async () => {
    setIsAnalyzing(true);
    const prompt = `Act as an expert cricket commentator. Analyze a ${matchFormat} match at ${stadium} on a ${pitch} pitch during the ${time}. Keep it exciting and under 3 sentences.`;
    const analysis = await getGeminiResponse(prompt);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  // --- SIMULATION LOGIC ---
  const simulateBall = async () => {
    const maxBalls = matchFormat === 'T10' ? 60 : matchFormat === 'T20' ? 120 : 300;
    if (balls >= maxBalls || wickets >= 10) {
      setAppStage('POST_MATCH');
      return;
    }

    const outcomes = [0, 1, 2, 3, 4, 6, 'W'];
    const result = outcomes[Math.floor(Math.random() * outcomes.length)];
    
    let newRuns = runs;
    let newWickets = wickets;
    let eventStyle = 'text-gray-300';
    let textResult = result;

    if (result === 'W') {
      newWickets += 1;
      eventStyle = 'text-red-500 font-bold animate-pulse'; // Wicket Explosion effect
      textResult = 'OUT!';
    } else {
      newRuns += result;
      if (result === 4 || result === 6) {
        eventStyle = 'text-green-400 font-bold'; // Boundary effect
      }
    }

    setRuns(newRuns);
    setWickets(newWickets);
    setBalls(balls + 1);

    const overNum = Math.floor(balls / 6);
    const ballNum = (balls % 6) + 1;
    const overString = `${overNum}.${ballNum}`;

    const newCommentary = {
      over: overString,
      event: textResult,
      style: eventStyle,
      desc: `Ball bowled... ${result === 'W' ? 'It is a wicket!' : `Batsman scores ${result} runs.`}`
    };

    setCommentary(prev => [...prev, newCommentary]);

    // AI Commentary every over (every 6 balls)
    if (ballNum === 6) {
      const prompt = `Act as an exciting cricket commentator. The score is ${newRuns}/${newWickets} after ${overNum + 1} overs. Give a 1-sentence reaction to the match situation.`;
      const aiComment = await getGeminiResponse(prompt);
      setCommentary(prev => [...prev, { over: 'AI', event: '🎙️', style: 'text-blue-400', desc: aiComment }]);
    }
  };

  // --- UI RENDERERS ---
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-blue-500">
      
      {/* HEADER */}
      <header className="bg-slate-800 p-4 border-b border-slate-700 text-center shadow-lg">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 uppercase tracking-widest">
          Cricverse Pro V3
        </h1>
      </header>

      <main className="max-w-6xl mx-auto p-4 mt-6">
        
        {/* --- STAGE 1: DRAFT --- */}
        {appStage === 'DRAFT' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Live Player Draft</h2>
              <p className="text-gray-400">Team {currentPick} is currently on the clock.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* TEAM 1 */}
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-blue-400">Team 1 ({team1.length}/11)</h3>
                <ul className="space-y-2">
                  {team1.map(p => <li key={p.id} className="bg-slate-700 p-2 rounded text-sm">{p.name} ({p.role})</li>)}
                </ul>
              </div>

              {/* DRAFT POOL */}
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col">
                <input 
                  type="text" 
                  placeholder="Search players..." 
                  className="w-full p-2 mb-4 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex-1 overflow-y-auto max-h-96 space-y-2">
                  {filteredPlayers.map(p => (
                    <div key={p.id} onClick={() => draftPlayer(p)} 
                         className="p-3 bg-slate-700 hover:bg-blue-600 cursor-pointer rounded transition-colors flex justify-between items-center">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs text-gray-300">{p.role}</span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={finalizeDraft}
                  disabled={team1.length < 11 || team2.length < 11}
                  className="mt-4 w-full p-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold transition-all shadow-lg"
                >
                  Proceed to Match Config
                </button>
              </div>

              {/* TEAM 2 */}
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-emerald-400">Team 2 ({team2.length}/11)</h3>
                <ul className="space-y-2">
                  {team2.map(p => <li key={p.id} className="bg-slate-700 p-2 rounded text-sm">{p.name} ({p.role})</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* --- STAGE 2: MATCH CONFIGURATOR --- */}
        {appStage === 'CONFIG' && (
          <div className="max-w-2xl mx-auto bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-center">Match Conditions</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Format</label>
                <select value={matchFormat} onChange={e => setMatchFormat(e.target.value)} className="w-full p-2 bg-slate-900 border border-slate-600 rounded">
                  <option>T10</option><option>T20</option><option>ODI</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Stadium</label>
                <select value={stadium} onChange={e => setStadium(e.target.value)} className="w-full p-2 bg-slate-900 border border-slate-600 rounded">
                  <option>Lords, ENG</option><option>MCG, AUS</option><option>Eden Gardens, IND</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Pitch Type</label>
                <select value={pitch} onChange={e => setPitch(e.target.value)} className="w-full p-2 bg-slate-900 border border-slate-600 rounded">
                  <option>Flat (Batting)</option><option>Green (Seam)</option><option>Dusty (Spin)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Time of Day</label>
                <select value={time} onChange={e => setTime(e.target.value)} className="w-full p-2 bg-slate-900 border border-slate-600 rounded">
                  <option>Day</option><option>Day/Night</option><option>Night</option>
                </select>
              </div>
            </div>

            <button onClick={fetchPreMatchAnalysis} disabled={isAnalyzing} className="w-full mb-4 p-2 border border-blue-500 text-blue-400 hover:bg-blue-900 rounded transition-colors">
              {isAnalyzing ? 'Consulting Gemini AI...' : '🎙️ Get AI Pitch Report'}
            </button>
            
            {aiAnalysis && (
              <div className="p-4 bg-slate-900 border-l-4 border-blue-500 rounded text-sm italic mb-6">
                "{aiAnalysis}"
              </div>
            )}

            <button onClick={() => setAppStage('SIMULATION')} className="w-full p-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg shadow-lg">
              ENTER LIVE MATCH
            </button>
          </div>
        )}

        {/* --- STAGE 3: LIVE SIMULATION --- */}
        {appStage === 'SIMULATION' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* BROADCAST SCOREBOARD */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-emerald-500"></div>
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-xl text-gray-400 font-semibold uppercase tracking-wider">Team 1</h3>
                    <p className="text-7xl font-black">{runs}<span className="text-4xl text-gray-400">/{wickets}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl text-gray-400 uppercase tracking-wider mb-2">Overs</p>
                    <p className="text-5xl font-bold font-mono text-blue-400">
                      {Math.floor(balls / 6)}.{balls % 6}
                    </p>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button onClick={simulateBall} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 p-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95">
                    BOWL NEXT BALL
                  </button>
                </div>
              </div>

              {/* ACTIVE PLAYERS BOX */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <h4 className="text-sm text-gray-400 uppercase mb-2">Batting</h4>
                  <p className="text-lg font-bold">🏏 {team1[0]?.name}</p>
                  <p className="text-lg font-bold text-gray-400">🏏 {team1[1]?.name}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <h4 className="text-sm text-gray-400 uppercase mb-2">Bowling</h4>
                  <p className="text-lg font-bold">🔴 {team2[team2.length - 1]?.name}</p>
                </div>
              </div>
            </div>

            {/* LIVE COMMENTARY FEED */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl flex flex-col h-[500px]">
              <div className="p-4 border-b border-slate-700 bg-slate-900/50 rounded-t-xl">
                <h3 className="font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  Live Commentary
                </h3>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-sm">
                {commentary.map((c, idx) => (
                  <div key={idx} className="flex gap-3 pb-3 border-b border-slate-700/50 last:border-0">
                    <span className="text-blue-400 font-bold min-w-[35px]">{c.over}</span>
                    <div>
                      <span className={`font-bold mr-2 ${c.style}`}>{c.event}</span>
                      <span className="text-gray-300">{c.desc}</span>
                    </div>
                  </div>
                ))}
                <div ref={commentaryEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* --- STAGE 4: POST MATCH --- */}
        {appStage === 'POST_MATCH' && (
          <div className="max-w-3xl mx-auto bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center">
            <h2 className="text-4xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              INNINGS BREAK
            </h2>
            <div className="bg-slate-900 p-6 rounded-xl inline-block mb-8 border border-slate-700">
              <p className="text-gray-400 uppercase tracking-widest mb-2">Final Score</p>
              <p className="text-6xl font-bold">{runs}/{wickets}</p>
              <p className="text-xl text-blue-400 mt-2">{Math.floor(balls / 6)}.{balls % 6} Overs</p>
            </div>
            <p className="text-xl mb-8">Team 2 needs <span className="font-bold text-emerald-400">{runs + 1} runs</span> to win!</p>
            
            <button onClick={() => window.location.reload()} className="p-4 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-colors">
              Start New Match (Reset)
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
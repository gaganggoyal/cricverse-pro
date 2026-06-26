import { useState, useEffect } from 'react';

export default function LiveMatch() {
  const [score, setScore] = useState(0);
  const [matchId, setMatchId] = useState(null);
  const [status, setStatus] = useState("Awaiting command...");

  // The function to trigger your Python backend
  const startServerMatch = async () => {
    try {
      setStatus("Creating match in database...");
      
      // 1. Create the match
      const createRes = await fetch('http://127.0.0.1:8000/matches/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 1, stadium: "React Arena", format: "T20" })
      });
      const matchData = await createRes.json();
      const newMatchId = matchData.id;

      // 2. Start the background simulation
      setStatus("Starting background simulation...");
      await fetch(`http://127.0.0.1:8000/matches/${newMatchId}/start`, {
        method: 'POST'
      });

      // 3. Set the ID to trigger the live polling
      setMatchId(newMatchId);
      setStatus("LIVE IN BACKGROUND");
    } catch (err) {
      console.error("Server Error:", err);
      setStatus("Error: Is the Python server running?");
    }
  };

  // The Live Data Heartbeat
  useEffect(() => {
    if (!matchId) return; // Do not poll until a match is actually started

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/matches/${matchId}/score`);
        const data = await res.json();
        setScore(data.total_runs);
      } catch (err) {
        console.log("Waiting for server...");
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [matchId]);

  // The UI
  return (
    <div className="flex items-center gap-4">
      {!matchId ? (
        <button 
          onClick={startServerMatch}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-1 rounded-full font-black tracking-widest text-sm transition-all shadow-[0_0_10px_rgba(16,185,129,0.5)]"
        >
          ▶ START SERVER MATCH
        </button>
      ) : (
        <div className="flex gap-4 items-center">
           <span className="text-white bg-slate-800 px-3 py-1 rounded-lg">Match ID: <span className="text-cyan-400">{matchId}</span></span>
           <span className="text-white bg-slate-800 px-3 py-1 rounded-lg">Server Runs: <span className="text-emerald-400 text-xl">{score}</span></span>
        </div>
      )}
      <span className="text-slate-500 text-xs ml-2 italic">{status}</span>
    </div>
  );
}
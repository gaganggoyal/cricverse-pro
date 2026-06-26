import { useState, useEffect } from 'react';

export default function LiveMatch() {
  const [score, setScore] = useState(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/matches/1/score');
        const data = await res.json();
        setScore(data.total_runs);
      } catch (err) {
        console.log("Waiting for server...");
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return <h1>Live Score: {score}</h1>;
}
import { useState } from 'react'

function App() {
  const [matchFormat, setMatchFormat] = useState('T20')
  const [pitchCondition, setPitchCondition] = useState('Dry')

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header */}
      <header className="bg-slate-950 border-b border-emerald-500/30 shadow-lg shadow-emerald-500/10 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            Cricverse <span className="text-white">Pro</span>
          </h1>
          <div className="text-sm font-semibold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
            v2.0 Engine Active
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto p-6 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Match Configuration Card */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center text-slate-100">
              <span className="text-emerald-400 mr-2">⚙️</span> Match Configuration
            </h2>
            
            {/* Format Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-2">Format</label>
              <div className="flex gap-2">
                {['T10', 'T20', 'ODI'].map((format) => (
                  <button
                    key={format}
                    onClick={() => setMatchFormat(format)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                      matchFormat === format 
                        ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>

            {/* Pitch Selection */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-slate-400 mb-2">Pitch Conditions</label>
              <div className="flex gap-2">
                {['Green', 'Dry', 'Dusty'].map((pitch) => (
                  <button
                    key={pitch}
                    onClick={() => setPitchCondition(pitch)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                      pitchCondition === pitch 
                        ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {pitch}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <button className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-lg py-4 rounded-xl shadow-lg transition-transform active:scale-95">
              PROCEED TO DRAFT ➔
            </button>
          </div>

          {/* AI Insights Card (Preview) */}
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 border-dashed flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-2xl mb-4 shadow-inner">
              🤖
            </div>
            <h3 className="text-lg font-bold text-slate-200 mb-2">Gemini AI Engine Ready</h3>
            <p className="text-slate-400 text-sm max-w-xs">
              Once you finalize your match settings, the AI will generate a pre-match pitch report based on your {pitchCondition} selection.
            </p>
          </div>

        </div>
      </main>
    </div>
  )
}

export default App
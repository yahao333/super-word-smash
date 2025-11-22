import React, { useState, useEffect } from 'react';
import { Play } from 'lucide-react';

const TutorialDemo: React.FC = () => {
  const [step, setStep] = useState(0);
  // Steps:
  // 0: Word falling
  // 1: Typing 'h'
  // 2: Typing 'e'
  // 3: Typing 'l'
  // 4: Typing 'l'
  // 5: Typing 'o'
  // 6: Press Enter (Highlight)
  // 7: Explosion / Success
  // 8: Reset

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % 10); // 10 steps total cycle
    }, 600); // Speed of the demo
    return () => clearInterval(interval);
  }, []);

  const wordY = step < 7 ? 20 + step * 5 : 20; // Word falls down a bit
  const typedText = 
    step >= 5 ? "hello" :
    step >= 4 ? "hell" :
    step >= 3 ? "hel" :
    step >= 2 ? "he" :
    step >= 1 ? "h" : "";

  const showExplosion = step === 7 || step === 8;
  const showWord = step < 7;

  return (
    <div className="relative w-64 h-40 bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden flex flex-col items-center justify-end p-4 select-none pointer-events-none">
      
      {/* Falling Word */}
      {showWord && (
        <div 
          className="absolute bg-white/90 text-slate-900 px-3 py-1 rounded-full font-bold text-sm shadow-lg border border-blue-400 transition-all duration-500 ease-linear"
          style={{ top: `${wordY}%` }}
        >
          hello
        </div>
      )}

      {/* Explosion Effect */}
      {showExplosion && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
           <div className="w-12 h-12 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
           <div className="absolute inset-0 w-12 h-12 bg-orange-500 rounded-full animate-pulse opacity-50"></div>
        </div>
      )}

      {/* Input Simulation */}
      <div className="w-full flex items-center gap-2">
        <div className="flex-1 h-10 bg-slate-800 rounded-lg border border-slate-600 flex items-center justify-center text-white font-mono text-lg shadow-inner">
          {typedText}
          <span className="w-0.5 h-5 bg-blue-400 animate-pulse ml-0.5"></span>
        </div>
        
        {/* Enter Key */}
        <div className={`h-10 px-3 rounded-lg border flex items-center justify-center font-bold text-xs transition-colors duration-200
          ${step === 6 || step === 7 
            ? 'bg-blue-500 border-blue-400 text-white scale-95' 
            : 'bg-slate-700 border-slate-600 text-slate-400'
          }`}>
          ENTER
        </div>
      </div>

      {/* Hand/Cursor Hint (Optional, maybe later) */}
    </div>
  );
};

export default TutorialDemo;

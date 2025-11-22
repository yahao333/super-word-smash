import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Trophy, Heart, Zap, Crosshair, Rocket, Disc } from 'lucide-react';
import { WORD_LIST, COLORS } from './data/vocabulary';
import { GameState, WordEntity, Particle, WeaponType, Projectile } from './types';
import { audioService } from './services/audioService';
import TutorialDemo from './components/TutorialDemo';

// --- Constants ---
const SPAWN_PADDING = 10; // Percentage padding from sides
const BASE_SPEED = 0.08; // Movement per frame (approx)
const SPAWN_RATE_INITIAL = 2000; // ms
const MIN_SPAWN_RATE = 600;
const GAME_WIDTH = 100; // Percent
const GAME_HEIGHT = 100; // Percent
const SCORE_TO_LEVEL_UP = 100;

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState(false);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>(WeaponType.LASER);

  // We use Refs for the game loop to avoid closure staleness and frequent re-renders of the whole tree
  // Only strict UI data (score, level) goes to State for rendering
  const activeWordsRef = useRef<WordEntity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const lastSpawnTimeRef = useRef<number>(0);
  const frameIdRef = useRef<number>(0);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display state for rendering the words
  // We update this less frequently or use it for the react render cycle
  const [renderTrigger, setRenderTrigger] = useState(0);

  // --- Game Logic Helpers ---

  const spawnWord = useCallback(() => {
    const text = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    const x = Math.random() * (100 - SPAWN_PADDING * 2) + SPAWN_PADDING; // 10% to 90%

    const newWord: WordEntity = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      x,
      y: -10, // Start slightly above screen
      speed: BASE_SPEED + (level * 0.015), // Speed increases with level
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    };

    activeWordsRef.current.push(newWord);
  }, [level]);

  const createExplosion = (x: number, y: number, color: string) => {
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = Math.random() * 0.5 + 0.2;
      particlesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color,
        size: Math.random() * 1.5 + 0.5 // rem size
      });
    }
  };

  // --- Main Game Loop ---
  const gameLoop = useCallback((timestamp: number) => {
    if (gameState !== GameState.PLAYING) return;

    // 1. Spawning
    const currentSpawnRate = Math.max(MIN_SPAWN_RATE, SPAWN_RATE_INITIAL - (level * 150));
    if (timestamp - lastSpawnTimeRef.current > currentSpawnRate) {
      spawnWord();
      lastSpawnTimeRef.current = timestamp;
    }

    // 2. Update Words
    const wordsToRemove: string[] = [];
    activeWordsRef.current.forEach(word => {
      word.y += word.speed;

      // Check if hit bottom
      if (word.y > 100) {
        wordsToRemove.push(word.id);
        setLives(prev => {
          const newLives = prev - 1;
          if (newLives <= 0) {
            endGame();
          } else {
            audioService.playError();
          }
          return newLives;
        });
      }
    });

    // Cleanup fallen words
    if (wordsToRemove.length > 0) {
      activeWordsRef.current = activeWordsRef.current.filter(w => !wordsToRemove.includes(w.id));
    }

    // 3. Update Particles
    const particlesToRemove: string[] = [];
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02; // Fade out speed
      if (p.life <= 0) particlesToRemove.push(p.id);
    });
    particlesRef.current = particlesRef.current.filter(p => !particlesToRemove.includes(p.id));

    // 4. Update Projectiles
    const projectilesToRemove: string[] = [];
    projectilesRef.current.forEach(proj => {
      const target = activeWordsRef.current.find(w => w.id === proj.targetId);
      if (target) {
        // Move towards target
        const dx = target.x - proj.x;
        const dy = target.y - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) { // Hit threshold
          projectilesToRemove.push(proj.id);
          // Destroy word
          createExplosion(target.x, target.y, target.color);
          activeWordsRef.current = activeWordsRef.current.filter(w => w.id !== target.id);
          audioService.playSuccess();

          // Score & Level
          const newScore = score + 10;
          setScore(newScore);
          if (Math.floor(newScore / SCORE_TO_LEVEL_UP) > Math.floor(score / SCORE_TO_LEVEL_UP)) {
            setLevel(prev => prev + 1);
            audioService.playLevelUp();
          }
        } else {
          // Normalize and move
          const speed = proj.speed;
          proj.x += (dx / dist) * speed;
          proj.y += (dy / dist) * speed;

          // Update angle (degrees)
          // atan2(y, x) where y is down positive. 
          // 0 is Right, 90 is Down, -90 is Up.
          proj.angle = Math.atan2(dy, dx) * (180 / Math.PI);
        }
      } else {
        // Target gone, remove projectile
        projectilesToRemove.push(proj.id);
      }
    });
    projectilesRef.current = projectilesRef.current.filter(p => !projectilesToRemove.includes(p.id));

    // 5. Trigger Render
    setRenderTrigger(prev => prev + 1);

    frameIdRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, level, spawnWord]); // Dependencies are minimal to avoid recreating loop often

  // --- Controls ---

  const startGame = () => {
    setGameState(GameState.PLAYING);
    setScore(0);
    setLives(3);
    setLevel(1);
    setInputValue('');
    activeWordsRef.current = [];
    particlesRef.current = [];
    projectilesRef.current = [];
    lastSpawnTimeRef.current = 0;
    audioService.playSuccess(); // Start sound

    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const endGame = () => {
    setGameState(GameState.GAME_OVER);
    cancelAnimationFrame(frameIdRef.current);
    audioService.playError();
    setHighScore(prev => Math.max(prev, score));
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setInputError(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      checkWordMatch();
    }
  };

  const checkWordMatch = () => {
    const trimmedInput = inputValue.trim().toLowerCase();
    // Find first non-marked word
    const matchIndex = activeWordsRef.current.findIndex(w =>
      !w.markedForDeath && w.text.toLowerCase() === trimmedInput
    );

    if (matchIndex !== -1) {
      // MATCH!
      const word = activeWordsRef.current[matchIndex];
      word.markedForDeath = true;

      // Spawn Projectile
      const weaponSpeed = currentWeapon === WeaponType.LASER ? 3 : currentWeapon === WeaponType.MISSILE ? 1.5 : 4;
      const weaponColor = currentWeapon === WeaponType.LASER ? '#ef4444' : currentWeapon === WeaponType.MISSILE ? '#f59e0b' : '#3b82f6';

      projectilesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        x: 50, // Start from center
        y: 90, // Start from bottom
        targetId: word.id,
        speed: weaponSpeed,
        type: currentWeapon,
        color: weaponColor
      });

      setInputValue('');
      // Sound played on impact now, or launch sound here? Let's keep success sound on impact for satisfaction, maybe a shoot sound here?
      // For now, silence on shoot, boom on hit.

    } else {
      // NO MATCH
      if (inputValue.length > 0) {
        audioService.playError();
        setInputError(true);
        setTimeout(() => setInputError(false), 300);
      }
    }
  };

  // --- Effects ---

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      frameIdRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [gameState, gameLoop]);

  // Keep input focused
  useEffect(() => {
    const handleBlur = () => {
      if (gameState === GameState.PLAYING) {
        inputRef.current?.focus();
      }
    };
    const input = inputRef.current;
    input?.addEventListener('blur', handleBlur);
    return () => input?.removeEventListener('blur', handleBlur);
  }, [gameState]);


  // --- Render Helpers ---

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden flex flex-col items-center justify-center select-none">

      {/* Background Grid/Effect */}
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
          backgroundSize: '30px 30px'
        }}>
      </div>

      {/* --- HUD --- */}
      <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-start z-20">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md p-3 rounded-xl border border-slate-700 shadow-lg">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <span className="text-2xl font-bold text-white tracking-wider">{score}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md p-2 px-3 rounded-lg border border-slate-700">
            <span className="text-slate-400 text-sm font-semibold uppercase">Level</span>
            <span className="text-xl font-bold text-blue-400">{level}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {[...Array(3)].map((_, i) => (
            <Heart
              key={i}
              className={`w-8 h-8 transition-all duration-300 ${i < lives ? 'text-red-500 fill-red-500' : 'text-slate-700'}`}
            />
          ))}
        </div>
      </div>

      {/* --- WEAPON SELECTOR --- */}
      {gameState === GameState.PLAYING && (
        <div className="absolute top-20 right-6 flex flex-col gap-2 z-20">
          <button
            onClick={() => setCurrentWeapon(WeaponType.LASER)}
            className={`p-3 rounded-xl border transition-all ${currentWeapon === WeaponType.LASER ? 'bg-red-500 border-red-400 text-white shadow-lg scale-110' : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
          >
            <Zap className="w-6 h-6" />
          </button>
          <button
            onClick={() => setCurrentWeapon(WeaponType.MISSILE)}
            className={`p-3 rounded-xl border transition-all ${currentWeapon === WeaponType.MISSILE ? 'bg-orange-500 border-orange-400 text-white shadow-lg scale-110' : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
          >
            <Rocket className="w-6 h-6" />
          </button>
          <button
            onClick={() => setCurrentWeapon(WeaponType.BULLET)}
            className={`p-3 rounded-xl border transition-all ${currentWeapon === WeaponType.BULLET ? 'bg-blue-500 border-blue-400 text-white shadow-lg scale-110' : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
          >
            <Disc className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* --- GAME AREA --- */}
      {gameState === GameState.PLAYING && (
        <div ref={gameContainerRef} className="absolute inset-0 z-10 pointer-events-none">
          {/* Particles */}
          {particlesRef.current.map(p => (
            <div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}rem`,
                height: `${p.size}rem`,
                backgroundColor: p.color,
                opacity: p.life,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}

          {/* Projectiles */}
          {projectilesRef.current.map(p => (
            <div
              key={p.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: `translate(-50%, -50%) rotate(${p.angle || 0}deg)`
              }}
            >
              {p.type === WeaponType.LASER && (
                // Laser: Vertical bar |
                // If angle is 0 (Right), we want it horizontal -.
                // So rotate -90 to make | become -.
                // Wait, if base is |, rotate(90) makes it -.
                // So if angle is 0, we want -. 
                // Let's just rotate the inner element to be pointing Right (0deg) by default.
                // A horizontal bar w-8 h-1 is pointing Right.
                <div className="w-8 h-1 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
              )}
              {p.type === WeaponType.MISSILE && (
                // Rocket icon points Top-Right (45deg).
                // We want it to point Right (0deg).
                // So rotate 45deg clockwise? No, rotate -45deg.
                <div style={{ transform: 'rotate(45deg)' }}>
                  <Rocket className="w-6 h-6 text-orange-500 drop-shadow-lg animate-pulse" />
                </div>
              )}
              {p.type === WeaponType.BULLET && (
                <div className="w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}
            </div>
          ))}

          {/* Words */}
          {activeWordsRef.current.map(word => (
            <div
              key={word.id}
              className="absolute transform -translate-x-1/2 px-4 py-2 rounded-full shadow-lg border-2 transition-transform duration-75"
              style={{
                left: `${word.x}%`,
                top: `${word.y}%`,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: word.color,
                color: '#1e293b'
              }}
            >
              <span className="text-xl font-bold tracking-wide">{word.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* --- INPUT ZONE (Fixed at bottom) --- */}
      {gameState === GameState.PLAYING && (
        <div className="absolute bottom-0 w-full p-6 md:p-10 flex justify-center z-30 bg-gradient-to-t from-slate-900 to-transparent">
          <div className={`relative w-full max-w-xl transition-transform duration-100 ${inputError ? 'shake' : ''}`}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              className={`w-full h-16 px-6 rounded-2xl text-3xl font-bold text-center outline-none shadow-2xl border-4 transition-all duration-200
                ${inputError
                  ? 'bg-red-50 border-red-500 text-red-900 placeholder-red-300'
                  : 'bg-white border-blue-500 text-slate-800 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/30'
                }`}
              placeholder="Type here..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hidden md:block">
              <span className="text-xs font-bold border border-slate-300 rounded px-2 py-1">ENTER</span>
            </div>
          </div>
        </div>
      )}

      {/* --- MENUS --- */}

      {gameState === GameState.MENU && (
        <div className="z-40 flex flex-col items-center gap-8 p-8 bg-slate-800/90 backdrop-blur-xl rounded-3xl border border-slate-700 shadow-2xl max-w-md text-center animate-in fade-in zoom-in duration-300">
          <div className="space-y-2">
            <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Word Smash
            </h1>
            <p className="text-slate-300 text-lg">Grade 3 Vocabulary Challenge</p>
          </div>

          <div className="flex flex-col items-center gap-4 bg-slate-900/50 p-6 rounded-xl w-full">
            <TutorialDemo />
            <p className="text-slate-400 text-sm font-medium">Type the word & Press Enter</p>
          </div>

          <button
            onClick={startGame}
            className="group relative px-8 py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-2xl font-bold text-xl shadow-[0_0_40px_-10px_rgba(59,130,246,0.5)] transition-all hover:scale-105 active:scale-95 w-full flex items-center justify-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]" />
            <Play className="w-6 h-6 fill-current" />
            START GAME
          </button>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="z-40 flex flex-col items-center gap-6 p-10 bg-slate-800/95 backdrop-blur-xl rounded-3xl border border-red-500/30 shadow-2xl animate-in fade-in zoom-in duration-300 text-center">
          <div>
            <h2 className="text-4xl font-bold text-white mb-2">Game Over!</h2>
            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 my-4 filter drop-shadow-lg">
              {score}
            </div>
            <p className="text-slate-400 uppercase tracking-widest text-sm font-bold">Final Score</p>
          </div>

          {score === highScore && score > 0 && (
            <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-400 px-4 py-2 rounded-full border border-yellow-500/20 animate-pulse">
              <Zap className="w-4 h-4" /> New High Score!
            </div>
          )}

          <button
            onClick={startGame}
            className="mt-4 px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-lg shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Try Again
          </button>
        </div>
      )}

    </div>
  );
};

export default App;
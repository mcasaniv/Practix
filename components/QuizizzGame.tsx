import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Question, ReadingText, UserProfile } from '../types';
import { formatQuestionText, parseHTMLTags } from '../utils';

export interface QuizizzGameProps {
  title: string;
  subtitle?: string;
  questions: Question[];
  readingTexts?: ReadingText[];
  onFinish: (score: number, total: number) => void;
  onBack: () => void;
  userProfile?: UserProfile;
}

const MEMES_CORRECT = [
  { text: "¡Estás imparable! 🚀", emoji: "🔥" },
  { text: "¡Nivel leyenda activado! 🧠", emoji: "⚡" },
  { text: "¡Respuesta brillante! 💎", emoji: "🎯" },
  { text: "¡Procesador a la velocidad de la luz! ⚡", emoji: "🏆" },
  { text: "¡Aplastante triunfo! 💥", emoji: "🌟" }
];

const MEMES_WRONG = [
  { text: "¡Casi lo logras! Revisa la explicación 💪", emoji: "📘" },
  { text: "¡Aprender del error te hace más fuerte! 🔥", emoji: "🌱" },
  { text: "¡No pasa nada, mantén el enfoque! 🧘", emoji: "🎯" },
  { text: "¡Próxima pregunta, próxima victoria! 🚀", emoji: "⚡" }
];

const OPTION_THEMES = [
  { bg: "bg-red-500 hover:bg-red-600 active:bg-red-700", border: "border-red-600", text: "text-white", icon: "▲", name: "Red" },
  { bg: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700", border: "border-blue-600", text: "text-white", icon: "◆", name: "Blue" },
  { bg: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700", border: "border-amber-600", text: "text-white", icon: "●", name: "Yellow" },
  { bg: "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700", border: "border-emerald-600", text: "text-white", icon: "■", name: "Green" },
  { bg: "bg-purple-500 hover:bg-purple-600 active:bg-purple-700", border: "border-purple-600", text: "text-white", icon: "★", name: "Purple" }
];

export const QuizizzGame: React.FC<QuizizzGameProps> = ({
  title,
  subtitle,
  questions,
  readingTexts = [],
  onFinish,
  onBack,
  userProfile
}) => {
  // Game Setup & State
  const [gameState, setGameState] = useState<'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'FEEDBACK' | 'SUMMARY'>('LOBBY');
  const [timeLimit, setTimeLimit] = useState<number>(30); // 15, 30, 45 or 0 (unlimited)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Quiz progress
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [userScore, setUserScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [scoreGain, setScoreGain] = useState<number>(0);
  const [speedBonus, setSpeedBonus] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  
  // Powerups state (usable once per match)
  const [powerUps, setPowerUps] = useState({
    fiftyFifty: true,
    freezeTime: true,
    doublePoints: true,
    secondChance: true
  });
  const [activeDoublePoints, setActiveDoublePoints] = useState<boolean>(false);
  const [disabledOptions, setDisabledOptions] = useState<number[]>([]);
  const [isSecondChanceActive, setIsSecondChanceActive] = useState<boolean>(false);
  const [secondChanceUsed, setSecondChanceUsed] = useState<boolean>(false);

  // Countdown before starting
  const [countdownNum, setCountdownNum] = useState<number>(3);

  // Reading text modal
  const [showReadingModal, setShowReadingModal] = useState<boolean>(false);

  // Meme feedback
  const [meme, setMeme] = useState<{ text: string; emoji: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const playerName = userProfile?.name?.trim() || 'Estudiante Practix';
  const playerAvatarUrl = userProfile?.avatarUrl?.trim() || '';

  const currentQuestion = questions[currentIndex];
  const currentReadingText = useMemo(() => {
    if (!currentQuestion?.readingTextId) return undefined;
    return readingTexts.find(t => t.id === currentQuestion.readingTextId);
  }, [currentQuestion, readingTexts]);

  // Web Audio synth effects
  const playSound = (type: 'correct' | 'wrong' | 'powerup' | 'tick' | 'win') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === 'correct') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc1.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1);
        osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.4);
        osc2.stop(ctx.currentTime + 0.4);
      } else if (type === 'wrong') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.setValueAtTime(130, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'powerup') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } else if (type === 'win') {
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
          gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.12);
          osc.stop(ctx.currentTime + idx * 0.12 + 0.3);
        });
      }
    } catch (e) {
      // Ignore audio restriction errors
    }
  };

  // MathKaTeX rendering
  useEffect(() => {
    if (containerRef.current && (window as any).renderMathInElement) {
      (window as any).renderMathInElement(containerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
  }, [currentIndex, gameState, selectedOption]);

  // Start game sequence
  const handleStartGame = () => {
    setGameState('COUNTDOWN');
    setCountdownNum(3);
  };

  useEffect(() => {
    if (gameState === 'COUNTDOWN') {
      if (countdownNum > 0) {
        playSound('tick');
        const t = setTimeout(() => setCountdownNum(prev => prev - 1), 900);
        return () => clearTimeout(t);
      } else {
        setGameState('PLAYING');
        setCurrentIndex(0);
        setTimeLeft(timeLimit > 0 ? timeLimit : 99);
      }
    }
  }, [gameState, countdownNum, timeLimit]);

  // Timer loop during playing state
  useEffect(() => {
    if (gameState === 'PLAYING' && timeLimit > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleOptionSelect(-1, true); // Time out
            return 0;
          }
          if (prev <= 6) playSound('tick');
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [gameState, currentIndex, timeLimit]);

  // Handle option pick
  const handleOptionSelect = (index: number, isTimeout = false) => {
    if (gameState !== 'PLAYING') return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOption(index);

    const isCorrect = !isTimeout && index === currentQuestion.correctIndex;

    // Handle Second Chance Powerup
    if (!isCorrect && isSecondChanceActive && !secondChanceUsed) {
      setSecondChanceUsed(true);
      setIsSecondChanceActive(false);
      setDisabledOptions(prev => [...prev, index]);
      playSound('wrong');
      // Re-enable timer for second chance
      if (timeLimit > 0) {
        setTimeLeft(10);
      }
      return;
    }

    // Save answer
    if (!isTimeout) {
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: index }));
    }

    if (isCorrect) {
      playSound('correct');
      const basePoints = 1000;
      const speedRatio = timeLimit > 0 ? (timeLeft / timeLimit) : 1;
      const speedPts = Math.floor(speedRatio * 500);
      const streakMultiplier = Math.min(streak + 1, 5);
      const streakBonus = (streakMultiplier - 1) * 100;
      
      let totalGain = basePoints + speedPts + streakBonus;
      if (activeDoublePoints) {
        totalGain *= 2;
      }

      setScoreGain(totalGain);
      setSpeedBonus(speedPts);
      setUserScore(prev => prev + totalGain);

      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);

      const randomMeme = MEMES_CORRECT[Math.floor(Math.random() * MEMES_CORRECT.length)];
      setMeme(randomMeme);
    } else {
      playSound('wrong');
      setScoreGain(0);
      setSpeedBonus(0);
      setStreak(0);

      const randomMeme = MEMES_WRONG[Math.floor(Math.random() * MEMES_WRONG.length)];
      setMeme(randomMeme);
    }

    setActiveDoublePoints(false);
    setDisabledOptions([]);
    setGameState('FEEDBACK');
  };

  // Next Question
  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setDisabledOptions([]);
      setTimeLeft(timeLimit > 0 ? timeLimit : 99);
      setGameState('PLAYING');
    } else {
      // Finish Practix Game
      playSound('win');
      setGameState('SUMMARY');
      
      // Calculate final score count
      let correctCount = 0;
      questions.forEach(q => {
        if (answers[q.id] === q.correctIndex) correctCount++;
      });
      if (selectedOption === currentQuestion.correctIndex) {
        correctCount = Object.values(answers).filter((val, i) => {
          const q = questions.find(item => item.id === Object.keys(answers)[i]);
          return q && val === q.correctIndex;
        }).length;
      }
      onFinish(correctCount, questions.length);
    }
  };

  // Powerup Trigger: 50/50
  const useFiftyFifty = () => {
    if (!powerUps.fiftyFifty || gameState !== 'PLAYING') return;
    playSound('powerup');
    const correctIdx = currentQuestion.correctIndex;
    const wrongIndices = currentQuestion.options
      .map((_, i) => i)
      .filter(i => i !== correctIdx);
    
    // Shuffle and pick 2 wrong indices to disable
    const shuffledWrong = wrongIndices.sort(() => 0.5 - Math.random());
    const toDisable = shuffledWrong.slice(0, 2);

    setDisabledOptions(toDisable);
    setPowerUps(prev => ({ ...prev, fiftyFifty: false }));
  };

  // Powerup Trigger: Freeze Time (+15s)
  const useFreezeTime = () => {
    if (!powerUps.freezeTime || gameState !== 'PLAYING') return;
    playSound('powerup');
    setTimeLeft(prev => prev + 15);
    setPowerUps(prev => ({ ...prev, freezeTime: false }));
  };

  // Powerup Trigger: Double Points (2x)
  const useDoublePoints = () => {
    if (!powerUps.doublePoints || gameState !== 'PLAYING') return;
    playSound('powerup');
    setActiveDoublePoints(true);
    setPowerUps(prev => ({ ...prev, doublePoints: false }));
  };

  // Powerup Trigger: Second Chance
  const useSecondChance = () => {
    if (!powerUps.secondChance || gameState !== 'PLAYING') return;
    playSound('powerup');
    setIsSecondChanceActive(true);
    setPowerUps(prev => ({ ...prev, secondChance: false }));
  };

  // Accuracy calculation
  const correctCount = useMemo(() => {
    let count = 0;
    Object.keys(answers).forEach(k => {
      const q = questions.find(item => item.id === k);
      if (q && answers[k] === q.correctIndex) count++;
    });
    return count;
  }, [answers, questions]);

  const accuracy = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.round((correctCount / questions.length) * 100);
  }, [correctCount, questions]);

  return (
    <div className="max-w-4xl mx-auto min-h-[85vh] flex flex-col justify-between" ref={containerRef}>
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 bg-slate-900 text-white p-4 md:px-6 rounded-2xl shadow-xl border border-slate-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-black text-slate-300 hover:text-white uppercase tracking-wider bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition-all"
        >
          <span>⬅️</span>
          <span>Salir</span>
        </button>

        <div className="text-center">
          <h2 className="text-lg md:text-xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <span>🎮</span> MODO PRACTIX
          </h2>
          <p className="text-[11px] text-slate-400 font-bold truncate max-w-[200px] sm:max-w-[320px]">{title}</p>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2.5 rounded-xl border font-bold text-xs transition-all ${
            soundEnabled ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-500'
          }`}
          title={soundEnabled ? 'Sonido Activado' : 'Sonido Silenciado'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>

      {/* LOBBY SCREEN */}
      {gameState === 'LOBBY' && (
        <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 border border-slate-800 shadow-2xl space-y-8 animate-fade-in my-auto">
          <div className="text-center space-y-3">
            <div className="inline-block p-4 bg-purple-500/20 border-2 border-purple-500/40 rounded-3xl text-5xl mb-2 animate-bounce">
              ⚡
            </div>
            <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              ¡Desafío Practix Interactivo!
            </h1>
            <p className="text-slate-300 text-base max-w-xl mx-auto font-medium">
              Demuestra tu rapidez y precisión. Gana bonos por velocidad y acumula rachas de fuego en cada pregunta.
            </p>
          </div>

          {/* User Profile Banner in Lobby */}
          <div className="bg-gradient-to-r from-purple-900/60 to-indigo-900/60 border border-purple-500/30 p-5 rounded-2xl flex items-center gap-4 justify-center">
            {playerAvatarUrl ? (
              <img
                src={playerAvatarUrl}
                alt={playerName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-purple-400 shadow-md shrink-0"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-600/50 border-2 border-purple-400 flex items-center justify-center text-3xl font-black shrink-0">
                👤
              </div>
            )}
            <div>
              <span className="text-[10px] font-black uppercase text-purple-300 tracking-wider block">Jugador Activo</span>
              <h3 className="text-xl font-black text-white">{playerName}</h3>
            </div>
          </div>

          {/* Game Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/60 p-6 rounded-2xl border border-slate-700">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-purple-300 block mb-3 flex items-center gap-2">
                <span>⏱️</span> Tiempo por Pregunta:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 45, 0].map(sec => (
                  <button
                    key={sec}
                    onClick={() => setTimeLimit(sec)}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs border transition-all ${
                      timeLimit === sec
                        ? 'bg-purple-600 border-purple-400 text-white shadow-lg scale-105'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {sec === 0 ? 'Sin límite' : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-amber-300 block mb-3 flex items-center gap-2">
                <span>⚡</span> Comodines Disponibles:
              </label>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1">🛡️ 50/50</span>
                <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1">⏱️ Pausa</span>
                <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1">🚀 2x Puntos</span>
                <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1">🔄 2da Chance</span>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <div className="text-center pt-4">
            <button
              onClick={handleStartGame}
              className="w-full md:w-auto bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xl px-12 py-6 rounded-2xl shadow-2xl transform hover:scale-105 active:scale-95 transition-all tracking-wider uppercase flex items-center justify-center gap-3 mx-auto"
            >
              <span>🚀</span> ¡EMPEZAR JUEGO PRACTIX!
            </button>
          </div>
        </div>
      )}

      {/* COUNTDOWN SCREEN */}
      {gameState === 'COUNTDOWN' && (
        <div className="bg-slate-900 text-white rounded-3xl p-16 text-center border border-slate-800 shadow-2xl my-auto animate-pulse flex flex-col items-center justify-center">
          <p className="text-purple-400 font-extrabold uppercase tracking-widest text-lg mb-6">¡Prepárate!</p>
          <div className="text-8xl font-black bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent scale-125 mb-6">
            {countdownNum === 0 ? '¡YA!' : countdownNum}
          </div>
          <p className="text-slate-400 text-sm font-bold">Responde rápido para obtener máximo puntaje</p>
        </div>
      )}

      {/* PLAYING & FEEDBACK STATES */}
      {(gameState === 'PLAYING' || gameState === 'FEEDBACK') && currentQuestion && (
        <div className="space-y-6">
          {/* Top Game Bar: Progress, Score, Streak, User Profile */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800 text-white p-3 rounded-2xl border border-slate-700 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-black text-slate-400">Pregunta</span>
              <span className="text-lg font-black text-purple-400">{currentIndex + 1} / {questions.length}</span>
            </div>

            <div className="bg-slate-800 text-white p-3 rounded-2xl border border-slate-700 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-black text-slate-400">Puntaje</span>
              <span className="text-lg font-black text-amber-400">{userScore.toLocaleString()} PTS</span>
            </div>

            <div className="bg-slate-800 text-white p-3 rounded-2xl border border-slate-700 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-black text-slate-400">Racha</span>
              <span className="text-lg font-black text-orange-400 flex items-center gap-1">
                <span>🔥</span> {streak}
              </span>
            </div>

            <div className="bg-slate-800 text-white p-3 rounded-2xl border border-slate-700 flex items-center justify-center gap-2">
              {playerAvatarUrl ? (
                <img src={playerAvatarUrl} alt={playerName} className="w-7 h-7 rounded-full object-cover border border-purple-400 shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-base shrink-0">👤</span>
              )}
              <div className="truncate text-left">
                <span className="text-[9px] uppercase font-black text-slate-400 block leading-tight">Jugador</span>
                <span className="text-xs font-black text-purple-300 truncate block">{playerName}</span>
              </div>
            </div>
          </div>

          {/* Timer Progress Bar */}
          {timeLimit > 0 && (
            <div className="bg-slate-800 h-4 rounded-full overflow-hidden p-0.5 border border-slate-700 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  timeLeft > timeLimit * 0.5
                    ? 'bg-emerald-500'
                    : timeLeft > timeLimit * 0.2
                    ? 'bg-amber-500'
                    : 'bg-rose-500 animate-pulse'
                }`}
                style={{ width: `${(timeLeft / timeLimit) * 100}%` }}
              ></div>
            </div>
          )}

          {/* Power-Ups Bar */}
          {gameState === 'PLAYING' && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 p-3 rounded-2xl border border-slate-800 shadow-lg">
              <span className="text-xs font-black uppercase tracking-wider text-purple-300 ml-2">Comodines:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={useFiftyFifty}
                  disabled={!powerUps.fiftyFifty}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs border transition-all flex items-center gap-1.5 ${
                    powerUps.fiftyFifty
                      ? 'bg-purple-600 border-purple-400 text-white hover:bg-purple-500 shadow-md active:scale-95'
                      : 'bg-slate-800 border-slate-700 text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  title="Eliminar 2 opciones incorrectas"
                >
                  <span>🛡️</span> 50/50
                </button>

                <button
                  onClick={useFreezeTime}
                  disabled={!powerUps.freezeTime}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs border transition-all flex items-center gap-1.5 ${
                    powerUps.freezeTime
                      ? 'bg-blue-600 border-blue-400 text-white hover:bg-blue-500 shadow-md active:scale-95'
                      : 'bg-slate-800 border-slate-700 text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  title="Añadir +15 segundos"
                >
                  <span>⏱️</span> +15s
                </button>

                <button
                  onClick={useDoublePoints}
                  disabled={!powerUps.doublePoints || activeDoublePoints}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs border transition-all flex items-center gap-1.5 ${
                    activeDoublePoints
                      ? 'bg-amber-500 border-amber-300 text-white animate-pulse'
                      : powerUps.doublePoints
                      ? 'bg-amber-600 border-amber-400 text-white hover:bg-amber-500 shadow-md active:scale-95'
                      : 'bg-slate-800 border-slate-700 text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  title="Duplicar puntaje de esta pregunta"
                >
                  <span>🚀</span> 2x Puntos
                </button>

                <button
                  onClick={useSecondChance}
                  disabled={!powerUps.secondChance || isSecondChanceActive}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs border transition-all flex items-center gap-1.5 ${
                    isSecondChanceActive
                      ? 'bg-emerald-500 border-emerald-300 text-white animate-pulse'
                      : powerUps.secondChance
                      ? 'bg-emerald-600 border-emerald-400 text-white hover:bg-emerald-500 shadow-md active:scale-95'
                      : 'bg-slate-800 border-slate-700 text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  title="Proteger contra 1 error"
                >
                  <span>🔄</span> 2da Chance
                </button>
              </div>
            </div>
          )}

          {/* Reading text trigger button */}
          {currentReadingText && (
            <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-r-2xl flex items-center justify-between text-amber-200">
              <div className="flex items-center gap-2 text-xs font-black">
                <span>📖</span> Lectura asociada: <span className="underline italic">{currentReadingText.title}</span>
              </div>
              <button
                onClick={() => setShowReadingModal(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-black text-xs px-3 py-1.5 rounded-xl transition-all"
              >
                Ver Lectura
              </button>
            </div>
          )}

          {/* Question Box */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
            {activeDoublePoints && (
              <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-widest px-4 py-1 rounded-bl-xl shadow-lg animate-bounce">
                🚀 Doble Puntuación Activa (2x)
              </div>
            )}

            <div className="flex items-center gap-2 mb-4 text-xs text-purple-400 font-black uppercase tracking-wider">
              <span>{currentQuestion.subject}</span>
              <span>•</span>
              <span>{currentQuestion.topic}</span>
            </div>

            {currentQuestion.imageUrl && (
              <div className="mb-6 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-2">
                <img src={currentQuestion.imageUrl} alt="Question" className="max-w-full h-auto mx-auto max-h-[300px] object-contain" referrerPolicy="no-referrer" />
              </div>
            )}

            <p className="text-xl md:text-2xl font-black leading-relaxed text-slate-100 mb-8">
              {formatQuestionText(currentQuestion.questionText)}
            </p>

            {/* Practix Option Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.options.map((opt, optIdx) => {
                const theme = OPTION_THEMES[optIdx % OPTION_THEMES.length];
                const isDisabled = disabledOptions.includes(optIdx);
                const isSelected = selectedOption === optIdx;
                const isCorrect = optIdx === currentQuestion.correctIndex;

                let stateClasses = `${theme.bg} ${theme.border} text-white hover:scale-[1.02] shadow-lg`;

                if (isDisabled) {
                  stateClasses = "bg-slate-800/40 border-slate-800 text-slate-600 opacity-20 cursor-not-allowed scale-95";
                } else if (gameState === 'FEEDBACK') {
                  if (isCorrect) {
                    stateClasses = "bg-emerald-600 border-emerald-400 text-white ring-4 ring-emerald-400 shadow-2xl scale-105";
                  } else if (isSelected && !isCorrect) {
                    stateClasses = "bg-rose-600 border-rose-400 text-white ring-4 ring-rose-400 opacity-80";
                  } else {
                    stateClasses = "bg-slate-800/50 border-slate-800 text-slate-500 opacity-30";
                  }
                }

                return (
                  <button
                    key={optIdx}
                    disabled={isDisabled || gameState !== 'PLAYING'}
                    onClick={() => handleOptionSelect(optIdx)}
                    className={`p-5 rounded-2xl border-2 text-left transition-all duration-200 flex items-center gap-4 relative overflow-hidden ${stateClasses}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-black/20 border border-white/20 flex items-center justify-center text-lg font-black shrink-0">
                      {theme.icon}
                    </div>
                    <span className="text-base font-bold leading-relaxed flex-grow">
                      {parseHTMLTags(opt)}
                    </span>

                    {gameState === 'FEEDBACK' && isCorrect && (
                      <span className="text-2xl shrink-0">✓</span>
                    )}
                    {gameState === 'FEEDBACK' && isSelected && !isCorrect && (
                      <span className="text-2xl shrink-0">✗</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback Banner */}
          {gameState === 'FEEDBACK' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{selectedOption === currentQuestion.correctIndex ? '🎉' : '❌'}</span>
                  <div>
                    <h3 className={`text-2xl font-black ${selectedOption === currentQuestion.correctIndex ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {selectedOption === currentQuestion.correctIndex ? '¡CORRECTO!' : '¡CASI!'}
                    </h3>
                    <p className="text-slate-300 text-sm font-bold">{meme?.text} {meme?.emoji}</p>
                  </div>
                </div>

                {selectedOption === currentQuestion.correctIndex && (
                  <div className="text-right bg-emerald-500/20 border border-emerald-500/40 p-3 rounded-2xl">
                    <span className="text-2xl font-black text-emerald-300 block">+{scoreGain} PTS</span>
                    {speedBonus > 0 && (
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">
                        (Bono de velocidad: +{speedBonus})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Explanation */}
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                <p className="text-purple-300 font-bold mb-1 uppercase tracking-wider text-xs">Explicación:</p>
                {parseHTMLTags(currentQuestion.explanation)}
              </div>

              {/* Next Question Button */}
              <div className="text-right pt-2">
                <button
                  onClick={handleNextQuestion}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black text-base px-8 py-4 rounded-2xl shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 ml-auto"
                >
                  <span>Siguiente Pregunta</span>
                  <span>➡️</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUMMARY SCREEN */}
      {gameState === 'SUMMARY' && (
        <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 border border-slate-800 shadow-2xl space-y-8 animate-fade-in my-auto">
          <div className="text-center space-y-3">
            <div className="text-6xl mb-2 animate-bounce">🏆</div>
            <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-amber-300 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              ¡RESULTADOS DEL JUEGO PRACTIX!
            </h1>
            <p className="text-slate-400 font-bold text-sm">Has completado el desafío interactivo</p>
          </div>

          {/* User Profile Summary Card */}
          <div className="bg-gradient-to-br from-purple-900/60 to-indigo-900/60 border border-purple-500/40 p-6 md:p-10 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-6 md:gap-8">
              {playerAvatarUrl ? (
                <img
                  src={playerAvatarUrl}
                  alt={playerName}
                  className="w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-full object-cover border-4 border-purple-400 shadow-2xl ring-4 ring-purple-500/30 shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-full bg-purple-600/50 border-4 border-purple-400 flex items-center justify-center text-7xl sm:text-8xl font-black shrink-0 shadow-2xl ring-4 ring-purple-500/30">
                  👤
                </div>
              )}
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-purple-300 block mb-1.5">
                  Resumen de Jugador
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-white">{playerName}</h2>
                <p className="text-slate-300 text-base mt-1.5">¡Gran trabajo en esta sesión de práctica!</p>
              </div>
            </div>

            <div className="bg-slate-950/60 px-6 py-4 rounded-2xl border border-purple-500/30 text-center shrink-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
                Puntuación Total
              </span>
              <span className="text-3xl font-black text-amber-300">{userScore.toLocaleString()} PTS</span>
            </div>
          </div>

          {/* User Performance Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Precisión</span>
              <span className="text-3xl font-black text-emerald-400">{accuracy}%</span>
            </div>

            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Racha Máxima</span>
              <span className="text-3xl font-black text-orange-400 flex items-center justify-center gap-1">
                <span>🔥</span> {maxStreak}
              </span>
            </div>

            <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center col-span-2 md:col-span-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Aciertos</span>
              <span className="text-3xl font-black text-purple-400">{correctCount} / {questions.length}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={() => {
                setGameState('LOBBY');
                setUserScore(0);
                setStreak(0);
                setMaxStreak(0);
                setAnswers({});
                setPowerUps({
                  fiftyFifty: true,
                  freezeTime: true,
                  doublePoints: true,
                  secondChance: true
                });
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white font-black text-base px-8 py-4 rounded-2xl shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <span>🔄</span> Jugar de Nuevo
            </button>

            <button
              onClick={onBack}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-base px-8 py-4 rounded-2xl border border-slate-700 transition-all flex items-center gap-2"
            >
              <span>⬅️</span> Volver a los Temas
            </button>
          </div>
        </div>
      )}

      {/* READING TEXT MODAL */}
      {showReadingModal && currentReadingText && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white max-w-2xl w-full rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-amber-300 flex items-center gap-2">
                <span>📖</span> {currentReadingText.title}
              </h3>
              <button
                onClick={() => setShowReadingModal(false)}
                className="text-slate-400 hover:text-white font-black text-xl p-1"
              >
                ✕
              </button>
            </div>
            <div className="text-slate-200 leading-relaxed font-serif whitespace-pre-wrap text-base italic bg-slate-950 p-6 rounded-2xl border border-slate-800">
              {currentReadingText.content}
            </div>
            <button
              onClick={() => setShowReadingModal(false)}
              className="mt-6 w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-3 rounded-xl transition-all"
            >
              Entendido, volver a la pregunta
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

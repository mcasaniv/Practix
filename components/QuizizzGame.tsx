import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Question, ReadingText, UserProfile } from '../types';
import { formatQuestionText, parseHTMLTags } from '../utils';
import { EditResolutionModal } from './EditResolutionModal';

export interface QuizizzGameProps {
  title: string;
  subtitle?: string;
  questions: Question[];
  readingTexts?: ReadingText[];
  onFinish: (score: number, total: number, wrongIds?: string[], correctIds?: string[]) => void;
  onBack: () => void;
  userProfile?: UserProfile;
  onUpdateQuestion?: (updatedQuestion: Question) => void;
  onToast?: (message: string) => void;
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
  userProfile,
  onUpdateQuestion,
  onToast
}) => {
  // Game Setup & State
  const [gameState, setGameState] = useState<'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'FEEDBACK' | 'SUMMARY'>('LOBBY');
  const [timeLimit, setTimeLimit] = useState<number>(30); // 15, 30, 45 or 0 (unlimited)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Local questions state to support immediate updates after editing resolution
  const [localQuestions, setLocalQuestions] = useState<Question[]>(questions);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  useEffect(() => {
    setLocalQuestions(questions);
  }, [questions]);

  const handleSaveResolution = (updatedQ: Question) => {
    setLocalQuestions(prev => prev.map(q => q.id === updatedQ.id ? updatedQ : q));
    if (onUpdateQuestion) {
      onUpdateQuestion(updatedQ);
    }
    if (onToast) {
      onToast("Resolución actualizada exitosamente.");
    }
  };

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

  // Solucionario / Resolution review state
  const [showSolucionario, setShowSolucionario] = useState<boolean>(false);
  const [solucionarioFilter, setSolucionarioFilter] = useState<'ALL' | 'CORRECT' | 'WRONG'>('ALL');

  // Meme feedback
  const [meme, setMeme] = useState<{ text: string; emoji: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const playerName = userProfile?.name?.trim() || 'Estudiante Practix';
  const playerAvatarUrl = userProfile?.avatarUrl?.trim() || '';

  // Ensure each question has a guaranteed unique ID to prevent state or answer collision
  const safeQuestions = useMemo(() => {
    const seen = new Set<string>();
    return (localQuestions || []).filter(Boolean).map((q, idx) => {
      let qId = q.id;
      if (!qId || seen.has(qId)) {
        qId = `practix-q-${idx}-${q.subject || ''}-${q.topic || ''}-${idx}`;
      }
      seen.add(qId);
      return { ...q, id: qId };
    });
  }, [localQuestions]);

  const currentQuestion = safeQuestions && safeQuestions.length > 0 ? safeQuestions[currentIndex] : undefined;
  const currentReadingText = useMemo(() => {
    if (!currentQuestion?.readingTextId) return undefined;
    return readingTexts?.find(t => t && t.id === currentQuestion.readingTextId);
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

  // Start game sequence
  const handleStartGame = () => {
    setGameState('COUNTDOWN');
    setCountdownNum(3);
    setCurrentIndex(0);
    setSelectedOption(null);
    setDisabledOptions([]);
    setIsSecondChanceActive(false);
    setSecondChanceUsed(false);
    setActiveDoublePoints(false);
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
    if (gameState !== 'PLAYING' || !currentQuestion) return;
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
    if (!isTimeout && currentQuestion.id) {
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
    if (currentIndex + 1 < safeQuestions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setDisabledOptions([]);
      // 2da Oportunidad permanece activa hasta que el usuario se equivoque en alguna pregunta
      setSecondChanceUsed(false);
      setActiveDoublePoints(false);
      setTimeLeft(timeLimit > 0 ? timeLimit : 99);
      setGameState('PLAYING');
    } else {
      // Finish Practix Game
      playSound('win');
      setGameState('SUMMARY');
      
      // Calculate final score count and track mistakes
      let finalCount = 0;
      const wrongIds: string[] = [];
      const correctIds: string[] = [];
      safeQuestions.forEach(q => {
        if (!q || !q.id) return;
        if (answers[q.id] === q.correctIndex) {
          finalCount++;
          correctIds.push(q.id);
        } else {
          wrongIds.push(q.id);
        }
      });
      onFinish(finalCount, safeQuestions.length, wrongIds, correctIds);
    }
  };

  // Powerup Trigger: 50/50
  const useFiftyFifty = () => {
    if (!powerUps.fiftyFifty || gameState !== 'PLAYING' || !currentQuestion) return;
    playSound('powerup');
    const correctIdx = currentQuestion.correctIndex;
    const wrongIndices = (currentQuestion.options || [])
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
    if (safeQuestions && safeQuestions.length > 0) {
      safeQuestions.forEach(q => {
        if (q && q.id && answers[q.id] === q.correctIndex) count++;
      });
    }
    return count;
  }, [answers, safeQuestions]);

  const accuracy = useMemo(() => {
    if (safeQuestions.length === 0) return 0;
    return Math.round((correctCount / safeQuestions.length) * 100);
  }, [correctCount, safeQuestions]);

  return (
    <div className="dark practix-dark max-w-4xl mx-auto min-h-[85vh] flex flex-col justify-between" ref={containerRef}>
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 bg-slate-900 text-white p-4 md:px-6 rounded-2xl shadow-xl border border-slate-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-black text-slate-300 hover:text-white uppercase tracking-wider bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Salir</span>
        </button>

        <div className="text-center">
          <h2 className="text-lg md:text-xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>MODO PRACTIX</span>
          </h2>
          <p className="text-[11px] text-slate-400 font-bold truncate max-w-[200px] sm:max-w-[320px]">{title}</p>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2.5 rounded-xl border font-bold text-xs transition-all flex items-center justify-center ${
            soundEnabled ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-500'
          }`}
          title={soundEnabled ? 'Sonido Activado' : 'Sonido Silenciado'}
        >
          {soundEnabled ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
        </button>
      </div>

      {/* LOBBY SCREEN */}
      {gameState === 'LOBBY' && (
        <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 border border-slate-800 shadow-2xl space-y-8 animate-fade-in my-auto">
          <div className="text-center space-y-3">
            <div className="inline-flex p-4 bg-purple-500/20 border-2 border-purple-500/40 rounded-3xl text-purple-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              ¡Desafío Practix Interactivo!
            </h1>
            <p className="text-slate-300 text-base max-w-xl mx-auto font-medium">
              Demuestra tu rapidez y precisión. Gana bonos por velocidad y acumula rachas en cada pregunta.
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
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-600/50 border-2 border-purple-400 flex items-center justify-center text-purple-300 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
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
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Tiempo por Pregunta:</span>
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
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Comodines Disponibles:</span>
              </label>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5">50/50</span>
                <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5">+15s Tiempo</span>
                <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5">2x Puntos</span>
                <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5">2da Chance</span>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <div className="text-center pt-4">
            <button
              onClick={handleStartGame}
              className="w-full md:w-auto bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xl px-12 py-5 rounded-2xl shadow-2xl transform hover:scale-105 active:scale-95 transition-all tracking-wider uppercase flex items-center justify-center gap-3 mx-auto"
            >
              <span>¡EMPEZAR JUEGO PRACTIX!</span>
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
              <span className="text-lg font-black text-purple-400">{currentIndex + 1} / {safeQuestions.length}</span>
            </div>

            <div className="bg-slate-800 text-white p-3 rounded-2xl border border-slate-700 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-black text-slate-400">Puntaje</span>
              <span className="text-lg font-black text-amber-400">{userScore.toLocaleString()} PTS</span>
            </div>

            <div className="bg-slate-800 text-white p-3 rounded-2xl border border-slate-700 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-black text-slate-400">Racha</span>
              <span className="text-lg font-black text-orange-400 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
                <span>{streak}</span>
              </span>
            </div>

            <div className="bg-slate-800 text-white p-3 rounded-2xl border border-slate-700 flex items-center justify-center gap-2">
              {playerAvatarUrl ? (
                <img src={playerAvatarUrl} alt={playerName} className="w-7 h-7 rounded-full object-cover border border-purple-400 shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-purple-600/40 text-purple-300 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>50/50</span>
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>+15s</span>
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>2x Puntos</span>
                </button>

                <button
                  onClick={useSecondChance}
                  disabled={!powerUps.secondChance || isSecondChanceActive}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs border transition-all flex items-center gap-1.5 ${
                    isSecondChanceActive
                      ? 'bg-emerald-500 border-emerald-300 text-white animate-pulse shadow-md ring-2 ring-emerald-400/50'
                      : powerUps.secondChance
                      ? 'bg-emerald-600 border-emerald-400 text-white hover:bg-emerald-500 shadow-md active:scale-95'
                      : 'bg-slate-800 border-slate-700 text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                  title={
                    isSecondChanceActive
                      ? '2da oportunidad activa: Te protegerá en tu próximo error'
                      : powerUps.secondChance
                      ? 'Activar 2da oportunidad (activa hasta tu próximo error)'
                      : '2da oportunidad ya utilizada'
                  }
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{isSecondChanceActive ? '2da Chance (Activa)' : '2da Chance'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Reading text trigger button */}
          {currentReadingText && (
            <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 rounded-r-2xl flex items-center justify-between text-amber-200">
              <div className="flex items-center gap-2 text-xs font-black">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Lectura asociada: <span className="underline italic">{currentReadingText.title}</span></span>
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
          <div 
            key={`q-box-${currentQuestion.id || currentIndex}`}
            className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl relative overflow-hidden"
          >
            {isSecondChanceActive && (
              <div className="absolute top-0 left-0 bg-emerald-500 text-slate-950 font-black text-[10px] uppercase tracking-widest px-3.5 py-1 rounded-br-xl shadow-lg flex items-center gap-1 animate-pulse z-20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>2da Oportunidad Activa</span>
              </div>
            )}
            {activeDoublePoints && (
              <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-widest px-4 py-1 rounded-bl-xl shadow-lg animate-bounce flex items-center gap-1 z-20">
                <span>Doble Puntuación Activa (2x)</span>
              </div>
            )}

            <div className="flex items-center gap-2 mb-4 text-xs font-black uppercase tracking-wider flex-wrap">
              <span className="text-purple-300 bg-purple-950/60 px-2.5 py-0.5 rounded-lg border border-purple-800/60">
                {currentQuestion.subject}
              </span>
              <span className="text-emerald-300 bg-emerald-950/70 px-2.5 py-0.5 rounded-lg border border-emerald-800/80 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>Tema: {currentQuestion.topic}</span>
              </span>
            </div>

            {/* Enunciado comes FIRST */}
            <div className="text-xl md:text-2xl font-black leading-relaxed text-slate-100 mb-6 whitespace-pre-wrap">
              {formatQuestionText(currentQuestion.questionText)}
            </div>

            {/* Images ALWAYS AFTER (debajo) del enunciado */}
            {currentQuestion.imageUrl && (
              <div className="mb-8 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 p-2 sm:p-3 max-w-xl mx-auto shadow-xl">
                <img 
                  src={currentQuestion.imageUrl} 
                  alt="Ilustración de la pregunta" 
                  className="max-w-full h-auto mx-auto max-h-[320px] object-contain rounded-xl" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            )}

            {/* Practix Option Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.options.map((opt, optIdx) => {
                const theme = OPTION_THEMES[optIdx % OPTION_THEMES.length];
                const isDisabled = disabledOptions.includes(optIdx);
                const isSelected = selectedOption === optIdx;
                const isCorrect = optIdx === currentQuestion.correctIndex;
                const optImg = currentQuestion.optionsImageUrls?.[optIdx];

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
                    key={`q-${currentQuestion.id || currentIndex}-opt-${optIdx}`}
                    disabled={isDisabled || gameState !== 'PLAYING'}
                    onClick={() => handleOptionSelect(optIdx)}
                    className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all duration-200 flex items-start sm:items-center gap-3 sm:gap-4 relative overflow-hidden min-h-[60px] ${stateClasses}`}
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/20 border border-white/20 flex items-center justify-center text-base sm:text-lg font-black shrink-0 mt-0.5 sm:mt-0">
                      {theme.icon}
                    </div>
                    <div className="flex-grow flex flex-col gap-1.5 min-w-0">
                      <span className="text-sm sm:text-base font-bold leading-relaxed whitespace-pre-wrap break-words">
                        {parseHTMLTags(opt)}
                      </span>
                      {optImg && (
                        <img 
                          src={optImg} 
                          alt="" 
                          className="max-h-12 max-w-full object-contain rounded mt-1 bg-white/10 p-0.5" 
                          referrerPolicy="no-referrer" 
                        />
                      )}
                    </div>

                    {gameState === 'FEEDBACK' && isCorrect && (
                      <span className="text-emerald-400 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    {gameState === 'FEEDBACK' && isSelected && !isCorrect && (
                      <span className="text-rose-400 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
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
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    selectedOption === currentQuestion.correctIndex ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {selectedOption === currentQuestion.correctIndex ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className={`text-2xl font-black ${selectedOption === currentQuestion.correctIndex ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {selectedOption === currentQuestion.correctIndex ? '¡CORRECTO!' : '¡CASI!'}
                    </h3>
                    <p className="text-slate-300 text-sm font-bold">{meme?.text}</p>
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
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <p className="text-purple-300 font-bold uppercase tracking-wider text-xs">Explicación:</p>
                  {onUpdateQuestion && (
                    <button
                      type="button"
                      onClick={() => setEditingQuestion(currentQuestion)}
                      className="p-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 transition-all border border-purple-500/30 active:scale-95 cursor-pointer ml-auto flex items-center justify-center shrink-0"
                      title="Editar pregunta completa (enunciado, alternativas y solución)"
                      aria-label="Editar pregunta completa"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
                {formatQuestionText(currentQuestion.explanation || 'No hay explicación adicional registrada para esta pregunta.')}
                {currentQuestion.explanationImageUrl && (
                  <div className="mt-3 flex justify-center">
                    <img 
                      src={currentQuestion.explanationImageUrl} 
                      alt="Explicación visual" 
                      className="max-h-48 rounded-xl border border-slate-700 object-contain shadow-md"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>

              {/* Next Question Button */}
              <div className="text-right pt-2">
                <button
                  onClick={handleNextQuestion}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black text-base px-8 py-4 rounded-2xl shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 ml-auto"
                >
                  <span>Siguiente Pregunta</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
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
            <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/20 border-2 border-amber-500/40 text-amber-400 flex items-center justify-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
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
                <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-full bg-purple-600/50 border-4 border-purple-400 flex items-center justify-center text-purple-300 shrink-0 shadow-2xl ring-4 ring-purple-500/30">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
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
              <span className="text-3xl font-black text-orange-400 flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
                <span>{maxStreak}</span>
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
              onClick={() => setShowSolucionario(true)}
              className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-base px-8 py-4 rounded-2xl shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Ver Solucionario y Resolución</span>
            </button>

            <button
              onClick={() => {
                setGameState('LOBBY');
                setUserScore(0);
                setStreak(0);
                setMaxStreak(0);
                setAnswers({});
                setShowSolucionario(false);
                setSolucionarioFilter('ALL');
                setPowerUps({
                  fiftyFifty: true,
                  freezeTime: true,
                  doublePoints: true,
                  secondChance: true
                });
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white font-black text-base px-8 py-4 rounded-2xl shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Jugar de Nuevo</span>
            </button>

            <button
              onClick={onBack}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-base px-8 py-4 rounded-2xl border border-slate-700 transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Volver a los Temas</span>
            </button>
          </div>
        </div>
      )}

      {/* SOLUCIONARIO MODAL */}
      {showSolucionario && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-4 md:p-8 overflow-y-auto animate-fade-in">
          <div className="max-w-4xl w-full mx-auto space-y-6 py-6 my-auto">
            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-10">
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-amber-400 block mb-1">
                  Solucionario y Resolución
                </span>
                <h2 className="text-2xl font-black text-white">{title}</h2>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  Revisa cada pregunta, tus respuestas y las explicaciones detalladas.
                </p>
              </div>

              <button
                onClick={() => setShowSolucionario(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-black px-5 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-2 text-sm shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Cerrar Solucionario</span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-center gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800 max-w-md mx-auto shadow-lg">
              <button
                onClick={() => setSolucionarioFilter('ALL')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all ${
                  solucionarioFilter === 'ALL'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas ({questions.length})
              </button>
              <button
                onClick={() => setSolucionarioFilter('CORRECT')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all ${
                  solucionarioFilter === 'CORRECT'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Correctas ({correctCount})
              </button>
              <button
                onClick={() => setSolucionarioFilter('WRONG')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all ${
                  solucionarioFilter === 'WRONG'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Incorrectas ({questions.length - correctCount})
              </button>
            </div>

            {/* Questions List */}
            <div className="space-y-6">
              {(safeQuestions || [])
                .map((q, idx) => ({ q, idx }))
                .filter(({ q }) => {
                  if (!q || !q.id) return false;
                  const userAnswer = answers[q.id];
                  const isCorrect = userAnswer === q.correctIndex;
                  if (solucionarioFilter === 'CORRECT') return isCorrect;
                  if (solucionarioFilter === 'WRONG') return !isCorrect;
                  return true;
                })
                .map(({ q, idx }) => {
                  if (!q || !q.id) return null;
                  const userAnswer = answers[q.id];
                  const isAnswered = userAnswer !== undefined;
                  const isCorrect = userAnswer === q.correctIndex;
                  const reading = (readingTexts || []).find(r => Boolean(r && r.id && q.readingTextId && r.id === q.readingTextId));

                  return (
                    <div
                      key={q.id}
                      className={`bg-slate-900 border rounded-3xl p-6 shadow-2xl space-y-4 ${
                        isCorrect
                          ? 'border-emerald-500/40'
                          : isAnswered
                          ? 'border-rose-500/40'
                          : 'border-amber-500/40'
                      }`}
                    >
                      {/* Item Badge & Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                        <span className="text-xs font-black uppercase tracking-wider text-purple-300">
                          Pregunta {idx + 1} de {safeQuestions.length}
                        </span>

                        <span
                          className={`text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 ${
                            isCorrect
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : isAnswered
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {isCorrect ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              <span>Respuesta Correcta</span>
                            </>
                          ) : isAnswered ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <span>Respuesta Incorrecta</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Sin responder / Tiempo agotado</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Reading Text If Present */}
                      {reading && (
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                          <span className="text-xs font-black text-amber-300 uppercase tracking-widest block">
                            Lectura: {reading.title}
                          </span>
                          <p className="text-xs text-slate-300 italic whitespace-pre-wrap font-serif leading-relaxed">
                            {formatQuestionText(reading.content)}
                          </p>
                        </div>
                      )}

                      {/* Question Text FIRST */}
                      <div className="text-slate-100 text-base font-bold leading-relaxed whitespace-pre-wrap">
                        {formatQuestionText(q.questionText)}
                      </div>

                      {/* Question Image if present - ALWAYS AFTER (debajo) del enunciado */}
                      {q.imageUrl && (
                        <div className="flex justify-center my-3 max-w-lg mx-auto">
                          <img
                            src={q.imageUrl}
                            alt={`Imagen de pregunta ${idx + 1}`}
                            className="max-h-60 rounded-2xl border border-slate-700 object-contain shadow-lg bg-slate-950/60 p-1"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {/* Options List */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {q.options.map((option, optIdx) => {
                          const isOptionCorrect = optIdx === q.correctIndex;
                          const isUserPick = optIdx === userAnswer;
                          const optImg = q.optionsImageUrls?.[optIdx];

                          let styleClasses = 'bg-slate-800/60 border-slate-700 text-slate-300';
                          let badgeLabel = null;

                          if (isOptionCorrect) {
                            styleClasses = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 font-bold ring-2 ring-emerald-500/30';
                            badgeLabel = (
                              <span className="text-[10px] uppercase font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <span>Correcta</span>
                              </span>
                            );
                          } else if (isUserPick && !isOptionCorrect) {
                            styleClasses = 'bg-rose-950/80 border-rose-500 text-rose-200 font-bold ring-2 ring-rose-500/30';
                            badgeLabel = (
                              <span className="text-[10px] uppercase font-black bg-rose-500 text-white px-2 py-0.5 rounded-md shrink-0">
                                Tu Elección
                              </span>
                            );
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-sm transition-all ${styleClasses}`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-6 h-6 rounded-lg bg-slate-900/60 border border-slate-700/50 flex items-center justify-center text-xs font-black shrink-0">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="whitespace-pre-wrap">{parseHTMLTags(option)}</span>
                                {optImg && (
                                  <img src={optImg} alt="" className="h-8 object-contain rounded bg-white/10 p-0.5" referrerPolicy="no-referrer" />
                                )}
                              </div>
                              {badgeLabel}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation / Resolution */}
                      <div className="bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/30 p-4 rounded-2xl space-y-2 text-sm leading-relaxed mt-4">
                        <div className="flex items-center justify-between gap-2 border-b border-purple-500/20 pb-2 flex-wrap">
                          <div className="flex items-center gap-2 text-purple-300 font-black text-xs uppercase tracking-wider">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Explicación y Resolución:</span>
                          </div>
                          {onUpdateQuestion && (
                            <button
                              type="button"
                              onClick={() => setEditingQuestion(q)}
                              className="p-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 transition-all border border-purple-500/40 shadow-xs active:scale-95 cursor-pointer ml-auto flex items-center justify-center shrink-0"
                              title="Editar pregunta completa (enunciado, alternativas y solución)"
                              aria-label="Editar pregunta completa"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="text-slate-200 font-medium whitespace-pre-wrap">
                          {formatQuestionText(q.explanation || 'No hay explicación adicional registrada para esta pregunta.')}
                        </div>
                        {q.explanationImageUrl && (
                          <img
                            src={q.explanationImageUrl}
                            alt="Explicación visual"
                            className="max-h-56 rounded-xl border border-purple-500/40 mt-3 object-contain"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

              {(safeQuestions || []).filter(q => {
                if (!q || !q.id) return false;
                const userAnswer = answers[q.id];
                const isCorrect = userAnswer === q.correctIndex;
                if (solucionarioFilter === 'CORRECT') return isCorrect;
                if (solucionarioFilter === 'WRONG') return !isCorrect;
                return true;
              }).length === 0 && (
                <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 font-bold">
                  No se encontraron preguntas en este filtro.
                </div>
              )}
            </div>

            {/* Footer Close Button */}
            <div className="text-center pt-4 pb-8">
              <button
                onClick={() => setShowSolucionario(false)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-black text-base px-10 py-4 rounded-2xl shadow-xl transition-all transform hover:scale-105 active:scale-95"
              >
                Volver a Resumen de Resultados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* READING TEXT MODAL */}
      {showReadingModal && currentReadingText && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white max-w-2xl w-full rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-amber-300 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>{currentReadingText.title}</span>
              </h3>
              <button
                onClick={() => setShowReadingModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Cerrar modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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

      {/* EDIT RESOLUTION MODAL */}
      <EditResolutionModal
        question={editingQuestion}
        isOpen={Boolean(editingQuestion)}
        onClose={() => setEditingQuestion(null)}
        onSave={handleSaveResolution}
      />
    </div>
  );
};

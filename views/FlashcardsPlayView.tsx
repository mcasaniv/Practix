import React, { useState, useEffect, useRef } from 'react';
import { Flashcard } from '../types';

interface FlashcardsPlayViewProps {
  courseName: string;
  subjectName: string;
  topicName?: string;
  flashcards: Flashcard[];
  onFinish: (difficultyStats: Record<string, number>) => void;
  onBack: () => void;
  onUpdateCardDifficulty: (cardId: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD') => void;
}

const FlashcardsPlayView: React.FC<FlashcardsPlayViewProps> = ({
  courseName,
  subjectName,
  topicName,
  flashcards = [],
  onFinish,
  onBack,
  onUpdateCardDifficulty
}) => {
  const [currentCards, setCurrentCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  // Track categorization session ratings for current run
  const [ratings, setRatings] = useState<Record<string, 'EASY' | 'MEDIUM' | 'HARD'>>({});

  const cardRef = useRef<HTMLDivElement>(null);

  // Track filter key to only shuffle when course, subject, or topic changes
  const sessionKey = `${courseName}_${subjectName}_${topicName || ''}`;

  // Initialize and shuffle cards on key change
  useEffect(() => {
    if (flashcards.length > 0) {
      // Create a shuffled copy of flashcards
      const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
      setCurrentCards(shuffled);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setIsFinished(false);
      setRatings({});
    }
  }, [sessionKey]);

  // Typeset math in KaTeX when the card is shown or flipped
  useEffect(() => {
    let timerId: any = null;
    if (cardRef.current && (window as any).renderMathInElement) {
      timerId = setTimeout(() => {
        try {
          if (cardRef.current) {
            (window as any).renderMathInElement(cardRef.current, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false }
              ],
              throwOnError: false
            });
          }
        } catch (err) {
          console.error("Math render error in flashcards player: ", err);
        }
      }, 50);
    }
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [currentCardIndex, isFlipped, currentCards]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;

      const key = e.key;
      const code = e.code;

      if (code === 'Space') {
        e.preventDefault(); // Prevents page scrolling
        setIsFlipped(prev => !prev);
      } else {
        if (key === '1') {
          handleRate('EASY');
        } else if (key === '2') {
          handleRate('MEDIUM');
        } else if (key === '3') {
          handleRate('HARD');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentCardIndex, isFlipped, isFinished, currentCards]);

  if (flashcards.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-12 bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-3xl p-8 shadow-md">
        <span className="text-4xl">🎴</span>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-4 mb-2">Sin Tarjetas</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Aún no se han agregado flashcards para <strong className="text-indigo-600 dark:text-indigo-400">{subjectName}</strong>
          {topicName && <> (Tema: <strong className="text-gray-700 dark:text-gray-300">{topicName}</strong>)</>}.
        </p>
        <button 
          onClick={onBack}
          className="mx-auto block px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all"
        >
          Volver atrás
        </button>
      </div>
    );
  }

  if (currentCards.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
        <p className="text-sm text-gray-500 font-medium">Cargando tarjetas...</p>
      </div>
    );
  }

  const activeCard = currentCards[currentCardIndex];

  const handleRate = (difficulty: 'EASY' | 'MEDIUM' | 'HARD') => {
    if (!activeCard) return;

    // Save categorization back in parents/db
    onUpdateCardDifficulty(activeCard.id, difficulty);

    // Save locally for summary screen
    setRatings(prev => ({
      ...prev,
      [activeCard.id]: difficulty
    }));

    // Reset card flip & change index - IMMEDIATE and RESPONSIVE transition as requested
    setIsFlipped(false);
    
    if (currentCardIndex + 1 < currentCards.length) {
      setCurrentCardIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handleRestart = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setCurrentCards(shuffled);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsFinished(false);
    setRatings({});
  };

  const handleStudyOnlyIncorrect = () => {
    // Incorrect cards are those rated 'MEDIUM' (Casi) or 'HARD' (Difícil) in this session
    const filtered = flashcards.filter(c => {
      const sesRating = ratings[c.id];
      if (sesRating) {
        return sesRating === 'MEDIUM' || sesRating === 'HARD';
      }
      return c.difficulty === 'MEDIUM' || c.difficulty === 'HARD';
    });
    
    if (filtered.length > 0) {
      const shuffled = [...filtered].sort(() => Math.random() - 0.5);
      setCurrentCards(shuffled);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setIsFinished(false);
      setRatings({});
    }
  };

  // Render finish summary
  if (isFinished) {
    const totalCount = currentCards.length;
    const easyCount = Object.values(ratings).filter(r => r === 'EASY').length;
    const mediumCount = Object.values(ratings).filter(r => r === 'MEDIUM').length;
    const hardCount = Object.values(ratings).filter(r => r === 'HARD').length;
    
    // Weighted mastery formula: (EASY * 100% + MEDIUM * 50% + HARD * 0%) / Total count
    const percent = totalCount > 0 ? Math.round(((easyCount * 1.0 + mediumCount * 0.5) / totalCount) * 100) : 0;
    
    // SVG Gauge calculations
    const size = 150;
    const strokeWidth = 14;
    const center = size / 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 rounded-3xl p-8 border border-gray-100 dark:border-slate-800 shadow-xl animate-fade-in text-center">
        <span className="text-5xl block mb-2">🏆</span>
        <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-1">¡Sesión Completada!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Has completado {totalCount} tarjetas de <strong className="text-indigo-600 dark:text-indigo-400">{subjectName}</strong>
          {topicName && <> / <strong className="text-gray-700 dark:text-gray-300">{topicName}</strong></>}.
        </p>

        {/* Circular Chart - Dominio Percentage */}
        <div className="flex flex-col items-center justify-center my-6">
          <div className="relative" style={{ width: size, height: size }}>
            <svg className="w-full h-full transform -rotate-90">
              {/* Background track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                className="stroke-gray-100 dark:stroke-slate-800"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Colored progress line */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                className={`transition-all duration-1000 ease-out ${
                  percent >= 80 
                    ? 'stroke-emerald-500' 
                    : percent >= 50 
                      ? 'stroke-amber-500' 
                      : 'stroke-rose-500'
                }`}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            {/* Inner text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-gray-800 dark:text-white font-mono">{percent}%</span>
              <span className="text-[10px] uppercase font-black tracking-widest text-indigo-500 dark:text-indigo-400">Dominio</span>
            </div>
          </div>
          
          <div className="mt-4">
            <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
              percent >= 80 
                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' 
                : percent >= 50 
                  ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400' 
                  : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
            }`}>
              {percent >= 80 ? 'Dominio Excelente' : percent >= 50 ? 'Dominio Regular' : 'Por Mejorar'}
            </span>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-8">
          <div className="py-3 px-2 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/20 rounded-xl">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{easyCount}</div>
            <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Fácil</div>
          </div>
          <div className="py-3 px-2 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-900/20 rounded-xl">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{mediumCount}</div>
            <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Casi</div>
          </div>
          <div className="py-3 px-2 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-900/20 rounded-xl">
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">{hardCount}</div>
            <div className="text-[10px] uppercase font-bold text-rose-500 tracking-wider">Difícil</div>
          </div>
        </div>

        {/* Actions for study session end */}
        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          {/* Opción para estudiar incorrectas (Casi o Difícil) */}
          {(mediumCount + hardCount) > 0 ? (
            <button
              onClick={handleStudyOnlyIncorrect}
              className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all active:scale-95 shadow-md shadow-rose-200 dark:shadow-none uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <span>Repasar Incorrectas ({mediumCount + hardCount})</span>
            </button>
          ) : (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold py-2">
              🎉 ¡Felicidades! Memorizaste todo el mazo a la perfección.
            </div>
          )}

          {/* Opción para reiniciar mazo, o finalizar */}
          <div className="grid grid-cols-2 gap-3 mt-1 pt-4 border-t border-gray-105 dark:border-slate-800">
            <button
              onClick={handleRestart}
              className="py-3 px-4 bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-705 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
            >
              Reiniciar Mazo
            </button>
            <button
              onClick={onBack}
              className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
            >
              Finalizar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-2 animate-fade-in">
      {/* Header controls */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase tracking-wider mb-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Salir
          </button>
          <h2 className="text-xl font-black text-gray-800 dark:text-white leading-tight">
            Repasando: {subjectName}
            {topicName && <span className="text-indigo-600 dark:text-indigo-400 block sm:inline sm:ml-2 text-sm font-bold">({topicName})</span>}
          </h2>
        </div>
        
        {/* Live Mastery indicator */}
        <div className="text-center">
          <div className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 tracking-wider">Dominio Actual</div>
          <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-100 dark:border-emerald-950">
            {Object.keys(ratings).length > 0 
              ? `${Math.round(((Object.values(ratings).filter(r => r === 'EASY').length * 1.0 + Object.values(ratings).filter(r => r === 'MEDIUM').length * 0.5) / Object.keys(ratings).length) * 100)}%`
              : '0%'
            }
          </div>
        </div>
        
        {/* Progress indicator */}
        <div className="text-right">
          <div className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Progreso</div>
          <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono leading-7">
            {currentCardIndex + 1} / {currentCards.length}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-8">
        <div 
          className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
          style={{ width: `${((currentCardIndex + 1) / currentCards.length) * 100}%` }}
        />
      </div>

      {/* Dynamic 3D Flashcard container */}
      <div className="perspective-1000 w-full max-w-xl mx-auto h-[350px] mb-8 relative">
        <div 
          ref={cardRef}
          onClick={() => setIsFlipped(!isFlipped)}
          className={`w-full h-full transform-style-3d transition-transform duration-500 cursor-pointer absolute ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* FRONT FACE (Backface hidden) */}
          <div className="absolute inset-0 bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-950 rounded-3xl p-8 shadow-lg flex flex-col justify-between backface-hidden">
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase font-black text-indigo-400 tracking-widest bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded">
                Pregunta / Recto
              </span>
              {(activeCard?.topic || topicName) && (
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 max-w-[200px] truncate">
                  {activeCard?.topic || topicName}
                </span>
              )}
            </div>

            <div className="flex-grow flex items-center justify-center py-4 text-center">
              <div className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap selection:bg-indigo-100">
                {activeCard?.front}
              </div>
            </div>

            <div className="text-center text-xs text-indigo-400/80 dark:text-indigo-500/80 font-medium animate-pulse">
              Click o tecla Espacio para voltear 🔄
            </div>
          </div>

          {/* BACK FACE (Rotated 180 and Backface hidden) */}
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/20 to-indigo-100/5 dark:from-indigo-950/10 dark:to-indigo-950/30 border-2 border-dashed border-indigo-400 dark:border-indigo-800 rounded-3xl p-8 shadow-lg flex flex-col justify-between backface-hidden rotate-y-180">
            <div className="flex justify-between items-center">
              <span className="text-[9px] uppercase font-black text-amber-500 tracking-widest bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded">
                Respuesta / Verso
              </span>
              <span className="text-[10px] rounded uppercase font-bold text-gray-400 flex items-center gap-1">
                Anterior: {activeCard?.difficulty ? (
                  activeCard.difficulty === 'EASY' ? '🟢 Fácil' : activeCard.difficulty === 'MEDIUM' ? '🟡 Casi' : '🔴 Difícil'
                ) : 'Ninguno'}
              </span>
            </div>

            <div className="flex-grow flex items-center justify-center py-4 text-center">
              <div className="text-lg md:text-xl font-semibold text-indigo-950 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
                {activeCard?.back}
              </div>
            </div>

            <div className="text-center text-xs text-amber-500/80 font-medium">
              ¿Cuál fue la dificultad de esta tarjeta?
            </div>
          </div>
        </div>
      </div>

      {/* Control buttons & Keyboard hotkeys representation */}
      <div className="max-w-xl mx-auto space-y-5">
        {/* Toggle Flip button - always available and supports spacebar */}
        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className={`w-full py-4 ${isFlipped ? 'bg-indigo-100 text-indigo-700 dark:bg-slate-800 dark:text-indigo-400 hover:bg-indigo-200/60' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2`}
        >
          <span>{isFlipped ? 'Ocultar Respuesta' : 'Revelar Respuesta'}</span>
          <kbd className={`px-2 py-0.5 ${isFlipped ? 'bg-indigo-200 dark:bg-slate-700 text-indigo-800 dark:text-indigo-300' : 'bg-indigo-500 text-white'} rounded text-[10px] font-mono capitalize`}>Space</kbd>
        </button>

        {/* Rating Section - Always visible! */}
        <div className="space-y-2 mt-4">
          <div className="text-center text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Calificar Tarjeta (Inmediato)
          </div>
          <div className="grid grid-cols-3 gap-3">
            {/* FACIL (Key 1) */}
            <button
              onClick={() => handleRate('EASY')}
              className="py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-0.5 border-b-4 border-emerald-800"
            >
              <span className="text-sm">Fácil</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-emerald-500/50 rounded text-[9px] font-mono">Teclado 1</kbd>
            </button>

            {/* CASI (Key 2) */}
            <button
              onClick={() => handleRate('MEDIUM')}
              className="py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-md transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-0.5 border-b-4 border-amber-700"
            >
              <span className="text-sm">Casi</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-amber-400/50 rounded text-[9px] font-mono">Teclado 2</kbd>
            </button>

            {/* DIFICIL (Key 3) */}
            <button
              onClick={() => handleRate('HARD')}
              className="py-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-md transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-0.5 border-b-4 border-rose-800"
            >
              <span className="text-sm">Difícil</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-rose-500/50 rounded text-[9px] font-mono">Teclado 3</kbd>
            </button>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8 leading-relaxed max-w-sm mx-auto">
        Tip: Puedes usar las teclas <kbd className="px-1.5 py-0.2 bg-gray-100 dark:bg-slate-800 rounded font-mono border">Espacio</kbd> para voltear la tarjeta y <kbd className="px-1.5 py-0.1 bg-gray-100 dark:bg-slate-800 rounded font-mono border">1</kbd>, <kbd className="px-1.5 py-0.1 bg-gray-100 dark:bg-slate-800 rounded font-mono border">2</kbd> o <kbd className="px-1.5 py-0.1 bg-gray-100 dark:bg-slate-800 rounded font-mono border">3</kbd> para calificarla sin tocar el mouse.
      </div>
    </div>
  );
};

export default FlashcardsPlayView;

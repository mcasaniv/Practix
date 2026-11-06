import React, { useState, useEffect, useRef } from 'react';
import { Flashcard, OcclusionBox } from '../types';
import { formatQuestionText, FormulaTokenRenderer } from '../utils';
import { soundController } from '../utils/soundEffects';

interface FlashcardsPlayViewProps {
  courseName: string;
  subjectName: string;
  topicName?: string;
  flashcards: Flashcard[];
  onFinish: (difficultyStats: Record<string, number>) => void;
  onBack: () => void;
  onUpdateCardDifficulty: (cardId: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD') => void;
}

// Text normalization for grading: removes accents, symbols, extra spaces and casing
const normalizeAnswer = (text: string) => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const isAnswerCorrect = (typed: string, target: string) => {
  const normTyped = normalizeAnswer(typed);
  const normTarget = normalizeAnswer(target);
  if (!normTyped) return false;
  if (normTyped === normTarget) return true;

  // Split target if it has alternatives (e.g. "Ventrículo izquierdo / VI")
  const options = target.split(/[/,;]/).map(t => normalizeAnswer(t)).filter(Boolean);
  if (options.some(opt => opt === normTyped)) return true;

  // Check 1-char typo tolerance for words >= 5 characters
  if (Math.abs(normTyped.length - normTarget.length) <= 1 && normTarget.length >= 5) {
    let diff = 0;
    for (let i = 0, j = 0; i < normTyped.length && j < normTarget.length; ) {
      if (normTyped[i] !== normTarget[j]) {
        diff++;
        if (normTyped.length > normTarget.length) i++;
        else if (normTarget.length > normTyped.length) j++;
        else { i++; j++; }
      } else {
        i++; j++;
      }
    }
    if (diff <= 1) return true;
  }

  return false;
};

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
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Track categorization session ratings for current run
  const [ratings, setRatings] = useState<Record<string, 'EASY' | 'MEDIUM' | 'HARD'>>({});

  // Check if current deck has image occlusion cards
  const hasOcclusionCards = flashcards.some(c => 
    c.type === 'IMAGE_OCCLUSION' || Boolean(c.imageUrl && c.occlusionBoxes && c.occlusionBoxes.length > 0)
  );

  // Image Occlusion states
  const [occlusionPlayMode, setOcclusionPlayMode] = useState<'REVEAL' | 'TYPE'>('REVEAL');
  const [showOcclusionModalPrompt, setShowOcclusionModalPrompt] = useState<boolean>(() => hasOcclusionCards);
  const [selectedModeInPrompt, setSelectedModeInPrompt] = useState<'REVEAL' | 'TYPE'>('REVEAL');
  const [userTypedAnswer, setUserTypedAnswer] = useState<string>('');
  const [evaluation, setEvaluation] = useState<{
    isCorrect: boolean;
    userTyped: string;
    expected: string;
    isRevealedOnly?: boolean;
  } | null>(null);
  const [showUnmaskedImage, setShowUnmaskedImage] = useState<boolean>(false);
  const [selectedBoxOverride, setSelectedBoxOverride] = useState<string | null>(null);
  // Track answered occlusion boxes so they stay revealed for the remainder of the session
  const [answeredBoxIds, setAnsweredBoxIds] = useState<Set<string>>(new Set());
  const handleDirectRevealRef = useRef<() => void>(() => {});

  // Formula Builder states
  const [placedFormulaBlocks, setPlacedFormulaBlocks] = useState<{ id: string; text: string }[]>([]);
  const [availableFormulaBlocks, setAvailableFormulaBlocks] = useState<{ id: string; text: string }[]>([]);
  const [formulaEvaluation, setFormulaEvaluation] = useState<{
    isCorrect: boolean;
    assembled: string;
    expected: string;
  } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setIsTransitioning(false);
      setRatings({});
      setUserTypedAnswer('');
      setEvaluation(null);
      setShowUnmaskedImage(false);
      setSelectedBoxOverride(null);
      setAnsweredBoxIds(new Set());
      setPlacedFormulaBlocks([]);
      setAvailableFormulaBlocks([]);
      setFormulaEvaluation(null);
      if (hasOcclusionCards) {
        setShowOcclusionModalPrompt(true);
        setSelectedModeInPrompt('REVEAL');
      }
    }
  }, [sessionKey]);

  // Reset occlusion input and formula builder bank when navigating cards
  useEffect(() => {
    setUserTypedAnswer('');
    setEvaluation(null);
    setShowUnmaskedImage(false);
    setSelectedBoxOverride(null);
    setFormulaEvaluation(null);
    setPlacedFormulaBlocks([]);

    const card = currentCards[currentCardIndex];
    if (card && card.type === 'FORMULA_BUILDER') {
      const correctTokens = card.formulaTokens || [];
      const distractors = card.formulaDistractors || [];
      const combined = [...correctTokens, ...distractors];
      const blocks = combined.map((text, idx) => ({
        id: `${text}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        text
      }));
      // Shuffle bank
      setAvailableFormulaBlocks([...blocks].sort(() => Math.random() - 0.5));
    } else {
      setAvailableFormulaBlocks([]);
    }

    if (inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [currentCardIndex, currentCards]);

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

  const activeCard = currentCards[currentCardIndex];
  const isFormulaCard = Boolean(activeCard && activeCard.type === 'FORMULA_BUILDER');
  const isImageCard = Boolean(
    activeCard && (activeCard.type === 'IMAGE_OCCLUSION' || (activeCard.imageUrl && activeCard.occlusionBoxes && activeCard.occlusionBoxes.length > 0))
  );

  const handleRate = (difficulty: 'EASY' | 'MEDIUM' | 'HARD') => {
    if (!activeCard || isTransitioning) return;

    // Save categorization back in parents/db
    onUpdateCardDifficulty(activeCard.id, difficulty);

    // Save locally for summary screen
    setRatings(prev => ({
      ...prev,
      [activeCard.id]: difficulty
    }));

    // Start transitioning back (flipping to front face) before changing the card index
    setIsFlipped(false);
    setIsTransitioning(true);
    
    setTimeout(() => {
      if (currentCardIndex + 1 < currentCards.length) {
        setCurrentCardIndex(prev => prev + 1);
      } else {
        setIsFinished(true);
      }
      setIsTransitioning(false);
    }, 300); // 300ms transition delay ensures back face is turned away/hidden, making it extremely clean
  };

  const handleRestart = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setCurrentCards(shuffled);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsFinished(false);
    setIsTransitioning(false);
    setRatings({});
    setAnsweredBoxIds(new Set());
    if (hasOcclusionCards) {
      setShowOcclusionModalPrompt(true);
      setSelectedModeInPrompt(occlusionPlayMode);
    }
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
      setIsTransitioning(false);
      setRatings({});
      setAnsweredBoxIds(new Set());
    }
  };

  // Keyboard controls with Enter advancement for Image Occlusion (called unconditionally)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished || isTransitioning || !activeCard) return;

      if (showOcclusionModalPrompt) {
        if (e.key === 'Enter') {
          e.preventDefault();
          setOcclusionPlayMode(selectedModeInPrompt);
          setShowOcclusionModalPrompt(false);
        }
        return;
      }

      const targetTag = (e.target as HTMLElement)?.tagName;
      const isInput = targetTag === 'INPUT' || targetTag === 'TEXTAREA';

      // If occlusion card is evaluated, keys 1, 2, 3 rate difficulty!
      if (isImageCard && evaluation !== null) {
        if (e.key === '1') {
          e.preventDefault();
          handleRate('EASY');
          return;
        } else if (e.key === '2') {
          e.preventDefault();
          handleRate('MEDIUM');
          return;
        } else if (e.key === '3') {
          e.preventDefault();
          handleRate('HARD');
          return;
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleRate('EASY');
          return;
        }
      }

      // If formula card is evaluated, Enter advances
      if (formulaEvaluation !== null && e.key === 'Enter') {
        e.preventDefault();
        handleRate(formulaEvaluation.isCorrect ? 'EASY' : 'HARD');
        return;
      }

      // In Image Occlusion when in REVEAL mode, Space or Enter triggers direct reveal
      if (isImageCard && occlusionPlayMode === 'REVEAL' && evaluation === null) {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          handleDirectRevealRef.current();
          return;
        }
      }

      // If user is currently typing in an input and card is not yet evaluated, allow typing
      if (isInput) {
        return;
      }

      // Backspace undo for formula builder when not typing in an input
      if (e.key === 'Backspace' && activeCard.type === 'FORMULA_BUILDER' && !formulaEvaluation) {
        setPlacedFormulaBlocks(prev => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          setAvailableFormulaBlocks(avail => [...avail, last]);
          return prev.slice(0, -1);
        });
        return;
      }

      const key = e.key;
      const code = e.code;

      if (!isFormulaCard && !isImageCard) {
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentCardIndex, isFlipped, isFinished, currentCards, isTransitioning, evaluation, formulaEvaluation, activeCard, isFormulaCard, isImageCard, showOcclusionModalPrompt, selectedModeInPrompt, occlusionPlayMode]);

  if (flashcards.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-12 bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-3xl p-8 shadow-md">
        <div className="w-12 h-12 mx-auto text-indigo-500 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
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
        <div className="w-16 h-16 mx-auto mb-2 text-amber-500 bg-amber-50 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
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
              ¡Felicidades! Memorizaste todo el mazo a la perfección.
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

  // Dynamic font sizing based on card text length to prevent text from overflowing the card
  const getBackFontSize = (text: string) => {
    const len = text ? text.length : 0;
    if (len > 350) return 'text-xs sm:text-sm leading-relaxed';
    if (len > 200) return 'text-sm sm:text-base leading-relaxed';
    if (len > 90) return 'text-base sm:text-lg leading-relaxed';
    return 'text-lg sm:text-xl md:text-2xl leading-relaxed';
  };

  const getFrontFontSize = (text: string) => {
    const len = text ? text.length : 0;
    if (len > 350) return 'text-xs sm:text-sm leading-snug';
    if (len > 200) return 'text-sm sm:text-base leading-normal';
    if (len > 90) return 'text-base sm:text-lg leading-relaxed';
    return 'text-xl sm:text-2xl md:text-3xl leading-relaxed';
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-2 animate-fade-in relative">
      {/* Modal: Preguntar al usuario cómo quiere jugar en Oclusión de Imagen */}
      {showOcclusionModalPrompt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#000c19] border border-gray-100 dark:border-indigo-950/70 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-6 text-center space-y-5 animate-scale-up my-auto">
            {/* Header Icon & Title */}
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600 dark:bg-[#5950e7] text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                ¿Cómo deseas jugar en Oclusión de Imagen?
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                Este mazo incluye tarjetas con diagramas y partes ocultas. Selecciona tu modalidad favorita de repaso:
              </p>
            </div>

            {/* Mode selection cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {/* Option 1: Solo Revelar y Calificar */}
              <button
                type="button"
                onClick={() => setSelectedModeInPrompt('REVEAL')}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between text-left relative cursor-pointer ${
                  selectedModeInPrompt === 'REVEAL'
                    ? 'border-indigo-600 dark:border-[#5950e7] bg-indigo-50/60 dark:bg-indigo-950/40 ring-4 ring-indigo-500/20 shadow-md'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-[#000a14] hover:border-gray-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">👁️</span>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                      Recomendado
                    </span>
                  </div>
                  <div>
                    <div className="font-black text-sm text-gray-900 dark:text-white">
                      Modo Revelar
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                      Toca o presiona espacio para destapar la respuesta y califícate como <strong>Fácil</strong>, <strong>Casi</strong> o <strong>Difícil</strong>.
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                  <span>✓ Ágil, visual y sin teclado</span>
                </div>
              </button>

              {/* Option 2: Escribir Respuesta */}
              <button
                type="button"
                onClick={() => setSelectedModeInPrompt('TYPE')}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between text-left relative cursor-pointer ${
                  selectedModeInPrompt === 'TYPE'
                    ? 'border-indigo-600 dark:border-[#5950e7] bg-indigo-50/60 dark:bg-indigo-950/40 ring-4 ring-indigo-500/20 shadow-md'
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-[#000a14] hover:border-gray-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">✍️</span>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                      Teclado
                    </span>
                  </div>
                  <div>
                    <div className="font-black text-sm text-gray-900 dark:text-white">
                      Modo Escribir
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                      Escribe el nombre de la estructura con tu teclado para evaluar tu memoria y precisión ortográfica.
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                  <span>✓ Mayor exigencia y escritura</span>
                </div>
              </button>
            </div>

            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Podrás alternar de modo en cualquier momento durante la partida con el interruptor superior.
            </p>

            {/* Start Button */}
            <button
              type="button"
              onClick={() => {
                setOcclusionPlayMode(selectedModeInPrompt);
                setShowOcclusionModalPrompt(false);
              }}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 dark:from-[#5950e7] dark:to-purple-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Comenzar con Modo {selectedModeInPrompt === 'REVEAL' ? 'Revelar' : 'Escribir'}</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-black/25 rounded font-mono text-white">Enter ↵</kbd>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      )}

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

      {/* Formula Builder Player OR Image Occlusion Player OR Classic 3D Flashcard container */}
      {(() => {
        const isFormulaCard = Boolean(activeCard && activeCard.type === 'FORMULA_BUILDER');

        if (isFormulaCard && activeCard) {
          const handleBlockClickBank = (block: { id: string; text: string }) => {
            if (formulaEvaluation !== null) return;
            setAvailableFormulaBlocks(prev => prev.filter(b => b.id !== block.id));
            setPlacedFormulaBlocks(prev => [...prev, block]);
          };

          const handleBlockClickPlaced = (block: { id: string; text: string }) => {
            if (formulaEvaluation !== null) return;
            setPlacedFormulaBlocks(prev => prev.filter(b => b.id !== block.id));
            setAvailableFormulaBlocks(prev => [...prev, block]);
          };

          const handleClearPlaced = () => {
            if (formulaEvaluation !== null) return;
            setAvailableFormulaBlocks(prev => [...prev, ...placedFormulaBlocks]);
            setPlacedFormulaBlocks([]);
          };

          const handleUndoPlaced = () => {
            if (formulaEvaluation !== null || placedFormulaBlocks.length === 0) return;
            const last = placedFormulaBlocks[placedFormulaBlocks.length - 1];
            setPlacedFormulaBlocks(prev => prev.slice(0, -1));
            setAvailableFormulaBlocks(prev => [...prev, last]);
          };

          const handleGradeFormula = (e?: React.FormEvent) => {
            if (e) e.preventDefault();

            // If already evaluated, pressing Enter advances to next card
            if (formulaEvaluation !== null) {
              handleRate(formulaEvaluation.isCorrect ? 'EASY' : 'HARD');
              return;
            }

            if (placedFormulaBlocks.length === 0) return;

            const assembledStr = placedFormulaBlocks.map(b => b.text).join('');
            const expectedTokensStr = (activeCard.formulaTokens || []).join('');
            const expectedFull = activeCard.formulaFull || activeCard.back || expectedTokensStr;

            const cleanStr = (s: string) => {
              let res = s.replace(/\s+/g, '').toLowerCase().replace(/·|×/g, '*');
              // Normalize \frac{a}{b} -> a/b
              res = res.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');
              // Normalize unicode fractions to standard division
              const unicodeFracs: Record<string, string> = {
                '½': '1/2', '⅓': '1/3', '¼': '1/4', '¾': '3/4', '⅔': '2/3',
                '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6',
                '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
              };
              for (const [uni, frac] of Object.entries(unicodeFracs)) {
                res = res.split(uni).join(frac);
              }
              return res;
            };

            const isMatch = cleanStr(assembledStr) === cleanStr(expectedTokensStr) ||
                            cleanStr(assembledStr) === cleanStr(expectedFull);

            setFormulaEvaluation({
              isCorrect: isMatch,
              assembled: placedFormulaBlocks.map(b => b.text).join(' '),
              expected: expectedFull
            });

            if (isMatch) {
              soundController.playSuccess();
            } else {
              soundController.playError();
            }
          };

          return (
            <div className="w-full max-w-2xl mx-auto space-y-4 mb-8">
              <div className="bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-950 rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
                {/* Header Tag */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-black text-indigo-700 dark:text-indigo-300 tracking-widest bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/50 dark:border-indigo-800/50 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <span>🧩 Armar Fórmula con Bloques</span>
                    </span>
                    {(activeCard.topic || topicName) && (
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                        {activeCard.topic || topicName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Question / Enunciado with Integrated Image */}
                <div className="mb-5 bg-indigo-50/30 dark:bg-[#000a14] border border-indigo-100/70 dark:border-indigo-950/70 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-1 w-full">
                    <div className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider mb-1.5 flex items-center gap-1.5">
                      <span>Enunciado</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-gray-800 dark:text-gray-100 leading-snug">
                      {formatQuestionText(activeCard.front)}
                    </h3>
                  </div>

                  {Boolean(activeCard.imageUrl?.trim()) && (
                    <div className="shrink-0 max-w-full md:max-w-[250px] rounded-xl overflow-hidden border border-indigo-200/60 dark:border-indigo-900/60 bg-white dark:bg-black/40 p-1.5 flex items-center justify-center shadow-sm">
                      <img
                        src={activeCard.imageUrl?.trim()}
                        alt="Esquema o diagrama del enunciado"
                        className="max-h-44 md:max-h-36 object-contain rounded-lg"
                      />
                    </div>
                  )}
                </div>

                {/* Construction Line (Slot Area) */}
                <div className="space-y-2 mb-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider">
                      Tu Fórmula:
                    </span>
                    {placedFormulaBlocks.length > 0 && !formulaEvaluation && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleUndoPlaced}
                          className="text-xs font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors flex items-center gap-1"
                          title="Deshacer último bloque (o presiona Backspace)"
                        >
                          <span>↩ Deshacer</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleClearPlaced}
                          className="text-xs font-bold text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors"
                        >
                          Limpiar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="min-h-[76px] p-3.5 bg-gray-50/80 dark:bg-[#000c19] rounded-2xl border-2 border-dashed border-indigo-200/70 dark:border-indigo-800/80 flex flex-wrap items-center gap-2.5 transition-all">
                    {placedFormulaBlocks.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 select-none mx-auto py-2 flex items-center gap-2">
                        <span>👇</span>
                        <span>Toca los bloques de abajo en orden para construir la fórmula</span>
                      </p>
                    ) : (
                      placedFormulaBlocks.map((block) => (
                        <button
                          key={block.id}
                          type="button"
                          disabled={formulaEvaluation !== null}
                          onClick={() => handleBlockClickPlaced(block)}
                          className="px-3.5 py-2 bg-white dark:bg-[#001228] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-indigo-900 dark:text-white hover:text-rose-600 dark:hover:text-rose-300 border-2 border-b-4 border-indigo-300 dark:border-indigo-600 hover:border-rose-400 dark:hover:border-rose-500 rounded-xl font-mono text-base font-bold shadow-sm active:border-b-2 active:translate-y-0.5 transition-all select-none group flex items-center justify-center min-h-[46px]"
                          title="Toca para retirar el bloque"
                        >
                          <FormulaTokenRenderer text={block.text} size="md" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Available Blocks Bank */}
                <div className="space-y-2 mb-6">
                  <span className="text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                    Banco de Bloques Disponibles:
                  </span>

                  <div className="min-h-[64px] p-3.5 bg-white dark:bg-[#000a14] rounded-2xl border border-gray-200 dark:border-indigo-900/60 flex flex-wrap items-center gap-2.5">
                    {availableFormulaBlocks.length === 0 && placedFormulaBlocks.length > 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1 select-none">
                        Has colocado todos los bloques disponibles.
                      </p>
                    ) : (
                      availableFormulaBlocks.map((block) => (
                        <button
                          key={block.id}
                          type="button"
                          disabled={formulaEvaluation !== null}
                          onClick={() => handleBlockClickBank(block)}
                          className="px-4 py-2.5 bg-white dark:bg-[#000f20] hover:bg-indigo-50 dark:hover:bg-[#001838] text-gray-800 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 border-2 border-b-4 border-gray-200 dark:border-indigo-800/80 hover:border-indigo-300 dark:hover:border-indigo-500 rounded-xl font-mono text-base sm:text-lg font-bold shadow-sm active:border-b-2 active:translate-y-0.5 transition-all select-none cursor-pointer flex items-center justify-center min-h-[48px]"
                          title="Toca para agregar a la fórmula"
                        >
                          <FormulaTokenRenderer text={block.text} size="lg" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  {formulaEvaluation ? (
                    <button
                      type="button"
                      onClick={() => handleRate(formulaEvaluation.isCorrect ? 'EASY' : 'HARD')}
                      className="flex-1 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 dark:bg-[#5950e7] dark:hover:bg-[#4d44db] text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-md hover:shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[46px]"
                    >
                      <span className="text-white">Siguiente</span>
                      <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-black/25 rounded font-mono text-white">Enter ↵</kbd>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={placedFormulaBlocks.length === 0}
                      onClick={() => handleGradeFormula()}
                      className="flex-1 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 dark:bg-[#5950e7] dark:hover:bg-[#4d44db] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-md hover:shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[46px]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-white">Calificar Fórmula</span>
                    </button>
                  )}

                  {formulaEvaluation && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormulaEvaluation(null);
                      }}
                      className="py-3.5 px-5 bg-indigo-50 hover:bg-indigo-100 dark:bg-[#000c19] dark:hover:bg-[#00152b] text-indigo-700 dark:text-white border border-indigo-200/80 dark:border-indigo-800/80 font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 min-h-[46px]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-indigo-700 dark:text-white">Reintentar</span>
                    </button>
                  )}
                </div>

                {/* Grading Feedback Results */}
                {formulaEvaluation && (
                  <div className="mt-4 animate-fade-in">
                    {formulaEvaluation.isCorrect ? (
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-900 dark:text-emerald-100 shadow-md">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-lg shadow shrink-0">
                            ✓
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                              ¡Fórmula armada correctamente!
                            </h4>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono font-bold text-xs sm:text-sm text-emerald-700 dark:text-emerald-300">
                              {placedFormulaBlocks.map((b, i) => (
                                <span key={i} className="inline-flex items-center">
                                  <FormulaTokenRenderer text={b.text} size="sm" />
                                </span>
                              ))}
                            </div>
                            {activeCard.formulaExplanation && (
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-sans mt-1">
                                💡 {activeCard.formulaExplanation}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRate('EASY')}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
                        >
                          <span>Siguiente</span>
                          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-emerald-700/80 rounded font-mono text-white">↵ Enter</kbd>
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900 dark:text-rose-100 shadow-md">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black text-lg shadow shrink-0">
                            ✕
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-rose-800 dark:text-rose-200">
                              La fórmula no coincide
                            </h4>
                            <div className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 space-y-1">
                              <div className="flex flex-wrap items-center gap-1">
                                <span>Armaste:</span>
                                {placedFormulaBlocks.length > 0 ? (
                                  placedFormulaBlocks.map((b, i) => (
                                    <span key={i} className="inline-flex items-center px-1 py-0.5 bg-rose-100 dark:bg-rose-900/40 rounded">
                                      <FormulaTokenRenderer text={b.text} size="sm" />
                                    </span>
                                  ))
                                ) : (
                                  <span className="italic">(vacío)</span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                <span>Fórmula esperada:</span>
                                {(activeCard.formulaTokens && activeCard.formulaTokens.length > 0) ? (
                                  activeCard.formulaTokens.map((tok, i) => (
                                    <span key={i} className="inline-flex items-center px-1 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded font-bold">
                                      <FormulaTokenRenderer text={tok} size="sm" />
                                    </span>
                                  ))
                                ) : (
                                  <strong className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">{formulaEvaluation.expected}</strong>
                                )}
                              </div>
                            </div>
                            {activeCard.formulaExplanation && (
                              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                                💡 {activeCard.formulaExplanation}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRate('HARD')}
                          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
                        >
                          <span>Siguiente</span>
                          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-rose-700/80 rounded font-mono text-white">↵ Enter</kbd>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }

        const isImageCard = Boolean(
          activeCard && (activeCard.type === 'IMAGE_OCCLUSION' || (activeCard.imageUrl && activeCard.occlusionBoxes && activeCard.occlusionBoxes.length > 0))
        );

        if (isImageCard && activeCard) {
          const boxes = activeCard.occlusionBoxes || [];
          const currentTargetBoxId = activeCard.activeBoxId || selectedBoxOverride || boxes[0]?.id;
          const targetBox = boxes.find(b => b.id === currentTargetBoxId) || boxes[0];

          const handleDirectReveal = () => {
            if (evaluation !== null) {
              handleRate('EASY');
              return;
            }
            const expected = targetBox ? targetBox.correctAnswer : activeCard.back;
            setEvaluation({
              isCorrect: true,
              userTyped: '',
              expected,
              isRevealedOnly: true
            });
            if (targetBox) {
              setAnsweredBoxIds(prev => new Set(prev).add(targetBox.id));
            }
            soundController.playSuccess();
          };
          handleDirectRevealRef.current = handleDirectReveal;

          const handleGradeOcclusion = (e?: React.FormEvent) => {
            if (e) e.preventDefault();

            // If already evaluated, pressing Enter or submitting advances to the next question
            if (evaluation !== null) {
              handleRate(evaluation.isCorrect ? 'EASY' : 'HARD');
              return;
            }

            if (!userTypedAnswer.trim() || !activeCard) return;

            const expected = targetBox ? targetBox.correctAnswer : activeCard.back;
            const isCorrect = isAnswerCorrect(userTypedAnswer, expected);

            setEvaluation({
              isCorrect,
              userTyped: userTypedAnswer.trim(),
              expected,
              isRevealedOnly: false
            });

            // Mark this box as answered so it stays revealed for the remainder of the session
            if (targetBox) {
              setAnsweredBoxIds(prev => new Set(prev).add(targetBox.id));
            }

            if (isCorrect) {
              soundController.playSuccess();
            } else {
              soundController.playError();
            }
          };

          return (
            <div className="w-full max-w-2xl mx-auto space-y-4 mb-8">
              {/* Card Container */}
              <div className="bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-950 rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
                {/* Header controls */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-black text-indigo-700 dark:text-indigo-300 tracking-widest bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/50 dark:border-indigo-800/50 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Oclusión de Imagen</span>
                    </span>
                    {targetBox?.label && (
                      <span className="text-xs font-bold text-gray-600 dark:text-indigo-200">
                        Objetivo: <strong className="text-indigo-600 dark:text-indigo-400">{targetBox.label}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Play Mode Switch: Solo Revelar vs Escribir Respuesta */}
                    <div className="flex items-center bg-gray-100 dark:bg-[#000a14] p-0.5 rounded-xl border border-gray-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setOcclusionPlayMode('REVEAL')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 ${
                          occlusionPlayMode === 'REVEAL'
                            ? 'bg-indigo-600 dark:bg-[#5950e7] text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                        title="Juega solo revelando el cuadro que tapa la respuesta"
                      >
                        <span>👁️ Solo Revelar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOcclusionPlayMode('TYPE');
                          setTimeout(() => inputRef.current?.focus(), 50);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 ${
                          occlusionPlayMode === 'TYPE'
                            ? 'bg-indigo-600 dark:bg-[#5950e7] text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                        title="Escribe la respuesta con el teclado"
                      >
                        <span>✍️ Escribir</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModeInPrompt(occlusionPlayMode);
                        setShowOcclusionModalPrompt(true);
                      }}
                      className="p-1.5 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-300 hover:bg-gray-100 dark:hover:bg-[#00142b] rounded-xl transition-all"
                      title="Configurar modo de juego"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowUnmaskedImage(!showUnmaskedImage)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:underline flex items-center gap-1 bg-indigo-50/70 dark:bg-indigo-950/60 border border-indigo-200/50 dark:border-indigo-800/60 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>{showUnmaskedImage ? 'Tapar' : 'Ver original'}</span>
                    </button>
                  </div>
                </div>

                {/* Instruction / Front text */}
                <h3 className="text-base sm:text-lg font-black text-gray-800 dark:text-gray-100 mb-3">
                  {activeCard.front || 'Identifica la estructura oculta en el cuadro blanco:'}
                </h3>

                {/* Occluded Image Canvas */}
                <div className="relative border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-gray-950/5 dark:bg-black/20 flex items-center justify-center p-1 sm:p-2 select-none min-h-[220px]">
                  <div className="relative inline-block max-w-full">
                    {activeCard.imageUrl?.trim() ? (
                      <img
                        src={activeCard.imageUrl.trim()}
                        alt="Diagrama con oclusión"
                        className="block max-h-[380px] w-auto max-w-full object-contain rounded-xl"
                        referrerPolicy="no-referrer"
                        draggable={false}
                      />
                    ) : (
                      <div className="p-8 text-center text-xs text-gray-400">
                        No hay imagen cargada para esta tarjeta
                      </div>
                    )}

                    {/* Occlusion Boxes */}
                    {boxes.map((box, idx) => {
                      const isTarget = box.id === currentTargetBoxId;

                      if (showUnmaskedImage) {
                        return (
                          <div
                            key={box.id}
                            style={{
                              left: `${box.x}%`,
                              top: `${box.y}%`,
                              width: `${box.width}%`,
                              height: `${box.height}%`
                            }}
                            className="absolute border border-indigo-400/40 rounded pointer-events-none"
                          />
                        );
                      }

                      if (isTarget) {
                        // Evaluated state: Remove solid mask so underlying graphic is visible, show outline & answer
                        if (evaluation) {
                          return (
                            <div
                              key={box.id}
                              style={{
                                left: `${box.x}%`,
                                top: `${box.y}%`,
                                width: `${box.width}%`,
                                height: `${box.height}%`
                              }}
                              className={`absolute rounded pointer-events-none z-30 transition-all border-2 flex items-center justify-center ${
                                evaluation.isRevealedOnly
                                  ? 'border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-400/30'
                                  : evaluation.isCorrect
                                    ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-400/30'
                                    : 'border-rose-500 bg-rose-500/15 ring-2 ring-rose-400/30'
                              }`}
                            >
                              <span
                                className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-black text-white shadow-md flex items-center gap-1 whitespace-nowrap z-40 ${
                                  evaluation.isRevealedOnly
                                    ? 'bg-indigo-600'
                                    : evaluation.isCorrect
                                      ? 'bg-emerald-600'
                                      : 'bg-rose-600'
                                }`}
                              >
                                {evaluation.isRevealedOnly
                                  ? `👁️ ${box.correctAnswer}`
                                  : evaluation.isCorrect
                                    ? `✓ ${box.correctAnswer}`
                                    : `✗ ${box.correctAnswer}`
                                }
                              </span>
                            </div>
                          );
                        }

                        // Target Box waiting for user action (touch to reveal or type)
                        return (
                          <div
                            key={box.id}
                            onClick={() => {
                              if (occlusionPlayMode === 'REVEAL') {
                                handleDirectReveal();
                              } else {
                                inputRef.current?.focus();
                              }
                            }}
                            style={{
                              left: `${box.x}%`,
                              top: `${box.y}%`,
                              width: `${box.width}%`,
                              height: `${box.height}%`
                            }}
                            className={`absolute bg-white opacity-100 rounded flex items-center justify-center p-1 text-center shadow-xl z-30 border-2 border-dashed border-indigo-600 ring-4 ring-indigo-500/40 select-none transition-all ${
                              occlusionPlayMode === 'REVEAL'
                                ? 'cursor-pointer hover:scale-[1.03] active:scale-95'
                                : 'cursor-text'
                            }`}
                            title={occlusionPlayMode === 'REVEAL' ? 'Toca para revelar la respuesta' : 'Escribe la respuesta en el campo de texto'}
                          >
                            <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow flex items-center gap-1">
                              {occlusionPlayMode === 'REVEAL' ? '👁️ ' : ''}{box.label || `?`}
                            </span>
                          </div>
                        );
                      }

                      // Non-target boxes:
                      if (answeredBoxIds.has(box.id)) {
                        return null;
                      }

                      // Non-target box mask
                      return (
                        <div
                          key={box.id}
                          onClick={() => {
                            setSelectedBoxOverride(box.id);
                            setUserTypedAnswer('');
                            setEvaluation(null);
                            if (occlusionPlayMode === 'TYPE') {
                              setTimeout(() => inputRef.current?.focus(), 50);
                            }
                          }}
                          style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            width: `${box.width}%`,
                            height: `${box.height}%`
                          }}
                          className="absolute bg-white opacity-100 rounded flex items-center justify-center p-1 text-center shadow border border-gray-300 z-20 cursor-pointer hover:ring-2 hover:ring-indigo-300 transition-all select-none"
                          title={`Cuadro ${box.label || (idx + 1)}. Clic para seleccionar este`}
                        >
                          <span className="text-[10px] font-bold text-gray-500">
                            {box.label || `#${idx + 1}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Controls Section: REVEAL MODE vs TYPE MODE */}
                {occlusionPlayMode === 'REVEAL' ? (
                  /* SOLO REVELAR MODE */
                  <div className="mt-4">
                    {!evaluation ? (
                      <div className="flex flex-col sm:flex-row items-center gap-2.5">
                        <button
                          type="button"
                          onClick={handleDirectReveal}
                          className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 dark:from-[#5950e7] dark:to-purple-600 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-2.5 min-h-[52px]"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>Tocar o Clic para Revelar Respuesta</span>
                          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] bg-black/30 rounded font-mono text-white">Espacio / Enter ↵</kbd>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 animate-fade-in">
                        {/* Structure Revealed Banner */}
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-400 dark:border-indigo-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-indigo-950 dark:text-indigo-100 shadow-md">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-600 dark:bg-[#5950e7] text-white flex items-center justify-center font-black text-lg shadow shrink-0">
                              👁️
                            </div>
                            <div>
                              <div className="text-[10px] uppercase font-black text-indigo-600 dark:text-indigo-400 tracking-wider">
                                Respuesta Oculta {targetBox?.label ? `(${targetBox.label})` : ''}
                              </div>
                              <div className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                                {evaluation.expected}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (targetBox) {
                                setAnsweredBoxIds(prev => {
                                  const next = new Set(prev);
                                  next.delete(targetBox.id);
                                  return next;
                                });
                              }
                              setEvaluation(null);
                            }}
                            className="py-2 px-3.5 bg-white dark:bg-[#000c19] hover:bg-gray-100 dark:hover:bg-[#00142b] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-800 font-bold text-xs rounded-xl transition-all self-start sm:self-auto shrink-0"
                            title="Ocultar de nuevo para volver a intentar"
                          >
                            Tapar de nuevo
                          </button>
                        </div>

                        {/* Rating Buttons: Fácil, Casi, Difícil */}
                        <div className="p-4 bg-gray-50/80 dark:bg-[#000a14] border border-gray-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                              ¿Cómo calificarías tu recuerdo?
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                              Atajos: 1 (Fácil), 2 (Casi), 3 (Difícil)
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            {/* Fácil Button */}
                            <button
                              type="button"
                              onClick={() => handleRate('EASY')}
                              className="py-3 px-2 sm:px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-md hover:shadow-emerald-500/20 transition-all active:scale-95 flex flex-col sm:flex-row items-center justify-center gap-1.5"
                            >
                              <div className="flex items-center gap-1">
                                <span className="text-base font-bold">✓</span>
                                <span>Fácil</span>
                              </div>
                              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-black/25 rounded font-mono text-white">1 / ↵</kbd>
                            </button>

                            {/* Casi Button */}
                            <button
                              type="button"
                              onClick={() => handleRate('MEDIUM')}
                              className="py-3 px-2 sm:px-4 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-md hover:shadow-amber-500/20 transition-all active:scale-95 flex flex-col sm:flex-row items-center justify-center gap-1.5"
                            >
                              <div className="flex items-center gap-1">
                                <span className="text-base font-bold">~</span>
                                <span>Casi</span>
                              </div>
                              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-black/25 rounded font-mono text-white">2</kbd>
                            </button>

                            {/* Difícil Button */}
                            <button
                              type="button"
                              onClick={() => handleRate('HARD')}
                              className="py-3 px-2 sm:px-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-md hover:shadow-rose-500/20 transition-all active:scale-95 flex flex-col sm:flex-row items-center justify-center gap-1.5"
                            >
                              <div className="flex items-center gap-1">
                                <span className="text-base font-bold">✗</span>
                                <span>Difícil</span>
                              </div>
                              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] bg-black/25 rounded font-mono text-white">3</kbd>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ESCRIBIR RESPUESTA MODE */
                  <>
                    <form onSubmit={handleGradeOcclusion} className="mt-4 space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <div className="relative flex-grow">
                          <input
                            ref={inputRef}
                            type="text"
                            value={userTypedAnswer}
                            onChange={(e) => setUserTypedAnswer(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && evaluation !== null) {
                                e.preventDefault();
                                handleRate(evaluation.isCorrect ? 'EASY' : 'HARD');
                              }
                            }}
                            placeholder={
                              evaluation 
                                ? "Presiona Enter ↵ para la siguiente pregunta..." 
                                : `Escribe aquí el nombre que oculta ${targetBox?.label || 'el cuadro blanco'}...`
                            }
                            readOnly={evaluation !== null}
                            className="w-full py-3.5 px-4 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700/80 bg-white dark:bg-[#000b17] text-gray-900 dark:text-white font-bold outline-none text-sm sm:text-base shadow-sm focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            autoFocus
                          />
                          {userTypedAnswer && !evaluation && (
                            <button
                              type="button"
                              onClick={() => setUserTypedAnswer('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-white p-1 rounded-lg transition-colors"
                              title="Limpiar texto"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div className="flex gap-2 shrink-0">
                          {evaluation ? (
                            <button
                              type="button"
                              onClick={() => handleRate(evaluation.isCorrect ? 'EASY' : 'HARD')}
                              className="flex-1 sm:flex-initial py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 dark:bg-[#5950e7] dark:hover:bg-[#4d44db] text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-md hover:shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[46px]"
                            >
                              <span className="text-white">Siguiente</span>
                              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-black/25 rounded font-mono text-white">Enter ↵</kbd>
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              type="submit"
                              disabled={!userTypedAnswer.trim()}
                              className="flex-1 sm:flex-initial py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 dark:bg-[#5950e7] dark:hover:bg-[#4d44db] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-md hover:shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[46px]"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-white">Calificar</span>
                            </button>
                          )}

                          {evaluation ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (targetBox) {
                                  setAnsweredBoxIds(prev => {
                                    const next = new Set(prev);
                                    next.delete(targetBox.id);
                                    return next;
                                  });
                                }
                                setEvaluation(null);
                                setUserTypedAnswer('');
                                setTimeout(() => inputRef.current?.focus(), 50);
                              }}
                              className="py-3.5 px-5 bg-indigo-50 hover:bg-indigo-100 dark:bg-[#000c19] dark:hover:bg-[#00152b] text-indigo-700 dark:text-white border border-indigo-200/80 dark:border-indigo-800/80 font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 min-h-[46px]"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span className="text-indigo-700 dark:text-white">Reintentar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const expected = targetBox ? targetBox.correctAnswer : activeCard.back;
                                setEvaluation({
                                  isCorrect: true,
                                  userTyped: userTypedAnswer.trim(),
                                  expected,
                                  isRevealedOnly: true
                                });
                                if (targetBox) {
                                  setAnsweredBoxIds(prev => new Set(prev).add(targetBox.id));
                                }
                                soundController.playSuccess();
                              }}
                              className="py-3.5 px-5 bg-indigo-50 hover:bg-indigo-100 dark:bg-[#000c19] dark:hover:bg-[#00152b] text-indigo-700 dark:text-white border border-indigo-200/80 dark:border-indigo-800/80 font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 min-h-[46px]"
                              title="Revelar respuesta oculta"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span className="text-indigo-700 dark:text-white">Revelar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </form>

                    {/* Grading Feedback Results in Type Mode */}
                    {evaluation && (
                      <div className="mt-3 animate-fade-in">
                        {evaluation.isRevealedOnly ? (
                          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-400 dark:border-indigo-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-indigo-950 dark:text-indigo-100 shadow-md">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-indigo-600 dark:bg-[#5950e7] text-white flex items-center justify-center font-black text-lg shadow shrink-0">
                                👁️
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-indigo-800 dark:text-indigo-200">
                                  Respuesta Oculta
                                </h4>
                                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                                  Nombre: <strong>{evaluation.expected}</strong>
                                </p>
                              </div>
                            </div>

                            {/* Rating buttons in Type Mode when revealed */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRate('EASY')}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95 flex items-center gap-1"
                              >
                                <span>Fácil</span>
                                <kbd className="hidden sm:inline-block px-1 py-0.5 text-[9px] bg-black/25 rounded font-mono text-white">1</kbd>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRate('MEDIUM')}
                                className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95 flex items-center gap-1"
                              >
                                <span>Casi</span>
                                <kbd className="hidden sm:inline-block px-1 py-0.5 text-[9px] bg-black/25 rounded font-mono text-white">2</kbd>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRate('HARD')}
                                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95 flex items-center gap-1"
                              >
                                <span>Difícil</span>
                                <kbd className="hidden sm:inline-block px-1 py-0.5 text-[9px] bg-black/25 rounded font-mono text-white">3</kbd>
                              </button>
                            </div>
                          </div>
                        ) : evaluation.isCorrect ? (
                          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-900 dark:text-emerald-100 shadow-md">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-base shadow">
                                ✓
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                                  ¡Respuesta Correcta! Excelente trabajo
                                </h4>
                                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                  Nombre exacto: <strong>{evaluation.expected}</strong>
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRate('EASY')}
                              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95 shrink-0 flex items-center gap-1.5"
                            >
                              <span>Siguiente (Fácil)</span>
                              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-emerald-700/80 rounded font-mono text-white">↵ Enter</kbd>
                            </button>
                          </div>
                        ) : (
                          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-400 dark:border-rose-700 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900 dark:text-rose-100 shadow-md">
                            <div className="flex items-start sm:items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black text-base shadow shrink-0">
                                ✗
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-rose-800 dark:text-rose-200">
                                  Respuesta no coincide
                                </h4>
                                <p className="text-xs text-rose-700 dark:text-rose-300">
                                  Escribiste: <span className="line-through font-semibold">{evaluation.userTyped}</span>
                                  <br className="sm:hidden" /> • Respuesta correcta: <strong className="text-emerald-700 dark:text-emerald-400 underline font-black">{evaluation.expected}</strong>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRate('HARD')}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95 flex items-center gap-1.5"
                              >
                                <span>Difícil</span>
                                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-rose-700/80 rounded font-mono text-white">↵ Enter</kbd>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRate('MEDIUM')}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95"
                              >
                                Casi
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        }

        // Standard 3D Flip Card for Text Flashcards
        return (
          <div className="perspective-1000 w-full max-w-xl mx-auto min-h-[350px] h-[370px] sm:h-[400px] mb-8 relative">
            <div 
              ref={cardRef}
              onClick={() => {
                if (isTransitioning) return;
                setIsFlipped(!isFlipped);
              }}
              className={`w-full h-full transform-style-3d transition-transform duration-500 cursor-pointer absolute ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* FRONT FACE (Backface hidden) */}
              <div className="absolute inset-0 bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-950 rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col justify-between backface-hidden overflow-hidden">
                <div className="flex justify-between items-center shrink-0">
                  <span className="text-[9px] uppercase font-black text-indigo-400 tracking-widest bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded">
                    Pregunta / Recto
                  </span>
                  {(activeCard?.topic || topicName) && (
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 max-w-[200px] truncate">
                      {activeCard?.topic || topicName}
                    </span>
                  )}
                </div>

                <div className="flex-grow min-h-0 flex items-center justify-center py-2 px-1 text-center my-auto overflow-y-auto overscroll-contain max-h-[250px] [scrollbar-width:thin] [scrollbar-color:rgba(99,102,241,0.3)_transparent]">
                  <div className={`w-full max-w-full font-bold text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap selection:bg-indigo-100 ${getFrontFontSize(activeCard?.front || '')}`}>
                    {formatQuestionText(activeCard?.front || '')}
                  </div>
                </div>

                <div className="text-center text-xs text-indigo-400/80 dark:text-indigo-500/80 font-medium animate-pulse flex items-center justify-center gap-1.5 shrink-0">
                  <span>Click o tecla Espacio para voltear</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              </div>

              {/* BACK FACE (Rotated 180 and Backface hidden) */}
              <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/20 to-indigo-100/5 dark:from-indigo-950/10 dark:to-indigo-950/30 border-2 border-dashed border-indigo-400 dark:border-indigo-800 rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col justify-between backface-hidden rotate-y-180 overflow-hidden">
                <div className="flex justify-between items-center shrink-0">
                  <span className="text-[9px] uppercase font-black text-amber-500 tracking-widest bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded">
                    Respuesta / Verso
                  </span>
                  <span className="text-[10px] rounded uppercase font-bold text-gray-400 flex items-center gap-1">
                    Anterior: {activeCard?.difficulty ? (
                      activeCard.difficulty === 'EASY' ? (
                        <span className="text-emerald-500 font-bold">Fácil</span>
                      ) : activeCard.difficulty === 'MEDIUM' ? (
                        <span className="text-amber-500 font-bold">Casi</span>
                      ) : (
                        <span className="text-rose-500 font-bold">Difícil</span>
                      )
                    ) : 'Ninguno'}
                  </span>
                </div>

                <div className="flex-grow min-h-0 flex items-center justify-center py-2 px-1 text-center my-auto overflow-y-auto overscroll-contain max-h-[250px] [scrollbar-width:thin] [scrollbar-color:rgba(99,102,241,0.3)_transparent]">
                  <div className={`w-full max-w-full font-semibold text-indigo-950 dark:text-slate-100 break-words whitespace-pre-wrap select-text ${getBackFontSize(activeCard?.back || '')}`}>
                    {formatQuestionText(activeCard?.back || '')}
                  </div>
                </div>

                <div className="text-center text-xs text-amber-500/80 font-medium shrink-0">
                  ¿Cuál fue la dificultad de esta tarjeta?
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Control buttons & Keyboard hotkeys representation (only for standard flip flashcards) */}
      {!isFormulaCard && !isImageCard && (
        <>
          <div className="max-w-xl mx-auto space-y-5">
            {/* Toggle Flip button - always available and supports spacebar */}
            <button
              onClick={() => {
                if (isTransitioning) return;
                setIsFlipped(!isFlipped);
              }}
              disabled={isTransitioning}
              className={`w-full py-4 ${isFlipped ? 'bg-indigo-100 text-indigo-700 dark:bg-slate-800 dark:text-indigo-400 hover:bg-indigo-200/60' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2`}
            >
              <span>{isFlipped ? 'Ocultar Respuesta' : 'Revelar Respuesta'}</span>
              <kbd className={`px-2 py-0.5 ${isFlipped ? 'bg-indigo-200 dark:bg-slate-700 text-indigo-800 dark:text-indigo-300' : 'bg-indigo-500 text-white'} rounded text-[10px] font-mono capitalize`}>Space</kbd>
            </button>

            {/* Rating Section - Always visible for classic flashcards */}
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
        </>
      )}
    </div>
  );
};

export default FlashcardsPlayView;

import React, { useState, useEffect, useRef } from 'react';
import { Flashcard, OcclusionBox } from '../types';
import { formatQuestionText } from '../utils';
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

  // Image Occlusion states
  const [userTypedAnswer, setUserTypedAnswer] = useState<string>('');
  const [evaluation, setEvaluation] = useState<{
    isCorrect: boolean;
    userTyped: string;
    expected: string;
  } | null>(null);
  const [showUnmaskedImage, setShowUnmaskedImage] = useState<boolean>(false);
  const [selectedBoxOverride, setSelectedBoxOverride] = useState<string | null>(null);

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
    }
  }, [sessionKey]);

  // Reset occlusion input when navigating cards
  useEffect(() => {
    setUserTypedAnswer('');
    setEvaluation(null);
    setShowUnmaskedImage(false);
    setSelectedBoxOverride(null);
    if (inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [currentCardIndex]);

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
      if (isFinished || isTransitioning) return;

      const targetTag = (e.target as HTMLElement)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') {
        return;
      }

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
  }, [currentCardIndex, isFlipped, isFinished, currentCards, isTransitioning]);

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

  const activeCard = currentCards[currentCardIndex];

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

      {/* Image Occlusion Player OR Classic 3D Flashcard container */}
      {(() => {
        const isImageCard = Boolean(
          activeCard && (activeCard.type === 'IMAGE_OCCLUSION' || (activeCard.imageUrl && activeCard.occlusionBoxes && activeCard.occlusionBoxes.length > 0))
        );

        if (isImageCard && activeCard) {
          const boxes = activeCard.occlusionBoxes || [];
          const currentTargetBoxId = activeCard.activeBoxId || selectedBoxOverride || boxes[0]?.id;
          const targetBox = boxes.find(b => b.id === currentTargetBoxId) || boxes[0];

          const handleGradeOcclusion = (e?: React.FormEvent) => {
            if (e) e.preventDefault();
            if (!userTypedAnswer.trim() || !activeCard) return;

            const expected = targetBox ? targetBox.correctAnswer : activeCard.back;
            const isCorrect = isAnswerCorrect(userTypedAnswer, expected);

            setEvaluation({
              isCorrect,
              userTyped: userTypedAnswer.trim(),
              expected
            });

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
                {/* Header tag */}
                <div className="flex items-center justify-between mb-3">
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

                  <button
                    type="button"
                    onClick={() => setShowUnmaskedImage(!showUnmaskedImage)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:underline flex items-center gap-1 bg-indigo-50/70 dark:bg-indigo-950/60 border border-indigo-200/50 dark:border-indigo-800/60 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>{showUnmaskedImage ? 'Tapar imagen' : 'Ver original'}</span>
                  </button>
                </div>

                {/* Instruction / Front text */}
                <h3 className="text-base sm:text-lg font-black text-gray-800 dark:text-gray-100 mb-3">
                  {activeCard.front || 'Identifica la estructura oculta en el cuadro blanco:'}
                </h3>

                {/* Occluded Image Canvas */}
                <div className="relative border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-gray-950/5 dark:bg-black/20 flex items-center justify-center p-1 sm:p-2 select-none min-h-[220px]">
                  <div className="relative inline-block max-w-full">
                    <img
                      src={activeCard.imageUrl}
                      alt="Diagrama con oclusión"
                      className="block max-h-[380px] w-auto max-w-full object-contain rounded-xl"
                      referrerPolicy="no-referrer"
                      draggable={false}
                    />

                    {/* Occlusion Boxes */}
                    {boxes.map((box, idx) => {
                      const isTarget = box.id === currentTargetBoxId;

                      if (showUnmaskedImage) {
                        // Reveal underlying image but outline box faintly
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
                        // Evaluated state
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
                              className={`absolute rounded flex items-center justify-center p-1 text-center shadow-2xl z-30 transition-all font-black text-xs ${
                                evaluation.isCorrect
                                  ? 'bg-emerald-500 text-white border-2 border-emerald-600 ring-4 ring-emerald-300/40'
                                  : 'bg-rose-500 text-white border-2 border-rose-600 ring-4 ring-rose-300/40'
                              }`}
                            >
                              <span className="truncate max-w-full font-black text-[11px] sm:text-xs">
                                {evaluation.isCorrect ? `✓ ${box.correctAnswer}` : `✗ ${box.correctAnswer}`}
                              </span>
                            </div>
                          );
                        }

                        // Target Box waiting for user input (Cuadro en blanco 100% opaco y sólido)
                        return (
                          <div
                            key={box.id}
                            onClick={() => inputRef.current?.focus()}
                            style={{
                              left: `${box.x}%`,
                              top: `${box.y}%`,
                              width: `${box.width}%`,
                              height: `${box.height}%`
                            }}
                            className="absolute bg-white opacity-100 rounded flex items-center justify-center p-1 text-center shadow-xl z-30 border-2 border-dashed border-indigo-600 ring-4 ring-indigo-500/40 cursor-text select-none"
                            title="Escribe la respuesta en el campo de texto"
                          >
                            <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow">
                              {box.label || `?`}
                            </span>
                          </div>
                        );
                      }

                      // Non-target boxes: 100% solid white mask covering the text
                      return (
                        <div
                          key={box.id}
                          onClick={() => {
                            setSelectedBoxOverride(box.id);
                            setUserTypedAnswer('');
                            setEvaluation(null);
                            setTimeout(() => inputRef.current?.focus(), 50);
                          }}
                          style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            width: `${box.width}%`,
                            height: `${box.height}%`
                          }}
                          className="absolute bg-white opacity-100 rounded flex items-center justify-center p-1 text-center shadow border border-gray-300 z-20 cursor-pointer hover:ring-2 hover:ring-indigo-300 transition-all select-none"
                          title={`Cuadro ${box.label || (idx + 1)}. Clic para responder este`}
                        >
                          <span className="text-[10px] font-bold text-gray-500">
                            {box.label || `#${idx + 1}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Form to write answer and grade */}
                <form onSubmit={handleGradeOcclusion} className="mt-4 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-grow">
                      <input
                        ref={inputRef}
                        type="text"
                        value={userTypedAnswer}
                        onChange={(e) => setUserTypedAnswer(e.target.value)}
                        placeholder={`Escribe aquí el nombre que oculta ${targetBox?.label || 'el cuadro blanco'}...`}
                        disabled={evaluation !== null}
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
                      {/* Button 1: Calificar */}
                      <button
                        type="submit"
                        disabled={!userTypedAnswer.trim() || evaluation !== null}
                        className="flex-1 sm:flex-initial py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 dark:bg-[#5950e7] dark:hover:bg-[#4d44db] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-md hover:shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[46px]"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-white">Calificar</span>
                      </button>

                      {/* Button 2: Reintentar o Revelar */}
                      {evaluation ? (
                        <button
                          type="button"
                          onClick={() => {
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
                              isCorrect: false,
                              userTyped: userTypedAnswer.trim() || '(Sin respuesta)',
                              expected
                            });
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

                {/* Grading Feedback Results */}
                {evaluation && (
                  <div className="mt-3 animate-fade-in">
                    {evaluation.isCorrect ? (
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
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95 shrink-0"
                        >
                          Siguiente (Fácil) →
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
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95"
                          >
                            Marcar Difícil
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

      {/* Control buttons & Keyboard hotkeys representation */}
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

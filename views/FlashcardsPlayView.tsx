import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Flashcard, OcclusionBox, MemoryGameMode } from '../types';
import { formatQuestionText, FormulaTokenRenderer, renderMathAndHtml } from '../utils';
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
  const hasOcclusionCards = useMemo(() => {
    return currentCards.some(c => 
      c.type === 'IMAGE_OCCLUSION' || Boolean(c.imageUrl && c.occlusionBoxes && c.occlusionBoxes.length > 0)
    );
  }, [currentCards]);

  // Image Occlusion states
  const [occlusionPlayMode, setOcclusionPlayMode] = useState<'REVEAL' | 'TYPE'>('REVEAL');
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

  // Memory Game Modes
  const [activeMemoryMode, setActiveMemoryMode] = useState<MemoryGameMode>('FLASHCARDS');

  // Match Mode States
  const [matchPool, setMatchPool] = useState<Flashcard[]>([]);
  const [matchPoolOffset, setMatchPoolOffset] = useState<number>(0);
  const [matchPairs, setMatchPairs] = useState<{ id: string; front: string; back: string; frontImageUrl?: string; backImageUrl?: string }[]>([]);
  const [matchLeftOrder, setMatchLeftOrder] = useState<string[]>([]);
  const [matchRightOrder, setMatchRightOrder] = useState<string[]>([]);
  const [matchedCardIds, setMatchedCardIds] = useState<Set<string>>(new Set());
  const [selectedMatch, setSelectedMatch] = useState<{ cardId: string; side: 'LEFT' | 'RIGHT' } | null>(null);
  const [matchMismatch, setMatchMismatch] = useState<{ leftId: string; rightId: string } | null>(null);
  const [matchMistakes, setMatchMistakes] = useState<number>(0);
  const [matchTotalMistakes, setMatchTotalMistakes] = useState<number>(0);
  const [matchZoomImageUrl, setMatchZoomImageUrl] = useState<string | null>(null);

  // Quiz Mode States
  const [quizScore, setQuizScore] = useState<number>(0);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [quizAnswered, setQuizAnswered] = useState<{ selectedOption: string; isCorrect: boolean } | null>(null);

  // Multi-Select Mode States
  const [multiCardIndex, setMultiCardIndex] = useState<number>(0);
  const [multiTiles, setMultiTiles] = useState<string[]>([]);
  const [multiCorrectSet, setMultiCorrectSet] = useState<Set<string>>(new Set());
  const [selectedMultiTiles, setSelectedMultiTiles] = useState<Set<string>>(new Set());
  const [multiEvaluated, setMultiEvaluated] = useState<boolean>(false);
  const [multiScore, setMultiScore] = useState<number>(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Start a specific match round of up to 6 cards from the pool
  const startMatchRound = (pool: Flashcard[], offset: number) => {
    const roundCards = pool.slice(offset, offset + 6);
    const pairs = roundCards.map(c => ({
      id: c.id,
      front: c.front,
      back: c.back,
      frontImageUrl: c.frontImageUrl || (c.type !== 'IMAGE_OCCLUSION' ? c.imageUrl : undefined),
      backImageUrl: c.backImageUrl
    }));
    setMatchPairs(pairs);
    setMatchLeftOrder(pairs.map(p => p.id).sort(() => Math.random() - 0.5));
    setMatchRightOrder(pairs.map(p => p.id).sort(() => Math.random() - 0.5));
    setMatchedCardIds(new Set());
    setSelectedMatch(null);
    setMatchMismatch(null);
    setMatchMistakes(0);
    setMatchZoomImageUrl(null);
  };

  // Match Mode initializer: shuffles entire deck and starts round 1
  const initMatchMode = (cards: Flashcard[]) => {
    const validCards = cards.filter(c => {
      if (c.type === 'IMAGE_OCCLUSION' || (c.occlusionBoxes && c.occlusionBoxes.length > 0)) return false;
      const hasFront = Boolean(c.front?.trim() || c.frontImageUrl || c.imageUrl);
      const hasBack = Boolean(c.back?.trim() || c.backImageUrl);
      return hasFront && hasBack;
    });
    const shuffledPool = [...validCards].sort(() => Math.random() - 0.5);
    setMatchPool(shuffledPool);
    setMatchPoolOffset(0);
    setMatchTotalMistakes(0);
    startMatchRound(shuffledPool, 0);
  };

  // Advance to next 6 cards (or remaining) without repetition
  const handleNextMatchRound = () => {
    const nextOffset = matchPoolOffset + 6;
    if (nextOffset < matchPool.length) {
      setMatchPoolOffset(nextOffset);
      startMatchRound(matchPool, nextOffset);
    }
  };

  // Helper generator for Quiz options
  const generateQuizOptions = (card: Flashcard, allCards: Flashcard[]): string[] => {
    let correctAnswer = card.back.trim();
    let occlusionDistractors: string[] = [];

    if (card.occlusionBoxes && card.occlusionBoxes.length > 0) {
      const targetBox = card.occlusionBoxes.find(b => b.id === (card.activeBoxId || card.occlusionBoxes![0].id)) || card.occlusionBoxes[0];
      if (targetBox?.correctAnswer?.trim()) {
        correctAnswer = targetBox.correctAnswer.trim();
      }
      occlusionDistractors = card.occlusionBoxes
        .filter(b => b.id !== targetBox?.id && b.correctAnswer?.trim() && b.correctAnswer.trim().toLowerCase() !== correctAnswer.toLowerCase())
        .map(b => b.correctAnswer.trim());
    }

    const otherAnswers = Array.from(new Set([
      ...occlusionDistractors,
      ...allCards
        .filter(c => c.id !== card.id && c.back?.trim() && c.back.trim().toLowerCase() !== correctAnswer.toLowerCase())
        .map(c => c.back.trim()),
      ...allCards.flatMap(c => c.occlusionBoxes ? c.occlusionBoxes.map(b => b.correctAnswer.trim()).filter(a => a && a.toLowerCase() !== correctAnswer.toLowerCase()) : [])
    ]));

    const shuffledOthers = [...otherAnswers].sort(() => Math.random() - 0.5).slice(0, 3);
    
    if (shuffledOthers.length < 3) {
      const fallbacks = [
        'Regula el intercambio de energía en reposo',
        'Se relaciona directamente con el gradiente de concentración',
        'Corresponde a la ley fundamental de conservación',
        'Aplica exclusivamente en condiciones estándar de presión y temperatura'
      ].filter(f => f.toLowerCase() !== correctAnswer.toLowerCase() && !shuffledOthers.includes(f));
      
      while (shuffledOthers.length < 3 && fallbacks.length > 0) {
        shuffledOthers.push(fallbacks.pop()!);
      }
    }

    return [correctAnswer, ...shuffledOthers].sort(() => Math.random() - 0.5);
  };

  // Helper generator for Multi-Select tiles
  const generateMultiSelect = (card: Flashcard, allCards: Flashcard[]): { targets: Set<string>; tiles: string[] } => {
    let targets: string[] = [];
    if (card.hasMultipleAnswers && card.multiAnswers && card.multiAnswers.length > 1) {
      targets = card.multiAnswers.map(a => a.trim()).filter(Boolean);
    } else if (card.multiAnswers && card.multiAnswers.length > 0) {
      targets = card.multiAnswers.map(a => a.trim()).filter(Boolean);
    } else {
      const raw = card.back.trim();
      targets = raw.split(/[,;\n\/]/).map(s => s.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
    }

    const targetSet = new Set(targets);
    const candidateDistractors: string[] = [];

    allCards.forEach(c => {
      if (c.id === card.id) return;
      if (c.hasMultipleAnswers && c.multiAnswers) {
        c.multiAnswers.forEach(a => candidateDistractors.push(a.trim()));
      }
      const split = c.back.split(/[,;\n\/]/).map(s => s.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
      split.forEach(s => {
        if (s.length <= 40) candidateDistractors.push(s);
      });
    });

    const isValenceLike = targets.some(t => /^[+-]?\d+$/.test(t) || /^(\+|-)[1-7]$/.test(t) || /^[IVXLCDM]+$/i.test(t));
    if (isValenceLike) {
      ['+1', '+2', '+3', '+4', '+5', '+6', '+7', '-1', '-2', '-3', '-4'].forEach(v => {
        if (!targetSet.has(v)) candidateDistractors.push(v);
      });
    }

    const uniqueDistractors = Array.from(new Set(candidateDistractors.filter(d => !targetSet.has(d))));
    const chosenDistractors = uniqueDistractors.sort(() => Math.random() - 0.5).slice(0, Math.max(4, 8 - targets.length));

    const combined = Array.from(new Set([...targets, ...chosenDistractors])).sort(() => Math.random() - 0.5);
    return {
      targets: targetSet,
      tiles: combined
    };
  };

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
      setQuizScore(0);
      setMultiScore(0);
      initMatchMode(shuffled);
    }
  }, [sessionKey]);

  // Reset occlusion input, formula builder bank, quiz, and multi-select when navigating cards
  useEffect(() => {
    setUserTypedAnswer('');
    setEvaluation(null);
    setShowUnmaskedImage(false);
    setSelectedBoxOverride(null);
    setFormulaEvaluation(null);
    setPlacedFormulaBlocks([]);

    const card = currentCards[currentCardIndex];
    if (card) {
      // Setup formula blocks if formula card
      if (card.type === 'FORMULA_BUILDER') {
        const correctTokens = card.formulaTokens || [];
        const distractors = card.formulaDistractors || [];
        const combined = [...correctTokens, ...distractors];
        const blocks = combined.map((text, idx) => ({
          id: `${text}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          text
        }));
        setAvailableFormulaBlocks([...blocks].sort(() => Math.random() - 0.5));
      } else {
        setAvailableFormulaBlocks([]);
      }

      // Setup Quiz options
      const qOptions = generateQuizOptions(card, currentCards);
      setQuizOptions(qOptions);
      setQuizAnswered(null);
    }

    if (inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [currentCardIndex, currentCards]);

  // Filter only questions with multiple answers enabled for Selección Múltiple mode
  const multiAnswerCards = useMemo(() => {
    return currentCards.filter(c => Boolean(c.hasMultipleAnswers && c.multiAnswers && c.multiAnswers.length > 1));
  }, [currentCards]);

  // Dedicated effect for Multi-Select mode
  useEffect(() => {
    if (activeMemoryMode === 'MULTI_SELECT' && multiAnswerCards.length === 0) {
      setActiveMemoryMode('FLASHCARDS');
      return;
    }

    if (multiAnswerCards.length > 0) {
      const card = multiAnswerCards[multiCardIndex] || multiAnswerCards[0];
      if (card) {
        const mResult = generateMultiSelect(card, currentCards);
        setMultiCorrectSet(mResult.targets);
        setMultiTiles(mResult.tiles);
        setSelectedMultiTiles(new Set());
        setMultiEvaluated(false);
      }
    }
  }, [activeMemoryMode, multiCardIndex, multiAnswerCards, currentCards]);

  // Auto-switch away from MATCH mode if playing image occlusion cards
  useEffect(() => {
    if (hasOcclusionCards && activeMemoryMode === 'MATCH') {
      setActiveMemoryMode('FLASHCARDS');
    }
  }, [hasOcclusionCards, activeMemoryMode]);

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
    setMultiCardIndex(0);
    setQuizScore(0);
    setMultiScore(0);
    setQuizAnswered(null);
    setSelectedMultiTiles(new Set());
    setMultiEvaluated(false);
    setIsFlipped(false);
    setIsFinished(false);
    setIsTransitioning(false);
    setRatings({});
    setAnsweredBoxIds(new Set());
  };

  // Match Mode click handler
  const handleMatchClick = (id: string, side: 'LEFT' | 'RIGHT') => {
    if (matchedCardIds.has(id)) return;
    if (!selectedMatch) {
      setSelectedMatch({ cardId: id, side });
      return;
    }
    if (selectedMatch.side === side) {
      setSelectedMatch({ cardId: id, side });
      return;
    }
    // Matching between opposite sides
    if (selectedMatch.cardId === id) {
      soundController.playSuccess();
      const updated = new Set(matchedCardIds).add(id);
      setMatchedCardIds(updated);
      setSelectedMatch(null);
      if (updated.size === matchPairs.length) {
        soundController.playFanfare();
      }
    } else {
      soundController.playIncorrect();
      setMatchMismatch({
        leftId: side === 'LEFT' ? id : selectedMatch.cardId,
        rightId: side === 'RIGHT' ? id : selectedMatch.cardId
      });
      setMatchMistakes(prev => prev + 1);
      setMatchTotalMistakes(prev => prev + 1);
      setTimeout(() => {
        setMatchMismatch(null);
        setSelectedMatch(null);
      }, 650);
    }
  };

  // Quiz Mode Option handler
  const handleQuizOptionClick = (opt: string) => {
    if (quizAnswered || !activeCard) return;
    let correctAnswer = activeCard.back.trim();
    if (activeCard.occlusionBoxes && activeCard.occlusionBoxes.length > 0) {
      const targetBox = activeCard.occlusionBoxes.find(b => b.id === (activeCard.activeBoxId || activeCard.occlusionBoxes![0].id)) || activeCard.occlusionBoxes[0];
      if (targetBox?.correctAnswer?.trim()) {
        correctAnswer = targetBox.correctAnswer.trim();
      }
    }
    const isCorrect = opt.trim().toLowerCase() === correctAnswer.toLowerCase();
    const diff = isCorrect ? 'EASY' : 'HARD';
    if (isCorrect) {
      soundController.playSuccess();
      setQuizScore(prev => prev + 1);
      onUpdateCardDifficulty(activeCard.id, 'EASY');
    } else {
      soundController.playIncorrect();
      onUpdateCardDifficulty(activeCard.id, 'HARD');
    }
    setRatings(prev => ({
      ...prev,
      [activeCard.id]: diff
    }));
    setQuizAnswered({ selectedOption: opt, isCorrect });
  };

  const handleNextQuizCard = () => {
    if (currentCardIndex + 1 < currentCards.length) {
      setCurrentCardIndex(prev => prev + 1);
      setQuizAnswered(null);
    } else {
      setIsFinished(true);
    }
  };

  // Multi-Select Tile handler
  const handleToggleMultiTile = (tile: string) => {
    if (multiEvaluated) return;
    setSelectedMultiTiles(prev => {
      const next = new Set(prev);
      if (next.has(tile)) {
        next.delete(tile);
      } else {
        next.add(tile);
      }
      return next;
    });
  };

  const handleCheckMultiSelect = () => {
    const activeMultiCard = multiAnswerCards[multiCardIndex] || multiAnswerCards[0];
    if (!activeMultiCard) return;
    setMultiEvaluated(true);
    let allTargetsPicked = true;
    let anyDistractorPicked = false;

    multiCorrectSet.forEach(t => {
      if (!selectedMultiTiles.has(t)) allTargetsPicked = false;
    });
    selectedMultiTiles.forEach(s => {
      if (!multiCorrectSet.has(s)) anyDistractorPicked = true;
    });

    const isSuccess = allTargetsPicked && !anyDistractorPicked;
    if (isSuccess) {
      soundController.playSuccess();
      setMultiScore(prev => prev + 1);
      onUpdateCardDifficulty(activeMultiCard.id, 'EASY');
    } else {
      soundController.playIncorrect();
      onUpdateCardDifficulty(activeMultiCard.id, 'HARD');
    }
    setRatings(prev => ({
      ...prev,
      [activeMultiCard.id]: isSuccess ? 'EASY' : 'HARD'
    }));
  };

  const handleNextMultiCard = () => {
    if (multiCardIndex + 1 < multiAnswerCards.length) {
      setMultiCardIndex(prev => prev + 1);
      setSelectedMultiTiles(new Set());
      setMultiEvaluated(false);
    } else {
      setIsFinished(true);
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
  }, [currentCardIndex, isFlipped, isFinished, currentCards, isTransitioning, evaluation, formulaEvaluation, activeCard, isFormulaCard, isImageCard, occlusionPlayMode]);

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
    const totalCount = activeMemoryMode === 'MULTI_SELECT' ? multiAnswerCards.length : currentCards.length;
    
    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;

    if (activeMemoryMode === 'QUIZ') {
      easyCount = quizScore;
      hardCount = Math.max(0, totalCount - quizScore);
    } else if (activeMemoryMode === 'MULTI_SELECT') {
      easyCount = multiScore;
      hardCount = Math.max(0, totalCount - multiScore);
    } else {
      // Regular Flashcards / Image Occlusion / Formula mode
      currentCards.forEach(c => {
        const r = ratings[c.id] || (c.difficulty as 'EASY' | 'MEDIUM' | 'HARD');
        if (r === 'EASY') easyCount++;
        else if (r === 'MEDIUM') mediumCount++;
        else if (r === 'HARD') hardCount++;
      });

      // Fallback if ratings were keyed otherwise
      if (easyCount + mediumCount + hardCount === 0 && Object.keys(ratings).length > 0) {
        easyCount = Object.values(ratings).filter(r => r === 'EASY').length;
        mediumCount = Object.values(ratings).filter(r => r === 'MEDIUM').length;
        hardCount = Object.values(ratings).filter(r => r === 'HARD').length;
      }
    }

    const effectiveTotal = Math.max(1, totalCount);
    const percent = Math.min(100, Math.max(0, Math.round(((easyCount * 1.0 + mediumCount * 0.5) / effectiveTotal) * 100)));
    
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
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full block"
            >
              {/* Background track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                className="stroke-gray-200 dark:stroke-slate-800"
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Colored progress line with native SVG rotation around center */}
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
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${center} ${center})`}
              />
            </svg>
            {/* Inner text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-gray-800 dark:text-white font-mono leading-none">{percent}%</span>
              <span className="text-[10px] uppercase font-black tracking-widest text-indigo-500 dark:text-indigo-400 mt-1">Dominio</span>
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

      {/* Memory Mode Switcher Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-gray-100 dark:bg-[#000e20] border border-gray-200 dark:border-indigo-950/80 rounded-2xl mb-6 overflow-x-auto scrollbar-none shadow-sm">
        <button
          type="button"
          onClick={() => setActiveMemoryMode('FLASHCARDS')}
          className={`flex-1 min-w-[125px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeMemoryMode === 'FLASHCARDS'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span>🗂️</span>
          <span>Flashcards</span>
        </button>

        {!hasOcclusionCards && (
          <button
            type="button"
            onClick={() => {
              setActiveMemoryMode('MATCH');
              initMatchMode(currentCards);
            }}
            className={`flex-1 min-w-[125px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeMemoryMode === 'MATCH'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span>🔗</span>
            <span>Unir Parejas</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveMemoryMode('QUIZ')}
          className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeMemoryMode === 'QUIZ'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <span>📝</span>
          <span>Opción Múltiple</span>
        </button>

        {multiAnswerCards.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setActiveMemoryMode('MULTI_SELECT');
              setMultiCardIndex(0);
              setSelectedMultiTiles(new Set());
              setMultiEvaluated(false);
            }}
            className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeMemoryMode === 'MULTI_SELECT'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span>✅</span>
            <span>Selección Múltiple</span>
            <span className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.2 rounded-full border border-purple-800">
              {multiAnswerCards.length}
            </span>
          </button>
        )}
      </div>

      {/* MATCH MODE BOARD */}
      {activeMemoryMode === 'MATCH' ? (
        (() => {
          const matchTotalRounds = Math.max(1, Math.ceil(matchPool.length / 6));
          const matchCurrentRound = Math.floor(matchPoolOffset / 6) + 1;
          const matchCompletedInSession = matchPoolOffset + matchedCardIds.size;
          const matchRemainingCards = Math.max(0, matchPool.length - (matchPoolOffset + matchPairs.length));
          const matchNextRoundCount = Math.min(6, matchRemainingCards);

          if (matchPairs.length === 0) {
            return (
              <div className="bg-[#001228] border border-indigo-950/90 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center mx-auto text-2xl">
                  ℹ️
                </div>
                <h3 className="text-lg font-bold text-white">No hay tarjetas disponibles para emparejar</h3>
                <p className="text-xs text-slate-400">
                  Se requieren flashcards con anverso y reverso para jugar al modo de unir parejas.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveMemoryMode('FLASHCARDS')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Volver a Flashcards
                </button>
              </div>
            );
          }

          return (
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
              {/* Header banner with round & progress indicators */}
              <div className="bg-[#001024] border border-cyan-800/40 rounded-2xl p-4 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center font-bold text-lg">
                    🔗
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Unir Palabras y sus Definiciones</h3>
                    <p className="text-xs text-slate-400">
                      Toca un concepto de la izquierda y luego su definición de la derecha.
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    {matchTotalRounds > 1 && (
                      <span className="text-[10px] uppercase font-bold text-cyan-300 bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-800/60">
                        Ronda {matchCurrentRound} de {matchTotalRounds}
                      </span>
                    )}
                    <span className="text-xs text-cyan-300 font-black font-mono px-2.5 py-0.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60">
                      {matchedCardIds.size} / {matchPairs.length} parejas
                    </span>
                  </div>
                  {matchPool.length > 6 && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      Total mazo: {matchCompletedInSession} / {matchPool.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Completion Banner if all matched in this round */}
              {matchedCardIds.size === matchPairs.length && matchPairs.length > 0 ? (
                matchRemainingCards > 0 ? (
                  /* Option to continue playing remaining cards in next round without repetition */
                  <div className="bg-[#001228] border-2 border-cyan-500/60 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-xl animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl bg-cyan-950 border border-cyan-700 text-cyan-400 flex items-center justify-center mx-auto text-3xl shadow-lg">
                      ⚡
                    </div>
                    <div>
                      <div className="inline-block text-[10px] uppercase font-black text-cyan-400 bg-cyan-950/80 border border-cyan-800 px-3 py-1 rounded-full mb-2">
                        Ronda {matchCurrentRound} de {matchTotalRounds} Completada
                      </div>
                      <h3 className="text-2xl font-black text-white">¡Ronda {matchCurrentRound} superada con éxito!</h3>
                      <p className="text-sm text-slate-300 max-w-md mx-auto mt-1">
                        Emparejaste las {matchPairs.length} fichas con <strong className="text-rose-400">{matchMistakes} {matchMistakes === 1 ? 'error' : 'errores'}</strong>.
                      </p>
                    </div>

                    {/* Progress details */}
                    <div className="bg-[#000a18] border border-cyan-900/60 rounded-2xl p-4 max-w-md mx-auto flex items-center justify-between text-left">
                      <div>
                        <div className="text-xs font-bold text-white">Tarjetas jugadas sin repetir</div>
                        <div className="text-[11px] text-slate-400">
                          Llevas {matchPoolOffset + matchPairs.length} de {matchPool.length} flashcards del mazo
                        </div>
                      </div>
                      <span className="text-xs font-black font-mono text-cyan-300 bg-cyan-950 px-3 py-1.5 rounded-xl border border-cyan-800">
                        Quedan {matchRemainingCards}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleNextMatchRound}
                        className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <span>Jugar siguientes {matchNextRoundCount} {matchNextRoundCount === 1 ? 'ficha' : 'fichas'}</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => initMatchMode(currentCards)}
                        className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl transition-all"
                      >
                        Reiniciar mazo
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveMemoryMode('FLASHCARDS')}
                        className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-sm rounded-xl transition-all"
                      >
                        Volver a Flashcards
                      </button>
                    </div>
                  </div>
                ) : (
                  /* All cards in the deck finished */
                  <div className="bg-[#001228] border-2 border-emerald-500/60 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-xl animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-700 text-emerald-400 flex items-center justify-center mx-auto text-3xl shadow-lg">
                      🏆
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white">¡Mazo completado al 100%!</h3>
                      <p className="text-sm text-slate-300 max-w-md mx-auto mt-1">
                        Emparejaste todas las <strong className="text-emerald-400">{matchPool.length} flashcards</strong> de este mazo a lo largo de {matchTotalRounds} {matchTotalRounds === 1 ? 'ronda' : 'rondas'} sin repetir ninguna ficha.
                      </p>
                    </div>

                    {/* Summary metrics */}
                    <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                      <div className="p-3 bg-[#000a18] rounded-xl border border-indigo-950/80">
                        <div className="text-lg sm:text-xl font-black text-cyan-400 font-mono">{matchPool.length}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Parejas</div>
                      </div>
                      <div className="p-3 bg-[#000a18] rounded-xl border border-indigo-950/80">
                        <div className="text-lg sm:text-xl font-black text-indigo-400 font-mono">{matchTotalRounds}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Rondas</div>
                      </div>
                      <div className="p-3 bg-[#000a18] rounded-xl border border-indigo-950/80">
                        <div className="text-lg sm:text-xl font-black text-rose-400 font-mono">{matchTotalMistakes}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Errores</div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => initMatchMode(currentCards)}
                        className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-sm rounded-xl shadow-lg active:scale-95 transition-all"
                      >
                        Jugar todo el mazo de nuevo
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveMemoryMode('FLASHCARDS')}
                        className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl transition-all"
                      >
                        Volver a Flashcards
                      </button>
                    </div>
                  </div>
                )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left Column: Terms / Front */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider px-1">
                  Conceptos / Enunciados
                </div>
                {matchLeftOrder.map(cardId => {
                  const pair = matchPairs.find(p => p.id === cardId);
                  if (!pair) return null;
                  const isMatched = matchedCardIds.has(cardId);
                  const isSelected = selectedMatch?.cardId === cardId && selectedMatch.side === 'LEFT';
                  const isMismatch = matchMismatch?.leftId === cardId;

                  return (
                    <div
                      key={`left-${cardId}`}
                      role="button"
                      tabIndex={isMatched ? -1 : 0}
                      aria-disabled={isMatched}
                      onClick={() => !isMatched && handleMatchClick(cardId, 'LEFT')}
                      onKeyDown={(e) => {
                        if (!isMatched && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleMatchClick(cardId, 'LEFT');
                        }
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all duration-200 text-xs sm:text-sm font-semibold flex items-center justify-between min-h-[62px] gap-2 select-none ${
                        isMatched
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 cursor-default opacity-85'
                          : isMismatch
                          ? 'bg-rose-950/60 border-rose-500 text-rose-200 animate-shake cursor-pointer'
                          : isSelected
                          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 ring-4 ring-cyan-500/20 shadow-lg scale-[1.02] cursor-pointer'
                          : 'bg-[#001228] border-indigo-950/80 hover:border-cyan-500/60 text-slate-200 hover:bg-[#001733] cursor-pointer'
                      }`}
                    >
                      <div className="flex-1 min-w-0 leading-snug break-words space-y-2 overflow-x-auto [scrollbar-width:none]">
                        {pair.frontImageUrl && (
                          <div className="relative group/img inline-block max-w-full">
                            <img
                              src={pair.frontImageUrl}
                              alt="Imagen de la pregunta"
                              className="max-h-28 w-auto max-w-full object-contain rounded-xl border border-indigo-800/50 bg-black/25"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMatchZoomImageUrl(pair.frontImageUrl || null);
                              }}
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-slate-950/80 hover:bg-cyan-600 text-white border border-white/20 flex items-center justify-center opacity-85 hover:opacity-100 transition-all shadow"
                              title="Ampliar imagen"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14zm0-10v6m-3-3h6" />
                              </svg>
                            </button>
                          </div>
                        )}
                        {pair.front?.trim() && (
                          <div>{renderMathAndHtml(pair.front)}</div>
                        )}
                      </div>
                      {isMatched && <span className="text-emerald-400 font-black ml-2 shrink-0">✓</span>}
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Definitions / Back */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider px-1">
                  Definiciones / Respuestas
                </div>
                {matchRightOrder.map(cardId => {
                  const pair = matchPairs.find(p => p.id === cardId);
                  if (!pair) return null;
                  const isMatched = matchedCardIds.has(cardId);
                  const isSelected = selectedMatch?.cardId === cardId && selectedMatch.side === 'RIGHT';
                  const isMismatch = matchMismatch?.rightId === cardId;

                  return (
                    <div
                      key={`right-${cardId}`}
                      role="button"
                      tabIndex={isMatched ? -1 : 0}
                      aria-disabled={isMatched}
                      onClick={() => !isMatched && handleMatchClick(cardId, 'RIGHT')}
                      onKeyDown={(e) => {
                        if (!isMatched && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleMatchClick(cardId, 'RIGHT');
                        }
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all duration-200 text-xs sm:text-sm font-medium flex items-center justify-between min-h-[62px] gap-2 select-none ${
                        isMatched
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 cursor-default opacity-85'
                          : isMismatch
                          ? 'bg-rose-950/60 border-rose-500 text-rose-200 animate-shake cursor-pointer'
                          : isSelected
                          ? 'bg-indigo-950/80 border-indigo-400 text-indigo-200 ring-4 ring-indigo-500/20 shadow-lg scale-[1.02] cursor-pointer'
                          : 'bg-[#001228] border-indigo-950/80 hover:border-indigo-500/60 text-slate-200 hover:bg-[#001733] cursor-pointer'
                      }`}
                    >
                      <div className="flex-1 min-w-0 leading-snug break-words space-y-2 overflow-x-auto [scrollbar-width:none]">
                        {pair.backImageUrl && (
                          <div className="relative group/img inline-block max-w-full">
                            <img
                              src={pair.backImageUrl}
                              alt="Imagen de la respuesta"
                              className="max-h-28 w-auto max-w-full object-contain rounded-xl border border-amber-800/50 bg-black/25"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMatchZoomImageUrl(pair.backImageUrl || null);
                              }}
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-slate-950/80 hover:bg-indigo-600 text-white border border-white/20 flex items-center justify-center opacity-85 hover:opacity-100 transition-all shadow"
                              title="Ampliar imagen"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14zm0-10v6m-3-3h6" />
                              </svg>
                            </button>
                          </div>
                        )}
                        {pair.back?.trim() && (
                          <div>{renderMathAndHtml(pair.back)}</div>
                        )}
                      </div>
                      {isMatched && <span className="text-emerald-400 font-black ml-2 shrink-0">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lightbox zoom modal for images inside Match mode */}
          {matchZoomImageUrl && (
            <div
              onClick={() => setMatchZoomImageUrl(null)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-3xl w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => setMatchZoomImageUrl(null)}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700 z-10"
                >
                  ✕ Cerrar
                </button>
                <img
                  src={matchZoomImageUrl}
                  alt="Vista ampliada"
                  className="w-full max-h-[80vh] object-contain rounded-xl mx-auto"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}
        </div>
      );
    })()
  ) : activeMemoryMode === 'QUIZ' ? (
        /* QUIZ MODE */
        (() => {
          const boxes = activeCard?.occlusionBoxes || [];
          const isOcclusion = Boolean(boxes.length > 0);
          const targetBox = isOcclusion
            ? (boxes.find(b => b.id === (activeCard?.activeBoxId || boxes[0].id)) || boxes[0])
            : null;
          const targetAnswer = targetBox?.correctAnswer?.trim() || activeCard?.back?.trim() || '';

          return (
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
              <div className="bg-[#001228] border border-indigo-950/90 rounded-3xl p-6 sm:p-8 shadow-xl">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                  <span className="font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-md border border-cyan-800/60">
                    Pregunta {currentCardIndex + 1} de {currentCards.length}
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    Aciertos: {quizScore}
                  </span>
                </div>

                {/* If card has an image (Diagram or Image Occlusion) — render once */}
                {isOcclusion && activeCard?.imageUrl ? (
                  <div className="mb-5 relative border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-gray-950/5 dark:bg-black/20 flex items-center justify-center p-1 sm:p-2 select-none min-h-[220px]">
                    <div className="relative inline-block max-w-full">
                      <img
                        src={activeCard.imageUrl.trim()}
                        alt="Diagrama con oclusión"
                        className="block max-h-[380px] w-auto max-w-full object-contain rounded-xl"
                        referrerPolicy="no-referrer"
                        draggable={false}
                      />

                      {/* Occlusion Boxes in Quiz Mode */}
                      {boxes.map((box) => {
                        const isTarget = box.id === targetBox?.id;

                        // Non-target boxes: solid neutral mask
                        if (!isTarget) {
                          return (
                            <div
                              key={box.id}
                              style={{
                                left: `${box.x}%`,
                                top: `${box.y}%`,
                                width: `${box.width}%`,
                                height: `${box.height}%`
                              }}
                              className="absolute bg-slate-900/90 border border-slate-700/70 rounded pointer-events-none"
                            />
                          );
                        }

                        // Target Box:
                        // BEFORE user answers (quizAnswered === null): MUST BE COMPLETELY COVERED / QUIETO (Sin emojis ni animaciones pulsantes)
                        if (!quizAnswered) {
                          return (
                            <div
                              key={box.id}
                              style={{
                                left: `${box.x}%`,
                                top: `${box.y}%`,
                                width: `${box.width}%`,
                                height: `${box.height}%`
                              }}
                              className="absolute bg-[#001026] border-2 border-indigo-400 dark:border-cyan-400 rounded flex items-center justify-center shadow-lg z-30 select-none pointer-events-none"
                            >
                              <span className="bg-indigo-600 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded shadow-sm">
                                {box.label ? box.label : '[ ? ]'}
                              </span>
                            </div>
                          );
                        }

                        // AFTER user answers (quizAnswered !== null): REVEAL THE TARGET BOX!
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
                              quizAnswered.isCorrect
                                ? 'border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500/40'
                                : 'border-rose-500 bg-rose-500/20 ring-2 ring-rose-500/40'
                            }`}
                          >
                            <span
                              className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] sm:text-xs font-black text-white shadow-xl flex items-center gap-1 whitespace-nowrap z-40 ${
                                quizAnswered.isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
                              }`}
                            >
                              <span>{quizAnswered.isCorrect ? '✓ ' : '✗ '}</span>
                              <span>{renderMathAndHtml(targetBox?.correctAnswer || '')}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (activeCard?.frontImageUrl || (activeCard?.type !== 'IMAGE_OCCLUSION' && activeCard?.imageUrl)) ? (
                  <div className="mb-5 flex items-center justify-center max-h-[220px]">
                    <img
                      src={activeCard.frontImageUrl || activeCard.imageUrl}
                      alt="Imagen de la pregunta"
                      className="max-h-[200px] max-w-full object-contain rounded-2xl border border-indigo-900/60 shadow-lg bg-black/40 p-1"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : null}

                <h3 className="text-lg sm:text-xl font-black text-white leading-relaxed mb-6">
                  {formatQuestionText(
                    activeCard?.front?.trim()
                      ? activeCard.front
                      : targetBox
                        ? '¿Qué concepto o estructura se encuentra en el recuadro tapado?'
                        : 'Selecciona la opción correcta:'
                  )}
                </h3>

                {/* Options A, B, C, D */}
                <div className="space-y-3">
                  {quizOptions.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const isSelected = quizAnswered?.selectedOption === opt;
                    const isCorrectTarget = opt.trim().toLowerCase() === targetAnswer.toLowerCase();
                    let optStyle = 'bg-[#000c19] border-indigo-950 hover:border-cyan-500/60 text-slate-200 hover:bg-[#00142e]';

                    if (quizAnswered) {
                      if (isCorrectTarget) {
                        optStyle = 'bg-emerald-950/70 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/40';
                      } else if (isSelected && !quizAnswered.isCorrect) {
                        optStyle = 'bg-rose-950/70 border-rose-500 text-rose-200 ring-2 ring-rose-500/40';
                      } else {
                        optStyle = 'bg-[#000a14] border-indigo-950/40 text-slate-500 opacity-60';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={quizAnswered !== null}
                        onClick={() => handleQuizOptionClick(opt)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-3 text-sm font-medium ${optStyle}`}
                      >
                        <span className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center shrink-0 text-xs ${
                          quizAnswered && isCorrectTarget
                            ? 'bg-emerald-500 text-white'
                            : quizAnswered && isSelected && !quizAnswered.isCorrect
                            ? 'bg-rose-500 text-white'
                            : 'bg-indigo-950/80 border border-indigo-800 text-indigo-300'
                        }`}>
                          {letter}
                        </span>
                        <div className="flex-1 leading-snug overflow-x-auto [scrollbar-width:none]">
                          {renderMathAndHtml(opt)}
                        </div>
                        {quizAnswered && isCorrectTarget && (
                          <span className="text-emerald-400 font-bold text-xs uppercase px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-700">
                            Correcta
                          </span>
                        )}
                        {quizAnswered && isSelected && !quizAnswered.isCorrect && (
                          <span className="text-rose-400 font-bold text-xs uppercase px-2 py-0.5 rounded bg-rose-950/90 border border-rose-700">
                            Incorrecta
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explicación / Imagen de Reverso al responder */}
                {quizAnswered && activeCard?.backImageUrl && (
                  <div className="mt-5 p-3.5 bg-indigo-950/40 border border-indigo-800/40 rounded-2xl flex items-center gap-4 animate-fade-in">
                    <img
                      src={activeCard.backImageUrl}
                      alt="Imagen de la respuesta"
                      className="max-h-24 w-auto object-contain rounded-xl border border-indigo-700/50 bg-black/40 p-1 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-xs text-slate-300">
                      <span className="font-bold text-amber-400 block mb-0.5 uppercase text-[10px] tracking-wider">
                        Resolución / Imagen de Respuesta:
                      </span>
                      <span className="line-clamp-2 text-slate-200">{activeCard.back}</span>
                    </div>
                  </div>
                )}
              </div>

              {quizAnswered && (
                <div className="flex items-center justify-end gap-3 animate-fade-in">
                  <button
                    type="button"
                    onClick={handleNextQuizCard}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
                  >
                    <span>{currentCardIndex + 1 < currentCards.length ? 'Siguiente Pregunta' : 'Finalizar Cuestionario'}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })()
      ) : activeMemoryMode === 'MULTI_SELECT' ? (
        /* MULTI-SELECT MODE (ONLY for cards with multiple answers enabled) */
        (() => {
          const activeMultiCard = multiAnswerCards[multiCardIndex] || multiAnswerCards[0];
          if (!activeMultiCard) {
            return (
              <div className="bg-[#001228] border border-indigo-950/90 rounded-3xl p-8 text-center max-w-xl mx-auto space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-800 text-purple-300 flex items-center justify-center mx-auto text-2xl">
                  ℹ️
                </div>
                <h3 className="text-lg font-bold text-white">Selección Múltiple no disponible</h3>
                <p className="text-xs text-slate-400">
                  Este modo solo está activo para flashcards donde se hayan habilitado varias respuestas en la creación o edición de tarjetas.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveMemoryMode('FLASHCARDS')}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Volver a Flashcards
                </button>
              </div>
            );
          }

          return (
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
              <div className="bg-[#001228] border border-indigo-950/90 rounded-3xl p-6 sm:p-8 shadow-xl">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                  <span className="font-bold uppercase tracking-wider text-purple-400 bg-purple-950/80 px-2.5 py-0.5 rounded-md border border-purple-800/60">
                    Pregunta {multiCardIndex + 1} de {multiAnswerCards.length}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {multiCorrectSet.size} {multiCorrectSet.size === 1 ? 'opción correcta' : 'opciones correctas'}
                  </span>
                </div>

                {(activeMultiCard.frontImageUrl || (activeMultiCard.type !== 'IMAGE_OCCLUSION' && activeMultiCard.imageUrl)) && (
                  <div className="mb-4 flex items-center justify-center max-h-[200px]">
                    <img
                      src={activeMultiCard.frontImageUrl || activeMultiCard.imageUrl}
                      alt="Imagen de la pregunta"
                      className="max-h-[180px] max-w-full object-contain rounded-2xl border border-purple-900/60 shadow-lg bg-black/40 p-1"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <h3 className="text-lg sm:text-xl font-black text-white leading-relaxed mb-2">
                  {formatQuestionText(activeMultiCard.front || '')}
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  Pulsa sobre <strong>todas las opciones que correspondan</strong> a este enunciado y luego pulsa "Comprobar Selección".
                </p>

                {/* Interactive Tiles */}
                <div className="flex flex-wrap gap-2.5 mb-6">
                  {multiTiles.map((tile, i) => {
                    const isSelected = selectedMultiTiles.has(tile);
                    const isTarget = multiCorrectSet.has(tile);
                    let tileStyle = isSelected
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 ring-2 ring-cyan-500/30'
                      : 'bg-[#000a14] border-indigo-950/80 hover:border-slate-600 text-slate-300';

                    if (multiEvaluated) {
                      if (isTarget && isSelected) {
                        tileStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/40';
                      } else if (isTarget && !isSelected) {
                        tileStyle = 'bg-amber-950/50 border-amber-500/80 text-amber-200 border-dashed';
                      } else if (!isTarget && isSelected) {
                        tileStyle = 'bg-rose-950/80 border-rose-500 text-rose-200 line-through';
                      } else {
                        tileStyle = 'bg-[#000810] border-indigo-950/40 text-slate-600 opacity-50';
                      }
                    }

                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={multiEvaluated}
                        onClick={() => handleToggleMultiTile(tile)}
                        className={`px-4 py-2.5 rounded-xl border-2 font-bold text-xs sm:text-sm transition-all duration-150 flex items-center gap-2 ${tileStyle} active:scale-95`}
                      >
                        <span className="inline-block overflow-x-auto [scrollbar-width:none]">
                          {renderMathAndHtml(tile)}
                        </span>
                        {multiEvaluated && isTarget && isSelected && <span className="text-emerald-400 text-xs">✓</span>}
                        {multiEvaluated && isTarget && !isSelected && <span className="text-amber-400 text-[10px]">Faltó</span>}
                        {multiEvaluated && !isTarget && isSelected && <span className="text-rose-400 text-xs">✗</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between border-t border-indigo-950/60 pt-4">
                  <span className="text-xs text-slate-400">
                    {selectedMultiTiles.size} seleccionada{selectedMultiTiles.size === 1 ? '' : 's'}
                  </span>

                  {!multiEvaluated ? (
                    <button
                      type="button"
                      disabled={selectedMultiTiles.size === 0}
                      onClick={handleCheckMultiSelect}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
                    >
                      Comprobar Selección
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleNextMultiCard}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <span>{multiCardIndex + 1 < multiAnswerCards.length ? 'Siguiente Pregunta' : 'Finalizar Sesión'}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        /* Formula Builder Player OR Image Occlusion Player OR Classic 3D Flashcard container */
        (() => {
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
              let res = s
                .replace(/\$/g, '')
                .replace(/\s+/g, '')
                .toLowerCase()
                .replace(/\\cdot|\\times|·|×/g, '*')
                .replace(/\\div|÷/g, '/')
                // Normalize single-char braces on subscripts/superscripts like x_{2} -> x_2
                .replace(/([_^])\{([a-z0-9])\}/g, '$1$2');
              // Normalize \frac{a}{b}, \dfrac{a}{b}, \tfrac{a}{b} -> a/b
              res = res.replace(/\\(?:d|t)?frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');
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
                                  <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{renderMathAndHtml(formulaEvaluation.expected)}</strong>
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
        const frontImg = activeCard?.frontImageUrl || (activeCard?.type === 'TEXT' || !activeCard?.type ? activeCard?.imageUrl : undefined);
        const backImg = activeCard?.backImageUrl;
        const hasAnyImage = !!(frontImg || backImg);

        return (
          <div className={`perspective-1000 w-full max-w-xl mx-auto ${hasAnyImage ? 'min-h-[460px] h-[480px] sm:h-[520px]' : 'min-h-[350px] h-[370px] sm:h-[400px]'} mb-8 relative`}>
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

                <div className="flex-grow min-h-0 flex flex-col items-center justify-center py-2 px-1 text-center my-auto overflow-y-auto overscroll-contain max-h-[350px] [scrollbar-width:thin] [scrollbar-color:rgba(99,102,241,0.3)_transparent] gap-3">
                  {frontImg && (
                    <div className="shrink-0 max-h-[190px] w-full flex items-center justify-center">
                      <img
                        src={frontImg}
                        alt="Imagen de la pregunta"
                        className="max-h-[180px] max-w-full object-contain rounded-xl border border-indigo-150 dark:border-indigo-900/60 shadow-sm bg-black/5 dark:bg-black/20 p-1"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
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

                <div className="flex-grow min-h-0 flex flex-col items-center justify-center py-2 px-1 text-center my-auto overflow-y-auto overscroll-contain max-h-[350px] [scrollbar-width:thin] [scrollbar-color:rgba(99,102,241,0.3)_transparent] gap-3">
                  {backImg && (
                    <div className="shrink-0 max-h-[190px] w-full flex items-center justify-center">
                      <img
                        src={backImg}
                        alt="Imagen de la respuesta"
                        className="max-h-[180px] max-w-full object-contain rounded-xl border border-amber-200/60 dark:border-amber-900/50 shadow-sm bg-black/5 dark:bg-black/20 p-1"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
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
      })())}

      {/* Control buttons & Keyboard hotkeys representation (only for standard flip flashcards) */}
      {activeMemoryMode === 'FLASHCARDS' && !isFormulaCard && !isImageCard && (
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

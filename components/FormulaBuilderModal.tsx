import React, { useState, useEffect, useRef } from 'react';
import { CourseStructure, Flashcard } from '../types';
import { ACADEMIC_STRUCTURE } from '../constants';
import { FormulaTokenRenderer, parseFractionToken } from '../utils';

interface FormulaBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveFlashcards: (cards: Flashcard[]) => void;
  initialCourseName?: string | null;
  initialSubjectName?: string | null;
  initialTopicName?: string | null;
  academicStructure?: CourseStructure[];
  onToast?: (msg: string) => void;
}

// Decomposition algorithm: parses mathematical formulas, variables, operators, superscripts, subscripts, and fractions
export const decomposeFormula = (input: string, mode: 'SMART' | 'CHARS' | 'WORDS' = 'SMART'): string[] => {
  const trimmed = input.trim();
  if (!trimmed) return [];

  if (mode === 'WORDS') {
    return trimmed.split(/\s+/).filter(Boolean);
  }

  if (mode === 'CHARS') {
    return trimmed.replace(/\s+/g, '').split('');
  }

  // SMART MODE:
  // Breaks expressions like "E = mc²" -> ["E", "=", "m", "c", "²"]
  // Keeps fractions together as single units: LaTeX \frac{a}{b}, unicode fractions (½, ⅓, etc.), or numeric/variable division (5/2, 1/2)
  // Handles multi-letter trigonometric/logarithmic functions (sin, cos, tan, ln, log),
  // numbers with decimals, superscripts, subscripts, Greek characters, operators and letters.
  const tokens: string[] = [];
  const regex = /(\\frac\{[^{}]+\}\{[^{}]+\})|([½⅓¼¾⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])|([a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)?\/[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)?)|(sin|cos|tan|cot|sec|csc|log|ln|lim|det)|(\d+(?:\.\d+)?)|(<=|>=|!=|==|\+-|->)|([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿᵃᵇᶜᵈᵉᵒᵖʳˢᵗᵘᵛˣʸ₀₁₂₃₄₅₆₇₈₉₊₋])|([=+\-*\/·×÷±∓<>≤≥()\[\]{}√∫∑∂%!:,_])|([α-ωΑ-Ω])|([a-zA-Z])/g;
  
  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    tokens.push(match[0]);
  }

  // Fallback if regex matched nothing
  if (tokens.length === 0) {
    return trimmed.split('').filter(c => c.trim().length > 0);
  }

  return tokens;
};

// Generates sensible distractors to test knowledge
export const generateSuggestedDistractors = (tokens: string[]): string[] => {
  const distractors = new Set<string>();
  const tokenSet = new Set(tokens);

  tokens.forEach(t => {
    // Fraction distractors: inverted fraction or adjusted denominator
    const frac = parseFractionToken(t);
    if (frac) {
      const inverted = `${frac.denominator}/${frac.numerator}`;
      if (!tokenSet.has(inverted)) distractors.add(inverted);
      const dNum = parseInt(frac.denominator, 10);
      if (!isNaN(dNum)) {
        distractors.add(`${frac.numerator}/${dNum + 1}`);
      }
    }

    if (t === '²') { distractors.add('³'); distractors.add('2'); }
    if (t === '³') { distractors.add('²'); distractors.add('4'); }
    if (t === '+') { distractors.add('-'); distractors.add('±'); }
    if (t === '-') { distractors.add('+'); }
    if (t === '*') { distractors.add('/'); distractors.add('+'); }
    if (t === '/') { distractors.add('*'); distractors.add('·'); }
    if (t === '·') { distractors.add('/'); distractors.add('+'); }
    if (t === 'm') { distractors.add('v'); distractors.add('M'); }
    if (t === 'a') { distractors.add('g'); distractors.add('v'); }
    if (t === 'v') { distractors.add('t'); distractors.add('d'); }
    if (t === 't') { distractors.add('s'); distractors.add('v'); }
    if (t === 'r') { distractors.add('d'); distractors.add('R'); }
    if (t === 'x') { distractors.add('y'); distractors.add('z'); }
    if (t === 'sin') { distractors.add('cos'); }
    if (t === 'cos') { distractors.add('sin'); distractors.add('tan'); }
  });

  // Always supply a couple of subtle alternate symbols if bank is small
  if (distractors.size < 2) {
    if (!tokenSet.has('²')) distractors.add('²');
    if (!tokenSet.has('+')) distractors.add('+');
    if (!tokenSet.has('-')) distractors.add('-');
    if (!tokenSet.has('/')) distractors.add('/');
  }

  return Array.from(distractors).filter(d => !tokenSet.has(d)).slice(0, 4);
};

export const FormulaBuilderModal: React.FC<FormulaBuilderModalProps> = ({
  isOpen,
  onClose,
  onSaveFlashcards,
  initialCourseName,
  initialSubjectName,
  initialTopicName,
  academicStructure = ACADEMIC_STRUCTURE,
  onToast
}) => {
  const [course, setCourse] = useState<string>(initialCourseName || 'Ciencias');
  const [subject, setSubject] = useState<string>(initialSubjectName || '');
  const [topic, setTopic] = useState<string>(initialTopicName || '');
  
  // Question & Formula details
  const [question, setQuestion] = useState<string>('');
  const [formulaInput, setFormulaInput] = useState<string>('E = mc²');
  const [decompositionMode, setDecompositionMode] = useState<'SMART' | 'CHARS' | 'WORDS'>('SMART');
  const [tokens, setTokens] = useState<string[]>(['E', '=', 'm', 'c', '²']);
  const [distractors, setDistractors] = useState<string[]>(['³', '-']);
  const [explanation, setExplanation] = useState<string>('');
  
  // Manual token inputs
  const [customToken, setCustomToken] = useState<string>('');
  const [customDistractor, setCustomDistractor] = useState<string>('');

  // Batch session cards (cards created in this modal session for this deck)
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);
  const [showSessionCardsList, setShowSessionCardsList] = useState<boolean>(false);
  const questionInputRef = useRef<HTMLInputElement>(null);

  // Fraction Creator Tool state
  const [fractionNum, setFractionNum] = useState<string>('5');
  const [fractionDen, setFractionDen] = useState<string>('2');
  const [showFractionBuilder, setShowFractionBuilder] = useState<boolean>(false);

  // Optional Diagram/Image attached alongside question
  const [imageUrl, setImageUrl] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [showImageInput, setShowImageInput] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync available subjects when course changes
  const availableSubjects = (academicStructure.find(c => c.name === course)?.subjects) || [];

  // Clipboard paste listener to allow pasting images directly into the question (Ctrl+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (typeof event.target?.result === 'string') {
                setImageUrl(event.target.result);
                setShowImageInput(true);
                if (onToast) onToast("¡Imagen adjuntada a la pregunta desde el portapapeles!");
              }
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, onToast]);

  useEffect(() => {
    if (isOpen) {
      if (initialCourseName) setCourse(initialCourseName);
      if (initialSubjectName) setSubject(initialSubjectName);
      if (initialTopicName) setTopic(initialTopicName);
      setSessionCards([]);
      setShowSessionCardsList(false);
      setQuestion('');
      setFormulaInput('E = mc²');
      setTokens(['E', '=', 'm', 'c', '²']);
      setDistractors(['³', '-']);
      setImageUrl('');
      setUrlInput('');
      setShowImageInput(false);
      setExplanation('');
      setCustomToken('');
      setCustomDistractor('');
    }
  }, [isOpen, initialCourseName, initialSubjectName, initialTopicName]);

  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.includes(subject)) {
      setSubject(availableSubjects[0]);
    }
  }, [course, availableSubjects, subject]);

  // Auto-decompose formula input whenever formulaInput or decompositionMode changes
  useEffect(() => {
    if (formulaInput.trim()) {
      const parsed = decomposeFormula(formulaInput, decompositionMode);
      setTokens(parsed);
    } else {
      setTokens([]);
    }
  }, [formulaInput, decompositionMode]);

  // Insert math symbol into formula input
  const handleInsertSymbol = (sym: string) => {
    setFormulaInput(prev => prev + sym);
  };

  // Remove a token
  const handleRemoveToken = (index: number) => {
    setTokens(prev => prev.filter((_, i) => i !== index));
  };

  // Move token left or right
  const handleMoveToken = (index: number, dir: -1 | 1) => {
    const targetIdx = index + dir;
    if (targetIdx < 0 || targetIdx >= tokens.length) return;
    setTokens(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  // Adds fraction to BOTH Formula Input ("Fórmula Completa a Descomponer")
  // and Generated Token Blocks ("Bloques generados para el estudiante")
  const handleAddFraction = (fracStr: string) => {
    const trimmed = fracStr.trim();
    if (!trimmed) return;

    const current = formulaInput.trim();
    let newFormula = '';
    if (!current) {
      newFormula = trimmed;
    } else if (/[=+\-*\/·(]$/.test(current)) {
      newFormula = `${current} ${trimmed}`;
    } else {
      newFormula = `${current} ${trimmed}`;
    }

    setFormulaInput(newFormula);

    // Synchronously ensure tokens has the fraction block as well
    const parsed = decomposeFormula(newFormula, decompositionMode);
    setTokens(parsed.length > 0 ? parsed : [...tokens, trimmed]);

    if (onToast) {
      onToast(`¡Fracción ${trimmed} añadida a la fórmula y a los bloques!`);
    }
  };

  // Add custom token
  const handleAddCustomToken = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customToken.trim()) return;
    const tok = customToken.trim();
    setTokens(prev => [...prev, tok]);
    setFormulaInput(prev => {
      const p = prev.trim();
      if (!p) return tok;
      return `${p} ${tok}`;
    });
    setCustomToken('');
  };

  // Add distractor
  const handleAddDistractor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customDistractor.trim()) return;
    if (!distractors.includes(customDistractor.trim())) {
      setDistractors(prev => [...prev, customDistractor.trim()]);
    }
    setCustomDistractor('');
  };

  const handleRemoveDistractor = (dist: string) => {
    setDistractors(prev => prev.filter(d => d !== dist));
  };

  const handleAutoSuggestDistractors = () => {
    const suggested = generateSuggestedDistractors(tokens);
    setDistractors(prev => Array.from(new Set([...prev, ...suggested])));
    if (onToast) onToast("¡Distractores automáticos agregados!");
  };

  // Handle image upload
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setImageUrl(event.target.result);
        setShowImageInput(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const buildCurrentCard = (): Flashcard | null => {
    if (!question.trim()) {
      if (onToast) onToast("Por favor escribe la pregunta o enunciado del ejercicio.");
      return null;
    }
    if (tokens.length === 0) {
      if (onToast) onToast("Debes ingresar una fórmula con al menos un bloque para armar.");
      return null;
    }

    const finalTopic = topic.trim() || 'Fórmulas y Ecuaciones';
    const cardId = crypto.randomUUID();
    const fullFormulaText = formulaInput.trim() || tokens.join(' ');

    return {
      id: cardId,
      course,
      subject,
      topic: finalTopic,
      type: 'FORMULA_BUILDER',
      front: question.trim(),
      back: fullFormulaText,
      imageUrl: imageUrl.trim() || undefined,
      formulaFull: fullFormulaText,
      formulaTokens: tokens,
      formulaDistractors: distractors,
      formulaExplanation: explanation.trim() || undefined,
      createdAt: Date.now(),
      order: sessionCards.length + 1
    };
  };

  // Option 1: Save card and stay in modal to add the next question to the same deck
  const handleSaveAndAddAnother = () => {
    const newCard = buildCurrentCard();
    if (!newCard) return;

    onSaveFlashcards([newCard]);
    setSessionCards(prev => [...prev, newCard]);

    // Clear form for next card while preserving course, subject, and topic
    setQuestion('');
    setFormulaInput('');
    setTokens([]);
    setDistractors([]);
    setImageUrl('');
    setUrlInput('');
    setShowImageInput(false);
    setExplanation('');
    setCustomToken('');
    setCustomDistractor('');

    if (onToast) {
      onToast(`¡Tarjeta #${sessionCards.length + 1} guardada en el mazo! Puedes formular la siguiente.`);
    }

    setTimeout(() => {
      questionInputRef.current?.focus();
    }, 100);
  };

  // Option 2: Save and finish (or just finish if cards were already saved in this session)
  const handleSaveAndFinish = () => {
    const hasPendingContent = question.trim().length > 0 || tokens.length > 0;

    if (hasPendingContent) {
      const newCard = buildCurrentCard();
      if (!newCard) return;

      onSaveFlashcards([newCard]);
      const total = sessionCards.length + 1;
      if (onToast) {
        onToast(`¡${total} tarjeta${total > 1 ? 's' : ''} con fórmula agregada${total > 1 ? 's' : ''} al mazo!`);
      }
      onClose();
    } else {
      if (sessionCards.length > 0) {
        if (onToast) {
          onToast(`¡Listo! Se guardaron ${sessionCards.length} tarjeta${sessionCards.length > 1 ? 's' : ''} en el mazo.`);
        }
        onClose();
      } else {
        if (onToast) onToast("Por favor escribe la pregunta y fórmula para la tarjeta.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-[#000a14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md font-black text-lg">
              🧩
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-gray-800 dark:text-gray-100 leading-tight flex items-center gap-2">
                <span>Armar Fórmula con Bloques</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                El estudiante completará la fórmula tocando bloques interactivos en vez de escribir con el teclado.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sessionCards.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSessionCardsList(!showSessionCardsList)}
                className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-all shadow-xs cursor-pointer"
                title="Ver las tarjetas guardadas en este mazo durante esta sesión"
              >
                <span>✓ {sessionCards.length} {sessionCards.length === 1 ? 'tarjeta en mazo' : 'tarjetas en mazo'}</span>
                <span className="text-[10px] opacity-75">{showSessionCardsList ? '▲' : '▼'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              title={sessionCards.length > 0 ? "Cerrar modal" : "Cancelar"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dropdown list of session cards if expanded */}
        {showSessionCardsList && sessionCards.length > 0 && (
          <div className="px-5 py-3 bg-emerald-50/90 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 text-xs max-h-48 overflow-y-auto space-y-2 animate-fade-in">
            <div className="flex items-center justify-between font-black uppercase text-[10px] text-emerald-800 dark:text-emerald-300 tracking-wider">
              <span>Tarjetas guardadas en este mazo ({sessionCards.length}):</span>
              <button
                type="button"
                onClick={() => setShowSessionCardsList(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold"
              >
                Ocultar
              </button>
            </div>
            {sessionCards.map((sc, idx) => (
              <div key={sc.id} className="p-2 bg-white dark:bg-[#000a14] rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono text-[10px] flex items-center justify-center shrink-0 font-bold">
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <span className="font-semibold text-gray-800 dark:text-gray-100 block truncate">{sc.front}</span>
                    <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{sc.formulaFull || sc.back}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-mono font-bold px-1.5 py-0.5 rounded shrink-0">
                  {(sc.formulaTokens || []).length} bloques
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-grow">
          {/* Notification banner when cards were added in this session */}
          {sessionCards.length > 0 && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm font-black shrink-0 shadow-xs">
                  ✓
                </div>
                <div>
                  <p className="text-xs font-black text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5">
                    <span>{sessionCards.length === 1 ? '1 tarjeta guardada en este mazo' : `${sessionCards.length} tarjetas guardadas en este mazo`}</span>
                    <span className="text-[10px] bg-emerald-200/80 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-mono">
                      Mazo activo: {topic.trim() || 'Fórmulas'}
                    </span>
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Puedes redactar la siguiente pregunta abajo o pulsar <strong>"Finalizar ({sessionCards.length})"</strong> cuando termines.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSessionCardsList(!showSessionCardsList)}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline self-end sm:self-center shrink-0"
              >
                {showSessionCardsList ? 'Ocultar lista' : `Ver tarjetas creadas (${sessionCards.length})`}
              </button>
            </div>
          )}

          {/* Metadata: Course, Subject, Topic */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-indigo-50/40 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-indigo-100/50 dark:border-slate-800">
            <div>
              <label className="block text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider mb-1">
                Curso
              </label>
              <select
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 outline-none text-gray-800 dark:text-gray-100"
              >
                {academicStructure.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider mb-1">
                Materia
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 outline-none text-gray-800 dark:text-gray-100"
              >
                {availableSubjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider mb-1">
                Tema / Sección
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ej. Física Moderna / Relatividad"
                className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 outline-none text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Question / Enunciado with Integrated Image / Diagram */}
          <div className="space-y-2.5 bg-gray-50/70 dark:bg-[#000c19] p-4 rounded-2xl border border-gray-200 dark:border-indigo-950">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-200 tracking-wider">
                1. Pregunta o Enunciado del Ejercicio <span className="text-rose-500">*</span>
              </label>

              {!imageUrl && (
                <button
                  type="button"
                  onClick={() => setShowImageInput(!showImageInput)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{showImageInput ? 'Ocultar opciones de imagen' : '+ Añadir imagen o diagrama'}</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              <input
                ref={questionInputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={sessionCards.length > 0 ? `Pregunta #${sessionCards.length + 1} para este mazo...` : "Ej. ¿Cuál es la ecuación de equivalencia entre masa y energía de Einstein?"}
                className="w-full text-sm font-semibold bg-white dark:bg-[#000a14] border border-gray-200 dark:border-slate-700 rounded-2xl p-3 outline-none text-gray-800 dark:text-gray-100 focus:border-indigo-500 transition-all shadow-inner"
              />
              <p className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center justify-between">
                <span>Esta pregunta aparecerá en la parte superior para indicarle al estudiante qué fórmula armar.</span>
                <span className="hidden sm:inline text-[10px] text-gray-400">Consejo: Puedes pegar una imagen con Ctrl+V</span>
              </p>
            </div>

            {/* Image attachment uploader and live preview */}
            {showImageInput && !imageUrl && (
              <div className="mt-2 p-3 bg-white dark:bg-[#000a14] rounded-xl border border-dashed border-indigo-200 dark:border-indigo-900/60 space-y-2 animate-fade-in">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFile}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Subir archivo</span>
                  </button>

                  <span className="text-xs text-gray-400 font-bold">o URL:</span>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Pega un enlace https://..."
                    className="flex-grow text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-1.5 outline-none text-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (urlInput.trim()) {
                        setImageUrl(urlInput.trim());
                      }
                    }}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 font-bold text-xs rounded-xl text-gray-800 dark:text-gray-100"
                  >
                    Cargar
                  </button>
                </div>
              </div>
            )}

            {/* Attached Image Preview alongside question */}
            {Boolean(imageUrl) && (
              <div className="mt-2 p-2.5 bg-white dark:bg-[#000a14] rounded-xl border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 bg-black/5 dark:bg-black/30 flex items-center justify-center shrink-0">
                    <img src={imageUrl} alt="Diagrama adjunto a la pregunta" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                      <span>🖼️ Imagen adjunta al enunciado</span>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                        Lista
                      </span>
                    </span>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      Se mostrará al estudiante junto con la pregunta al momento de armar la fórmula.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl('');
                      setUrlInput('');
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Formula Input & Fraction Creator */}
          <div className="space-y-3 bg-gradient-to-br from-indigo-50/30 to-purple-50/20 dark:from-[#000a14] dark:to-[#001228] p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-200 tracking-wider">
                2. Fórmula Completa a Descomponer <span className="text-rose-500">*</span>
              </label>
              
              {/* Decomposition mode selector */}
              <div className="flex items-center gap-1 text-[11px] bg-white dark:bg-[#000a14] p-1 rounded-xl border border-gray-200 dark:border-slate-800 self-start sm:self-auto">
                <span className="text-gray-400 font-bold px-1.5">Modo:</span>
                <button
                  type="button"
                  onClick={() => setDecompositionMode('SMART')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                    decompositionMode === 'SMART' 
                      ? 'bg-indigo-600 text-white' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                  }`}
                  title="Separa variables, exponentes (²), fracciones (5/2) y operadores automáticamente"
                >
                  Inteligente
                </button>
                <button
                  type="button"
                  onClick={() => setDecompositionMode('CHARS')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                    decompositionMode === 'CHARS' 
                      ? 'bg-indigo-600 text-white' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                  }`}
                >
                  Por Caracteres
                </button>
                <button
                  type="button"
                  onClick={() => setDecompositionMode('WORDS')}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                    decompositionMode === 'WORDS' 
                      ? 'bg-indigo-600 text-white' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                  }`}
                >
                  Por Espacios
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={formulaInput}
                onChange={(e) => setFormulaInput(e.target.value)}
                placeholder="Escribe la fórmula (ej: E = mc², F = m·a, v = d/t, y = 5/2 x)..."
                className="w-full text-base sm:text-lg font-mono font-bold bg-white dark:bg-[#000a14] border-2 border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-3 pr-20 outline-none text-indigo-700 dark:text-indigo-300 focus:border-indigo-500 shadow-sm"
              />
              {formulaInput && (
                <button
                  type="button"
                  onClick={() => setFormulaInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 px-2 py-1 rounded-lg transition-colors"
                  title="Limpiar campo de fórmula"
                >
                  Limpiar ×
                </button>
              )}
            </div>

            {/* Quick Math Symbols palette */}
            <div className="pt-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Insertar símbolos rápidos:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['²', '³', '⁴', 'ⁿ', '₀', '₁', '₂', '=', '+', '-', '·', '/', '±', '√', '(', ')', 'π', 'θ', 'λ', 'Δ', 'α', 'β', 'μ', '∫', '∑'].map(sym => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleInsertSymbol(sym)}
                    className="w-8 h-8 rounded-lg bg-white dark:bg-[#000f20] hover:bg-indigo-50 dark:hover:bg-[#001838] text-gray-700 dark:text-gray-200 font-mono font-bold text-sm border border-gray-200 dark:border-slate-800 shadow-xs active:scale-95 transition-all flex items-center justify-center"
                    title={`Insertar ${sym}`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            {/* Dedicated Fraction Creator Tool */}
            <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider flex items-center gap-1.5">
                  <span>📐 Creador de Fracciones Verticales</span>
                  <span className="text-[10px] font-normal text-gray-400">
                    (Se añaden a la fórmula y a los bloques de estudio)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowFractionBuilder(!showFractionBuilder)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {showFractionBuilder ? 'Ocultar panel de fracciones' : '+ Abrir generador de fracciones'}
                </button>
              </div>

              {/* Quick Fraction Chips */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">
                  Rápidas:
                </span>
                {['1/2', '5/2', '3/2', '1/4', '3/4', '1/3', '2/3', '1/5'].map(fracStr => (
                  <button
                    key={fracStr}
                    type="button"
                    onClick={() => handleAddFraction(fracStr)}
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-[#000f20] hover:bg-indigo-50 dark:hover:bg-[#001838] border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                    title={`Añadir fracción ${fracStr} a la fórmula y a los bloques`}
                  >
                    <FormulaTokenRenderer text={fracStr} size="sm" />
                    <span className="text-[9px] text-gray-400 ml-0.5 font-bold">+ Añadir</span>
                  </button>
                ))}
              </div>

              {/* Interactive Fraction Builder Panel */}
              {showFractionBuilder && (
                <div className="p-3 bg-white dark:bg-[#000a14] rounded-2xl border-2 border-indigo-200/80 dark:border-indigo-800/80 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
                  <div className="flex items-center gap-3">
                    {/* Numerator & Denominator vertical inputs */}
                    <div className="flex flex-col items-center w-24">
                      <input
                        type="text"
                        value={fractionNum}
                        onChange={(e) => setFractionNum(e.target.value)}
                        placeholder="Num (5)"
                        className="w-full text-center text-xs font-mono font-bold bg-gray-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 rounded-lg p-1 text-indigo-700 dark:text-indigo-300 outline-none"
                      />
                      <div className="w-full h-0.5 bg-indigo-500 dark:bg-indigo-400 my-1 rounded-full"></div>
                      <input
                        type="text"
                        value={fractionDen}
                        onChange={(e) => setFractionDen(e.target.value)}
                        placeholder="Den (2)"
                        className="w-full text-center text-xs font-mono font-bold bg-gray-50 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 rounded-lg p-1 text-indigo-700 dark:text-indigo-300 outline-none"
                      />
                    </div>

                    <span className="text-gray-400 font-bold text-sm">=</span>

                    {/* Live Preview */}
                    <div className="px-3 py-2 bg-indigo-50/70 dark:bg-[#001228] border border-indigo-200 dark:border-indigo-700 rounded-xl flex items-center justify-center min-w-[56px] min-h-[48px] shadow-xs">
                      <FormulaTokenRenderer
                        text={`${fractionNum.trim() || '?'}/${fractionDen.trim() || '?'}`}
                        size="lg"
                        className="text-indigo-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Actions for this fraction: adds to BOTH formula and blocks */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!fractionNum.trim() || !fractionDen.trim()}
                      onClick={() => {
                        const fracStr = `${fractionNum.trim()}/${fractionDen.trim()}`;
                        handleAddFraction(fracStr);
                      }}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Añadir Fracción a Fórmula y Bloques</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Block Decomposition Preview & Editor with FormulaTokenRenderer */}
          <div className="space-y-3 bg-gray-50 dark:bg-[#000f20] p-4 rounded-2xl border border-gray-200 dark:border-indigo-900/40">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-gray-700 dark:text-gray-200 tracking-wider flex items-center gap-1.5">
                  <span>3. Bloques generados para el estudiante</span>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold">
                    {tokens.length} {tokens.length === 1 ? 'bloque' : 'bloques'}
                  </span>
                </h4>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  El orden mostrado aquí es la respuesta requerida para calificar. Las fracciones se muestran en vertical.
                </p>
              </div>

              {tokens.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTokens([])}
                  className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Limpiar bloques
                </button>
              )}
            </div>

            {/* List of generated tokens */}
            <div className="min-h-[56px] p-3 bg-white dark:bg-[#000a14] rounded-xl border border-dashed border-gray-300 dark:border-indigo-800/60 flex flex-wrap items-center gap-2">
              {tokens.length === 0 ? (
                <span className="text-xs text-gray-400 italic">
                  Escribe una fórmula arriba o añade fracciones para generar los bloques automáticamente.
                </span>
              ) : (
                tokens.map((tok, index) => (
                  <div
                    key={`${tok}-${index}`}
                    className="group relative flex items-center bg-indigo-50 dark:bg-[#001228] text-indigo-800 dark:text-white border-2 border-indigo-200 dark:border-indigo-600 rounded-xl px-2.5 py-1.5 shadow-sm font-mono font-black text-sm select-none"
                  >
                    <span className="mr-1 text-[9px] text-gray-400 font-sans font-bold">
                      {index + 1}
                    </span>
                    <span className="px-1 text-base flex items-center">
                      <FormulaTokenRenderer text={tok} size="md" />
                    </span>

                    {/* Move and delete controls */}
                    <div className="flex items-center gap-0.5 ml-1.5 pl-1.5 border-l border-indigo-200 dark:border-indigo-800">
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => handleMoveToken(index, -1)}
                          className="text-[10px] text-gray-400 hover:text-indigo-600 p-0.5"
                          title="Mover a la izquierda"
                        >
                          ◀
                        </button>
                      )}
                      {index < tokens.length - 1 && (
                        <button
                          type="button"
                          onClick={() => handleMoveToken(index, 1)}
                          className="text-[10px] text-gray-400 hover:text-indigo-600 p-0.5"
                          title="Mover a la derecha"
                        >
                          ▶
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveToken(index)}
                        className="text-xs text-rose-500 hover:text-rose-700 ml-0.5 p-0.5 font-bold"
                        title="Eliminar bloque"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Custom Token manually */}
            <form onSubmit={handleAddCustomToken} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={customToken}
                onChange={(e) => setCustomToken(e.target.value)}
                placeholder="Añadir bloque manual (ej. 5/2, sen, cos, x, 2, +)..."
                className="text-xs bg-white dark:bg-[#000a14] border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-1.5 outline-none text-gray-800 dark:text-gray-100 flex-grow font-mono focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!customToken.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shadow-xs shrink-0"
              >
                + Añadir Bloque
              </button>
            </form>
          </div>

          {/* Distractors Section */}
          <div className="space-y-3 bg-indigo-50/30 dark:bg-[#000c19] p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-300 tracking-wider flex items-center gap-1.5">
                  <span>4. Bloques Distractores (Opcional)</span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50 px-2 py-0.5 rounded-full font-mono">
                    {distractors.length}
                  </span>
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Bloques adicionales para retar al estudiante (e.g. 2/5 en vez de 5/2, ³ en vez de ²).
                </p>
              </div>

              <button
                type="button"
                onClick={handleAutoSuggestDistractors}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                <span>✨ Sugerir Automáticos</span>
              </button>
            </div>

            <div className="min-h-[46px] p-2.5 bg-white dark:bg-[#000a14] rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800/60 flex flex-wrap items-center gap-2">
              {distractors.length === 0 ? (
                <span className="text-xs text-gray-400 italic">
                  Sin distractores. Solo se mostrarán los bloques exactos de la fórmula.
                </span>
              ) : (
                distractors.map(dist => (
                  <div
                    key={dist}
                    className="flex items-center bg-indigo-50 dark:bg-[#000f20] text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800/80 rounded-xl px-2.5 py-1 font-mono font-bold text-sm shadow-xs"
                  >
                    <FormulaTokenRenderer text={dist} size="sm" />
                    <button
                      type="button"
                      onClick={() => handleRemoveDistractor(dist)}
                      className="ml-2 text-rose-500 hover:text-rose-700 text-xs font-bold"
                      title="Eliminar distractor"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddDistractor} className="flex items-center gap-2">
              <input
                type="text"
                value={customDistractor}
                onChange={(e) => setCustomDistractor(e.target.value)}
                placeholder="Añadir distractor manual (ej. 2/5, ³, -, /, sin)..."
                className="text-xs bg-white dark:bg-[#000a14] border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-1.5 outline-none text-gray-800 dark:text-gray-100 flex-grow font-mono focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!customDistractor.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shadow-xs shrink-0"
              >
                + Distractor
              </button>
            </form>
          </div>

          {/* Optional Explanation */}
          <div className="space-y-1">
            <label className="block text-xs font-black uppercase text-gray-700 dark:text-gray-200 tracking-wider">
              5. Explicación o Justificación (Opcional)
            </label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Ej. E es energía, m es la masa del objeto y c es la velocidad de la luz en el vacío..."
              className="w-full text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 outline-none text-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 bg-gray-50/50 dark:bg-[#000a14]">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              {sessionCards.length > 0 ? `Cerrar (${sessionCards.length} guardadas)` : 'Cancelar'}
            </button>
            {sessionCards.length > 0 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 sm:hidden">
                <span>✓ {sessionCards.length} en mazo</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Button 1: Save and Add Another Question to the same deck */}
            <button
              type="button"
              disabled={!question.trim() || tokens.length === 0}
              onClick={handleSaveAndAddAnother}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-50 dark:bg-[#001228] hover:bg-indigo-100 dark:hover:bg-[#001a3a] text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              title="Guarda esta tarjeta y deja el formulario listo para escribir la siguiente en este mismo mazo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Guardar y Agregar Otra</span>
            </button>

            {/* Button 2: Save and Finish / Finish and Close */}
            <button
              type="button"
              disabled={(!question.trim() || tokens.length === 0) && sessionCards.length === 0}
              onClick={handleSaveAndFinish}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>
                {question.trim() && tokens.length > 0
                  ? (sessionCards.length > 0 ? `Guardar y Finalizar (#${sessionCards.length + 1})` : 'Crear y Finalizar')
                  : `Finalizar y Salir (${sessionCards.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { Question } from '../types';
import { formatQuestionText, parseHTMLTags } from '../utils';

export interface EditQuestionModalProps {
  question: Question | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedQuestion: Question) => void;
}

const LATEX_SHORTCUTS = [
  { label: 'x²', snippet: '$x^2$' },
  { label: '√x', snippet: '$\\sqrt{x}$' },
  { label: 'a/b', snippet: '$\\frac{a}{b}$' },
  { label: '±', snippet: '$\\pm$' },
  { label: '·', snippet: '$\\cdot$' },
  { label: 'log_b', snippet: '$log_{b}(x)$' },
  { label: 'π', snippet: '$\\pi$' },
  { label: 'α', snippet: '$\\alpha$' },
  { label: 'θ', snippet: '$\\theta$' },
  { label: 'Negrita', snippet: '<b>texto</b>' },
  { label: 'Subrayado', snippet: '<u>texto</u>' },
  { label: 'Itálica', snippet: '<i>texto</i>' },
];

export const EditQuestionModal: React.FC<EditQuestionModalProps> = ({
  question,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen || !question) return null;

  // Form State
  const [questionText, setQuestionText] = useState<string>(question.questionText || '');
  const [imageUrl, setImageUrl] = useState<string>(question.imageUrl || '');
  
  const [options, setOptions] = useState<string[]>(
    question.options && question.options.length > 0 ? [...question.options] : ['', '', '', '']
  );
  const [optionsImageUrls, setOptionsImageUrls] = useState<string[]>(
    question.optionsImageUrls && question.optionsImageUrls.length > 0 
      ? [...question.optionsImageUrls] 
      : (question.options || []).map(() => '')
  );
  const [correctIndex, setCorrectIndex] = useState<number>(
    typeof question.correctIndex === 'number' && question.correctIndex >= 0 ? question.correctIndex : 0
  );

  const [explanation, setExplanation] = useState<string>(question.explanation || '');
  const [explanationImageUrl, setExplanationImageUrl] = useState<string>(question.explanationImageUrl || '');
  
  const [activeTab, setActiveTab] = useState<'EDIT' | 'PREVIEW' | 'SPLIT'>('EDIT');
  const [focusedField, setFocusedField] = useState<'questionText' | 'explanation' | number>('questionText');

  const questionTextRef = useRef<HTMLTextAreaElement>(null);
  const explanationRef = useRef<HTMLTextAreaElement>(null);
  const optionRefs = useRef<(HTMLTextAreaElement | HTMLInputElement | null)[]>([]);

  // Insert shortcut into currently active or last focused textarea
  const handleInsertShortcut = (snippet: string) => {
    let targetEl: HTMLTextAreaElement | HTMLInputElement | null = null;
    if (focusedField === 'questionText') {
      targetEl = questionTextRef.current;
    } else if (focusedField === 'explanation') {
      targetEl = explanationRef.current;
    } else if (typeof focusedField === 'number' && optionRefs.current[focusedField]) {
      targetEl = optionRefs.current[focusedField];
    }

    if (!targetEl) {
      if (focusedField === 'explanation') {
        setExplanation(prev => prev + snippet);
      } else {
        setQuestionText(prev => prev + snippet);
      }
      return;
    }

    const start = targetEl.selectionStart || 0;
    const end = targetEl.selectionEnd || 0;
    const currentVal = targetEl.value;
    const newVal = currentVal.substring(0, start) + snippet + currentVal.substring(end);

    if (focusedField === 'questionText') {
      setQuestionText(newVal);
    } else if (focusedField === 'explanation') {
      setExplanation(newVal);
    } else if (typeof focusedField === 'number') {
      setOptions(prev => {
        const next = [...prev];
        next[focusedField] = newVal;
        return next;
      });
    }

    setTimeout(() => {
      if (targetEl) {
        targetEl.focus();
        targetEl.setSelectionRange(start + snippet.length, start + snippet.length);
      }
    }, 50);
  };

  const handleOptionChange = (index: number, val: string) => {
    setOptions(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleOptionImageChange = (index: number, val: string) => {
    setOptionsImageUrls(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions(prev => [...prev, '']);
    setOptionsImageUrls(prev => [...prev, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(prev => prev.filter((_, i) => i !== index));
    setOptionsImageUrls(prev => prev.filter((_, i) => i !== index));
    if (correctIndex >= index && correctIndex > 0) {
      setCorrectIndex(prev => Math.max(0, prev - 1));
    }
  };

  const handleSave = () => {
    if (!questionText.trim()) {
      alert('Por favor ingresa el enunciado de la pregunta.');
      return;
    }
    const cleanOptions = options.map(o => o.trim());
    if (cleanOptions.some(o => !o)) {
      alert('Por favor completa todas las alternativas.');
      return;
    }

    const updated: Question = {
      ...question,
      questionText: questionText.trim(),
      imageUrl: imageUrl.trim() || undefined,
      options: cleanOptions,
      optionsImageUrls: optionsImageUrls.some(u => u.trim()) ? optionsImageUrls.map(u => u.trim()) : undefined,
      correctIndex: Math.min(Math.max(0, correctIndex), cleanOptions.length - 1),
      explanation: explanation.trim(),
      explanationImageUrl: explanationImageUrl.trim() || undefined,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-fade-in">
      <div 
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-gray-100 truncate">
                  Editar Pregunta Completa
                </h3>
                {question.subject && (
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                    {question.subject}
                  </span>
                )}
                {question.topic && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    {question.topic}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">
                Modifica el enunciado, alternativas, respuesta correcta y la solución paso a paso.
              </p>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('EDIT')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeTab === 'EDIT'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Edición
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('PREVIEW')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeTab === 'PREVIEW'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Vista Previa
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('SPLIT')}
                className={`hidden md:block px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeTab === 'SPLIT'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Dividido
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 flex items-center justify-center transition-colors shrink-0"
              title="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Math Shortcut Bar */}
        <div className="px-5 sm:px-6 py-2 bg-indigo-50/50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
          <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600 dark:text-indigo-400 shrink-0 mr-1 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Atajos KaTeX:
          </span>
          {LATEX_SHORTCUTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleInsertShortcut(item.snippet)}
              className="px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-300 rounded-md font-mono text-[11px] font-bold border border-gray-200 dark:border-slate-700 shadow-2xs transition-all active:scale-95 shrink-0"
              title={`Insertar ${item.snippet}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-grow space-y-6">
          <div className={`grid gap-6 ${activeTab === 'SPLIT' ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
            
            {/* Form Section */}
            {(activeTab === 'EDIT' || activeTab === 'SPLIT') && (
              <div className="space-y-6">
                
                {/* 1. ENUNCIADO */}
                <div className="bg-gray-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      1. Enunciado de la Pregunta
                    </label>
                  </div>
                  <textarea
                    ref={questionTextRef}
                    value={questionText}
                    onFocus={() => setFocusedField('questionText')}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Escribe el enunciado de la pregunta. Soporta KaTeX: $x^2$, $\frac{a}{b}$, etc."
                    rows={4}
                    className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl p-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y"
                  />

                  {/* Question Image URL */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-gray-500 dark:text-gray-400">
                        Imagen del Enunciado (URL Opcional)
                      </span>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="text-rose-500 hover:text-rose-600 font-bold"
                        >
                          Quitar imagen
                        </button>
                      )}
                    </div>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://ejemplo.com/grafico-pregunta.png"
                      className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {imageUrl && (
                      <div className="mt-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 max-w-xs">
                        <img src={imageUrl} alt="Vista previa enunciado" className="max-h-36 object-contain mx-auto rounded" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. ALTERNATIVAS */}
                <div className="bg-gray-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        2. Alternativas y Respuesta Correcta
                      </label>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Selecciona el radio button verde para definir la alternativa correcta.
                      </p>
                    </div>

                    {options.length < 6 && (
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="text-xs font-bold px-3 py-1 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        <span>Añadir opción</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {options.map((opt, idx) => {
                      const isCorrect = correctIndex === idx;
                      const optImg = optionsImageUrls[idx] || '';

                      return (
                        <div 
                          key={idx} 
                          className={`p-3 rounded-2xl border transition-all ${
                            isCorrect 
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-800 ring-2 ring-emerald-400/20' 
                              : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Correct Indicator & Radio */}
                            <label className="flex items-center gap-2 cursor-pointer shrink-0" title="Marcar como respuesta correcta">
                              <input
                                type="radio"
                                name="correctOption"
                                checked={isCorrect}
                                onChange={() => setCorrectIndex(idx)}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                              />
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                                isCorrect 
                                  ? 'bg-emerald-600 text-white shadow-xs' 
                                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                              }`}>
                                {String.fromCharCode(65 + idx)}
                              </span>
                            </label>

                            {/* Option Input */}
                            <input
                              ref={el => { optionRefs.current[idx] = el; }}
                              type="text"
                              value={opt}
                              onFocus={() => setFocusedField(idx)}
                              onChange={(e) => handleOptionChange(idx, e.target.value)}
                              placeholder={`Texto de alternativa ${String.fromCharCode(65 + idx)}...`}
                              className="flex-grow bg-transparent border-0 border-b border-gray-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-0 text-sm py-1.5 px-2 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
                            />

                            {/* Delete Option (if > 2) */}
                            {options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(idx)}
                                className="w-7 h-7 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors shrink-0"
                                title="Eliminar alternativa"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* Optional image for this option */}
                          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700/60 pl-11 flex items-center gap-2">
                            <input
                              type="url"
                              value={optImg}
                              onChange={(e) => handleOptionImageChange(idx, e.target.value)}
                              placeholder={`URL de imagen para opción ${String.fromCharCode(65 + idx)} (opcional)`}
                              className="flex-grow bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-gray-700 dark:text-gray-300 placeholder-gray-400 outline-none focus:border-indigo-500"
                            />
                            {optImg && (
                              <img src={optImg} alt="" className="h-6 object-contain rounded border bg-white p-0.5 shrink-0" referrerPolicy="no-referrer" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. SOLUCIÓN / RESOLUCIÓN */}
                <div className="bg-gray-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      3. Solución / Explicación Detallada
                    </label>
                  </div>
                  <textarea
                    ref={explanationRef}
                    value={explanation}
                    onFocus={() => setFocusedField('explanation')}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Explica el procedimiento paso a paso, fórmula utilizada o fundamento teórico..."
                    rows={4}
                    className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl p-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y"
                  />

                  {/* Explanation Image URL */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-gray-500 dark:text-gray-400">
                        Imagen de la Solución / Pizarra (URL Opcional)
                      </span>
                      {explanationImageUrl && (
                        <button
                          type="button"
                          onClick={() => setExplanationImageUrl('')}
                          className="text-rose-500 hover:text-rose-600 font-bold"
                        >
                          Quitar imagen
                        </button>
                      )}
                    </div>
                    <input
                      type="url"
                      value={explanationImageUrl}
                      onChange={(e) => setExplanationImageUrl(e.target.value)}
                      placeholder="https://ejemplo.com/grafico-solucion.png"
                      className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {explanationImageUrl && (
                      <div className="mt-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 max-w-xs">
                        <img src={explanationImageUrl} alt="Vista previa solución" className="max-h-36 object-contain mx-auto rounded" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Live Preview Section */}
            {(activeTab === 'PREVIEW' || activeTab === 'SPLIT') && (
              <div className="space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Vista Previa de la Pregunta
                  </span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                    Renderizado KaTeX en Vivo
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-5 space-y-4 flex-grow overflow-y-auto">
                  {/* Question Text */}
                  <div className="text-base font-semibold text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                    {questionText ? formatQuestionText(questionText) : (
                      <span className="text-gray-400 italic">El enunciado aparecerá aquí...</span>
                    )}
                  </div>

                  {/* Question Image */}
                  {imageUrl && (
                    <div className="rounded-xl overflow-hidden border dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 p-2 max-w-sm mx-auto">
                      <img src={imageUrl} alt="Ilustración" className="max-h-48 mx-auto object-contain rounded" referrerPolicy="no-referrer" />
                    </div>
                  )}

                  {/* Options List */}
                  <div className="space-y-2 pt-2">
                    {options.map((opt, idx) => {
                      const isCorrect = idx === correctIndex;
                      const optImg = optionsImageUrls[idx];

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-sm transition-all ${
                            isCorrect 
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-100 font-semibold ring-1 ring-emerald-500' 
                              : 'bg-gray-50/70 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                              isCorrect 
                                ? 'bg-emerald-600 text-white' 
                                : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                            }`}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="whitespace-pre-wrap break-words">{parseHTMLTags(opt || '...')}</span>
                            {optImg && (
                              <img src={optImg} alt="" className="h-6 object-contain rounded border bg-white p-0.5 shrink-0" referrerPolicy="no-referrer" />
                            )}
                          </div>

                          {isCorrect && (
                            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full shrink-0">
                              Correcta
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation Box */}
                  <div className="mt-4 p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/50 space-y-2">
                    <p className="text-purple-900 dark:text-purple-300 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Solución y Resolución:</span>
                    </p>
                    <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                      {explanation ? formatQuestionText(explanation) : (
                        <span className="text-gray-400 dark:text-gray-500 italic text-xs">
                          Sin explicación registrada.
                        </span>
                      )}
                    </div>
                    {explanationImageUrl && (
                      <div className="pt-2 border-t border-purple-200/50 dark:border-purple-900/40">
                        <img
                          src={explanationImageUrl}
                          alt="Solución visual"
                          className="max-h-48 rounded-lg border border-purple-200 dark:border-purple-800 object-contain mx-auto block"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between gap-3 sticky bottom-0 z-10">
          <div className="text-xs text-gray-400 hidden sm:block">
            {options.length} alternativas • Opción correcta: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{String.fromCharCode(65 + correctIndex)}</strong>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>Guardar Pregunta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Also export as EditResolutionModal for backwards compatibility with any existing imports
export const EditResolutionModal = EditQuestionModal;

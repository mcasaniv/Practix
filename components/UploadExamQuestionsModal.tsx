import React, { useState, useMemo } from 'react';
import { Question } from '../types';
import { CEPRE_BASE_TYPES } from '../constants';
import { ALL_ACADEMIC_SUBJECTS, getOfficialSubjectWeight, formatQuestionText, parseHTMLTags } from '../utils';

interface UploadExamQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveQuestions: (questions: Question[]) => void;
  existingTopics?: string[];
  initialTopic?: string;
  initialArea?: 'Biomédicas' | 'Ingenierías' | 'Sociales';
  onToast?: (msg: string) => void;
}

export const UploadExamQuestionsModal: React.FC<UploadExamQuestionsModalProps> = ({
  isOpen,
  onClose,
  onSaveQuestions,
  existingTopics = [],
  initialTopic = '',
  initialArea = 'Biomédicas',
  onToast
}) => {
  // Step 1: Exam Context
  const [area, setArea] = useState<'Biomédicas' | 'Ingenierías' | 'Sociales'>(initialArea);
  const [targetSubject, setTargetSubject] = useState<string>('Física');
  const [deckMode, setDeckMode] = useState<'EXISTING' | 'NEW'>(existingTopics.length > 0 && initialTopic ? 'EXISTING' : 'NEW');
  const [selectedExistingDeck, setSelectedExistingDeck] = useState<string>(initialTopic || (existingTopics[0] || ''));
  const [customDeckName, setCustomDeckName] = useState<string>(initialTopic && !existingTopics.includes(initialTopic) ? initialTopic : '');
  const [cepreType, setCepreType] = useState<string>('Ceprunsa I Fase');
  const [cepreYear, setCepreYear] = useState<string>('2026');
  const [week, setWeek] = useState<number | ''>('');

  // Step 2: Questions Input Mode
  const [inputTab, setInputTab] = useState<'INDIVIDUAL' | 'BULK'>('BULK');

  // Individual Form State
  const [indivQuestionText, setIndivQuestionText] = useState('');
  const [indivOptions, setIndivOptions] = useState<string[]>(['', '', '', '', '']);
  const [indivCorrectIndex, setIndivCorrectIndex] = useState(0);
  const [indivExplanation, setIndivExplanation] = useState('');

  // Bulk Input State
  const [bulkText, setBulkText] = useState('');
  const [bulkParsedQuestions, setBulkParsedQuestions] = useState<Array<{
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>>([]);

  // Queue of all prepared questions
  const [questionsQueue, setQuestionsQueue] = useState<Question[]>([]);

  // Calculate official weight
  const currentWeight = useMemo(() => {
    return getOfficialSubjectWeight(targetSubject, area);
  }, [targetSubject, area]);

  // Resolved Deck Name
  const resolvedDeckName = useMemo(() => {
    if (deckMode === 'EXISTING' && selectedExistingDeck) {
      return selectedExistingDeck.trim();
    }
    return customDeckName.trim();
  }, [deckMode, selectedExistingDeck, customDeckName]);

  // Resolved Process Name
  const resolvedProcess = useMemo(() => {
    return `${cepreType} ${cepreYear}`.trim();
  }, [cepreType, cepreYear]);

  if (!isOpen) return null;

  // Add individual question to queue
  const handleAddIndividualToQueue = () => {
    if (!resolvedDeckName) {
      if (onToast) onToast('Por favor escribe o selecciona el nombre del mazo/examen.');
      return;
    }
    if (!indivQuestionText.trim()) {
      if (onToast) onToast('Escribe el enunciado de la pregunta.');
      return;
    }
    if (indivOptions.some(o => !o.trim())) {
      if (onToast) onToast('Completa las 5 opciones de respuesta (A, B, C, D, E).');
      return;
    }

    const newQ: Question = {
      id: crypto.randomUUID(),
      course: 'Exámenes',
      subject: 'Simulacros Oficiales',
      topic: resolvedDeckName,
      questionText: indivQuestionText.trim(),
      options: indivOptions.map(o => o.trim()),
      correctIndex: indivCorrectIndex,
      explanation: indivExplanation.trim() || 'Respuesta oficial del examen.',
      order: questionsQueue.length + 1,
      createdAt: Date.now(),
      week: week !== '' ? Number(week) : undefined,
      process: resolvedProcess,
      targetSubject: targetSubject,
      area: area,
      weight: currentWeight
    };

    setQuestionsQueue(prev => [...prev, newQ]);
    setIndivQuestionText('');
    setIndivOptions(['', '', '', '', '']);
    setIndivCorrectIndex(0);
    setIndivExplanation('');
    if (onToast) onToast(`Pregunta de ${targetSubject} añadida a la cola (${currentWeight.toFixed(3)} pts).`);
  };

  // Parse bulk text into questions
  const handleParseBulk = () => {
    if (!bulkText.trim()) {
      if (onToast) onToast('Pega texto o JSON con las preguntas.');
      return;
    }

    // Try parsing as JSON first
    try {
      const parsed = JSON.parse(bulkText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const results = parsed.map((item: any) => ({
          questionText: item.questionText || item.enunciado || item.pregunta || item.q || '',
          options: Array.isArray(item.options) ? item.options : [item.a, item.b, item.c, item.d, item.e].filter(Boolean),
          correctIndex: typeof item.correctIndex === 'number' ? item.correctIndex : 0,
          explanation: item.explanation || item.solucionario || item.explicacion || 'Solución oficial.'
        })).filter(q => q.questionText && q.options.length >= 2);

        if (results.length > 0) {
          setBulkParsedQuestions(results);
          if (onToast) onToast(`Se detectaron ${results.length} preguntas en formato JSON.`);
          return;
        }
      }
    } catch {
      // Not JSON, continue to text parsing
    }

    // Parse natural text format
    const lines = bulkText.split('\n');
    const questions: Array<{
      questionText: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }> = [];

    let currentQText: string[] = [];
    let currentOpts: string[] = [];
    let currentCorrect = 0;
    let currentExp: string[] = [];
    let state: 'QUESTION' | 'OPTIONS' | 'EXP' = 'QUESTION';

    const commitQuestion = () => {
      if (currentQText.length > 0 && currentOpts.length >= 2) {
        // Complete options up to 5 if needed
        while (currentOpts.length < 5) {
          currentOpts.push(`Opción ${String.fromCharCode(65 + currentOpts.length)}`);
        }
        questions.push({
          questionText: currentQText.join('\n').trim(),
          options: currentOpts.slice(0, 5),
          correctIndex: Math.min(Math.max(0, currentCorrect), currentOpts.length - 1),
          explanation: currentExp.join('\n').trim() || `Clave correcta: ${String.fromCharCode(65 + currentCorrect)}`
        });
      }
      currentQText = [];
      currentOpts = [];
      currentCorrect = 0;
      currentExp = [];
      state = 'QUESTION';
    };

    const optRegex = /^\s*([A-Ea-e1-5])[)\].\-:]\s*(.*)$/;
    const answerRegex = /^\s*(?:respuesta|clave|rpta|correcta|solución|solucion)\s*[:=\-]\s*([A-Ea-e1-5])/i;
    const explanationRegex = /^\s*(?:explicación|explicacion|solución|solucion|sustento|resolución|resolucion)\s*[:=\-]\s*(.*)$/i;
    const questionNumberRegex = /^\s*(?:pregunta\s+)?(\d{1,3})[.)\-:]\s*(.*)$/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if it is an explicit Answer line
      const ansMatch = trimmed.match(answerRegex);
      if (ansMatch) {
        const letter = ansMatch[1].toUpperCase();
        if (['A', 'B', 'C', 'D', 'E'].includes(letter)) {
          currentCorrect = letter.charCodeAt(0) - 65;
        } else if (['1', '2', '3', '4', '5'].includes(letter)) {
          currentCorrect = parseInt(letter) - 1;
        }
        continue;
      }

      // Check if it is an Explanation line
      const expMatch = trimmed.match(explanationRegex);
      if (expMatch) {
        state = 'EXP';
        currentExp.push(expMatch[1]);
        continue;
      }

      // Check if it is an Option (A, B, C, D, E)
      const optMatch = trimmed.match(optRegex);
      if (optMatch && (state === 'QUESTION' || state === 'OPTIONS')) {
        state = 'OPTIONS';
        currentOpts.push(optMatch[2].trim());
        continue;
      }

      // Check if it starts a new question with a number like "1.", "2)", "Pregunta 3:"
      const qNumMatch = trimmed.match(questionNumberRegex);
      if (qNumMatch && currentOpts.length >= 2) {
        commitQuestion();
        currentQText.push(qNumMatch[2] ? qNumMatch[2].trim() : trimmed);
        state = 'QUESTION';
        continue;
      }

      // Append to current section
      if (state === 'EXP') {
        currentExp.push(trimmed);
      } else if (state === 'OPTIONS') {
        // Line continuation of option or explanation
        if (currentOpts.length > 0) {
          currentOpts[currentOpts.length - 1] += ' ' + trimmed;
        }
      } else {
        currentQText.push(trimmed);
      }
    }

    commitQuestion();

    if (questions.length === 0) {
      if (onToast) onToast('No se pudieron reconocer preguntas estructuradas. Asegúrate de incluir opciones A, B, C, D, E.');
      return;
    }

    setBulkParsedQuestions(questions);
    if (onToast) onToast(`¡Listo! Se reconocieron ${questions.length} preguntas.`);
  };

  // Add all bulk parsed questions to queue
  const handleAddBulkToQueue = () => {
    if (!resolvedDeckName) {
      if (onToast) onToast('Por favor escribe o selecciona el nombre del mazo/examen.');
      return;
    }
    if (bulkParsedQuestions.length === 0) {
      if (onToast) onToast('Primero procesa el texto para detectar las preguntas.');
      return;
    }

    const newQs: Question[] = bulkParsedQuestions.map((q, idx) => ({
      id: crypto.randomUUID(),
      course: 'Exámenes',
      subject: 'Simulacros Oficiales',
      topic: resolvedDeckName,
      questionText: q.questionText,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation || `Clave correcta: ${String.fromCharCode(65 + q.correctIndex)}`,
      order: questionsQueue.length + idx + 1,
      createdAt: Date.now(),
      week: week !== '' ? Number(week) : undefined,
      process: resolvedProcess,
      targetSubject: targetSubject,
      area: area,
      weight: currentWeight
    }));

    setQuestionsQueue(prev => [...prev, newQs]);
    setBulkParsedQuestions([]);
    setBulkText('');
    if (onToast) onToast(`Se añadieron ${newQs.length} preguntas de ${targetSubject} a la cola.`);
  };

  // Final Commit to Database
  const handleSaveAll = () => {
    if (questionsQueue.length === 0) {
      if (onToast) onToast('No hay preguntas en la cola para guardar.');
      return;
    }

    onSaveQuestions(questionsQueue);
    if (onToast) {
      onToast(`¡Éxito! Se guardaron ${questionsQueue.length} preguntas de ${targetSubject} en "${resolvedDeckName}" (${area}).`);
    }
    setQuestionsQueue([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#020b38] border-2 border-indigo-200 dark:border-indigo-800/80 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-gray-800 dark:text-gray-100">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                  Cursos / Exámenes / Simulacros Oficiales
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/30 text-emerald-200 border border-emerald-300/30">
                  Pesos Oficiales
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                Subir Preguntas de Examen Anterior
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-grow">
          
          {/* PASO 1: SELECCIÓN DE ÁREA Y MATERIA OBLIGATORIA */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-4 sm:p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/60 dark:border-indigo-800/60 pb-3">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                  Especificación de Área y Materia del Examen
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                  En un examen oficial cada materia tiene un valor por pregunta distinto según el Área postulada.
                </p>
              </div>
              
              {/* Badge de Puntaje Oficial */}
              <div className="bg-indigo-600 text-white px-3.5 py-1.5 rounded-xl font-mono text-xs font-black self-start sm:self-auto shrink-0 shadow-md flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-indigo-200">Valor por Pregunta:</span>
                <span className="text-sm font-black">{currentWeight.toFixed(5)} pts</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Área del Examen */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200 mb-2">
                  Área del Examen a Subir:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Biomédicas', 'Ingenierías', 'Sociales'] as const).map(areaOpt => {
                    const isSelected = area === areaOpt;
                    return (
                      <button
                        key={areaOpt}
                        type="button"
                        onClick={() => setArea(areaOpt)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center border-2 min-h-[46px] ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                            : 'bg-white dark:bg-[#030d42] text-indigo-950 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800/70 hover:border-indigo-400'
                        }`}
                      >
                        <span>{areaOpt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Materia de estas Preguntas */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200 mb-2">
                  ¿De qué materia son las preguntas?:
                </label>
                <select
                  value={targetSubject}
                  onChange={(e) => setTargetSubject(e.target.value)}
                  className="w-full bg-white dark:bg-[#030d42] border-2 border-indigo-300 dark:border-indigo-700 rounded-xl p-2.5 text-sm font-black outline-none text-indigo-950 dark:text-indigo-100 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  {ALL_ACADEMIC_SUBJECTS.map(subj => {
                    const w = getOfficialSubjectWeight(subj, area);
                    return (
                      <option key={subj} value={subj}>
                        {subj} — ({w.toFixed(3)} pts en {area})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Banner de Confirmación de Puntaje */}
            <div className="bg-white/80 dark:bg-[#030d42]/80 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="font-bold text-gray-700 dark:text-gray-200">
                  Cada pregunta de <strong className="text-indigo-600 dark:text-indigo-400">{targetSubject}</strong> sumará <strong className="text-emerald-600 dark:text-emerald-400">{currentWeight.toFixed(5)} pts</strong> en el mazo oficial ({area}).
                </span>
              </div>
            </div>
          </div>

          {/* PASO 2: ASIGNAR AL MAZO / EXAMEN OFICIAL */}
          <div className="bg-gray-50/80 dark:bg-indigo-950/20 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-indigo-800/50 space-y-4">
            <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-indigo-300 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
              Mazo del Examen Oficial (Van en el mismo mazo)
            </span>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              {/* Selector de Mazo existente o nuevo */}
              <div className="md:col-span-7">
                <label className="block text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                  Nombre del Examen / Mazo de Preguntas
                </label>
                
                {existingTopics.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDeckMode('EXISTING')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          deckMode === 'EXISTING'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white dark:bg-[#030d42] text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800/70 hover:border-indigo-400'
                        }`}
                      >
                        Añadir a examen existente
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeckMode('NEW')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          deckMode === 'NEW'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white dark:bg-[#030d42] text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800/70 hover:border-indigo-400'
                        }`}
                      >
                        Crear nuevo examen
                      </button>
                    </div>

                    {deckMode === 'EXISTING' ? (
                      <select
                        value={selectedExistingDeck}
                        onChange={(e) => setSelectedExistingDeck(e.target.value)}
                        className="w-full bg-white dark:bg-[#030d42] border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-2.5 text-sm font-bold outline-none dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      >
                        {existingTopics.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Ej. Simulacro Ceprunsa 2026 - I Fase"
                        value={customDeckName}
                        onChange={(e) => setCustomDeckName(e.target.value)}
                        className="w-full bg-white dark:bg-[#030d42] border-2 border-indigo-300 dark:border-indigo-700 rounded-xl p-2.5 text-sm font-bold outline-none dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Ej. Simulacro Ceprunsa 2026 - I Fase"
                    value={customDeckName}
                    onChange={(e) => setCustomDeckName(e.target.value)}
                    className="w-full bg-white dark:bg-[#030d42] border-2 border-indigo-300 dark:border-indigo-700 rounded-xl p-2.5 text-sm font-bold outline-none dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                )}
              </div>

              {/* Cepre / Proceso y Año */}
              <div className="md:col-span-5 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                    Proceso
                  </label>
                  <select
                    value={cepreType}
                    onChange={(e) => setCepreType(e.target.value)}
                    className="w-full bg-white dark:bg-[#030d42] border border-indigo-200 dark:border-indigo-800/70 rounded-xl p-2.5 text-xs font-bold outline-none dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  >
                    {CEPRE_BASE_TYPES.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                    Año
                  </label>
                  <input
                    type="text"
                    value={cepreYear}
                    onChange={(e) => setCepreYear(e.target.value)}
                    placeholder="2026"
                    className="w-full bg-white dark:bg-[#030d42] border border-indigo-200 dark:border-indigo-800/70 rounded-xl p-2.5 text-xs font-bold outline-none dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* PASO 3: INGRESO DE PREGUNTAS (INDIVIDUAL O BULK) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-indigo-900/60 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-indigo-300 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
                Cargar Preguntas de {targetSubject}
              </span>
              
              <div className="flex bg-gray-100 dark:bg-[#030d42] p-1 rounded-xl border border-gray-200 dark:border-indigo-900/60">
                <button
                  type="button"
                  onClick={() => setInputTab('BULK')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    inputTab === 'BULK'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-indigo-200 hover:text-indigo-600 dark:hover:text-white'
                  }`}
                >
                  Carga en Lote (Texto o JSON)
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab('INDIVIDUAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    inputTab === 'INDIVIDUAL'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-indigo-200 hover:text-indigo-600 dark:hover:text-white'
                  }`}
                >
                  Una por Una
                </button>
              </div>
            </div>

            {/* MODO 1: BULK / TEXTO O JSON */}
            {inputTab === 'BULK' && (
              <div className="space-y-4">
                <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>
                    💡 Puedes pegar preguntas con formato: <strong>1. Enunciado... A) B) C) D) E) Respuesta: B</strong> o en formato <strong>JSON</strong>.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkText(`1. ¿Cuál es la ley que establece que a toda acción corresponde una reacción de igual magnitud pero en sentido opuesto?
A) Primera ley de Newton
B) Segunda ley de Newton
C) Tercera ley de Newton
D) Ley de Gravitación Universal
E) Ley de Hooke
Respuesta: C
Explicación: La tercera ley de Newton o principio de acción y reacción establece que toda acción genera una reacción equivalente opuesta.

2. ¿Cuál es la unidad de la energía en el Sistema Internacional?
A) Watt
B) Newton
C) Pascal
D) Joule
E) Coulomb
Respuesta: D
Explicación: El Joule (J) es la unidad del Sistema Internacional para energía y trabajo.`);
                    }}
                    className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                  >
                    Pegar ejemplo de prueba
                  </button>
                </div>

                <div>
                  <textarea
                    rows={8}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`Pega aquí tus preguntas de ${targetSubject}...\n\n1. Enunciado...\nA) Opción A\nB) Opción B\nC) Opción C\nD) Opción D\nE) Opción E\nRespuesta: A\nExplicación: ...`}
                    className="w-full bg-white dark:bg-[#030d42] border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 text-xs font-mono outline-none text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 shadow-sm leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handleParseBulk}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Procesar Preguntas Detectadas</span>
                  </button>

                  {bulkParsedQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddBulkToQueue}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Agregar {bulkParsedQuestions.length} preguntas a la Cola</span>
                    </button>
                  )}
                </div>

                {/* Vista previa de preguntas detectadas */}
                {bulkParsedQuestions.length > 0 && (
                  <div className="border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 bg-white/70 dark:bg-[#030d42]/70 space-y-3">
                    <h5 className="text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Vista Previa: {bulkParsedQuestions.length} preguntas detectadas</span>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-mono">
                        {targetSubject} • {currentWeight.toFixed(3)} pts c/u
                      </span>
                    </h5>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {bulkParsedQuestions.map((q, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 dark:bg-[#020b38] rounded-xl border border-gray-200 dark:border-indigo-900/60 text-xs">
                          <p className="font-bold text-gray-800 dark:text-gray-100 mb-1">
                            {idx + 1}. {q.questionText}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-gray-600 dark:text-gray-300 mb-1.5">
                            {q.options.map((opt, optIdx) => (
                              <span key={optIdx} className={optIdx === q.correctIndex ? 'font-black text-emerald-600 dark:text-emerald-400' : ''}>
                                {String.fromCharCode(65 + optIdx)}) {opt} {optIdx === q.correctIndex ? '✓' : ''}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 italic">
                            {q.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODO 2: INDIVIDUAL */}
            {inputTab === 'INDIVIDUAL' && (
              <div className="space-y-4 bg-white dark:bg-[#030d42] border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 sm:p-5">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                    Enunciado de la Pregunta de {targetSubject}
                  </label>
                  <textarea
                    rows={3}
                    value={indivQuestionText}
                    onChange={(e) => setIndivQuestionText(e.target.value)}
                    placeholder="Escribe el enunciado de la pregunta..."
                    className="w-full bg-gray-50 dark:bg-[#020b38] border border-gray-200 dark:border-indigo-800/80 rounded-xl p-3 text-xs outline-none text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* 5 Opciones */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    Opciones de Respuesta (Marca la Correcta):
                  </label>
                  <div className="space-y-2">
                    {indivOptions.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correctOptionRadio"
                          checked={indivCorrectIndex === optIdx}
                          onChange={() => setIndivCorrectIndex(optIdx)}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                        />
                        <span className="w-6 font-black text-xs text-indigo-600 dark:text-indigo-400">
                          {String.fromCharCode(65 + optIdx)})
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...indivOptions];
                            newOpts[optIdx] = e.target.value;
                            setIndivOptions(newOpts);
                          }}
                          placeholder={`Opción ${String.fromCharCode(65 + optIdx)}`}
                          className="flex-grow bg-gray-50 dark:bg-[#020b38] border border-gray-200 dark:border-indigo-800/80 rounded-xl px-3 py-2 text-xs outline-none text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                    Explicación / Solucionario
                  </label>
                  <textarea
                    rows={2}
                    value={indivExplanation}
                    onChange={(e) => setIndivExplanation(e.target.value)}
                    placeholder="Sustento de la respuesta correcta..."
                    className="w-full bg-gray-50 dark:bg-[#020b38] border border-gray-200 dark:border-indigo-800/80 rounded-xl p-3 text-xs outline-none text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddIndividualToQueue}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Agregar Pregunta a este Mazo</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* COLA DE PREGUNTAS LISTAS PARA SUBIR */}
          {questionsQueue.length > 0 && (
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Preguntas Listas para Subir ({questionsQueue.length})</span>
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Se guardarán en el mazo <strong>"{resolvedDeckName}"</strong> ({area}).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setQuestionsQueue([])}
                  className="text-xs text-rose-600 dark:text-rose-400 font-bold hover:underline"
                >
                  Vaciar Cola
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {questionsQueue.map((q, qIdx) => (
                  <div key={q.id} className="p-3 bg-white dark:bg-[#020b38] rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-gray-500">#{qIdx + 1}</span>
                        <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black px-2 py-0.5 rounded text-[10px]">
                          {q.targetSubject}
                        </span>
                        <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black px-2 py-0.5 rounded text-[10px]">
                          {q.area}
                        </span>
                        <span className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono font-black px-2 py-0.5 rounded text-[10px]">
                          {q.weight?.toFixed(3)} pts
                        </span>
                      </div>
                      <p className="font-bold text-gray-800 dark:text-gray-100 line-clamp-2">
                        {parseHTMLTags(q.questionText)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setQuestionsQueue(prev => prev.filter(item => item.id !== q.id))}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors shrink-0"
                      title="Quitar de la cola"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-gray-50 dark:bg-[#020b38] border-t border-gray-200 dark:border-indigo-900/60 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/60 border border-transparent dark:border-indigo-800/60 transition-colors min-h-[44px]"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 dark:text-indigo-300 hidden sm:inline">
              {questionsQueue.length} {questionsQueue.length === 1 ? 'pregunta lista' : 'preguntas listas'}
            </span>
            <button
              type="button"
              disabled={questionsQueue.length === 0}
              onClick={handleSaveAll}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-black text-xs sm:text-sm px-6 py-2.5 sm:py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2 min-h-[44px]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>Guardar Preguntas en el Mazo Oficial</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

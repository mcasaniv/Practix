import React, { useState, useEffect, useRef } from 'react';
import { SavedExam, Question, ReadingText } from '../types';
import { AREA_EXAM_CONFIGS } from '../constants';
import { formatQuestionText, parseHTMLTags } from '../utils';

interface PrintExamModalProps {
  exam: SavedExam;
  allQuestions: Question[];
  readingTexts: ReadingText[];
  onClose: () => void;
}

export const PrintExamModal: React.FC<PrintExamModalProps> = ({
  exam,
  allQuestions,
  readingTexts,
  onClose
}) => {
  const isSolved = exam.score !== undefined && exam.score !== null;
  const [printMode, setPrintMode] = useState<'SOLVED' | 'BLANK'>(isSolved ? 'SOLVED' : 'BLANK');
  const [showExplanations, setShowExplanations] = useState(true);
  const [showAnswerKey, setShowAnswerKey] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map question IDs to actual question objects
  const examQuestions = React.useMemo(() => {
    const qMap = new Map(allQuestions.map(q => [q.id, q]));
    const list: { question: Question; readingText?: ReadingText; category: string }[] = [];
    const activeAreaConfig = AREA_EXAM_CONFIGS[exam.area as 'Biomédicas' | 'Ingenierías' | 'Sociales'] || AREA_EXAM_CONFIGS['Biomédicas'];

    exam.questionIds.forEach(id => {
      const q = qMap.get(id);
      if (q) {
        let catName = q.subject;
        for (const [cat, cfg] of Object.entries(activeAreaConfig)) {
          if (cfg.subjects.includes(q.subject) || cat === q.subject) {
            catName = cat;
            break;
          }
        }
        const readingText = q.readingTextId ? readingTexts.find(r => r.id === q.readingTextId) : undefined;
        list.push({ question: q, readingText, category: catName });
      }
    });
    return list;
  }, [exam, allQuestions, readingTexts]);

  // Trigger KaTeX rendering on mount / state change
  useEffect(() => {
    const renderMath = () => {
      if (containerRef.current && (window as any).renderMathInElement) {
        (window as any).renderMathInElement(containerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      }
    };
    renderMath();
    const timer = setTimeout(renderMath, 200);
    return () => clearTimeout(timer);
  }, [printMode, showExplanations, showAnswerKey]);

  const handlePrint = () => {
    window.print();
  };

  const percentage = isSolved && exam.maxScore ? Math.round((exam.score! / exam.maxScore) * 100) : 0;
  const createdDateStr = new Date(exam.createdAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex flex-col justify-between overflow-y-auto no-print-wrapper">
      {/* Control Bar - Not printed */}
      <div className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-white p-4 shadow-xl no-print">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-600 rounded-xl text-xl">🖨️</span>
            <div>
              <h2 className="text-lg font-black text-white leading-tight">Imprimir / Exportar a PDF</h2>
              <p className="text-xs text-slate-400">
                {exam.title} ({examQuestions.length} preguntas)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mode selector */}
            <div className="bg-slate-800 p-1 rounded-xl flex items-center border border-slate-700">
              <button
                onClick={() => setPrintMode('BLANK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  printMode === 'BLANK' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📄 En Blanco (Para Resolver)
              </button>
              <button
                onClick={() => setPrintMode('SOLVED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  printMode === 'SOLVED' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ✅ Resuelto (Con Claves)
              </button>
            </div>

            {/* Toggle options */}
            {printMode === 'SOLVED' ? (
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                <input
                  type="checkbox"
                  checked={showExplanations}
                  onChange={(e) => setShowExplanations(e.target.checked)}
                  className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Incluir explicaciones</span>
              </label>
            ) : (
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                <input
                  type="checkbox"
                  checked={showAnswerKey}
                  onChange={(e) => setShowAnswerKey(e.target.checked)}
                  className="rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Tabla de Claves al final</span>
              </label>
            )}

            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm px-5 py-2 rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <span>🖨️</span>
              <span>Imprimir / Guardar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition-colors"
            >
              ✕ Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Printable Paper Document Container */}
      <div className="flex-1 p-4 md:p-8 flex justify-center bg-slate-900/60 min-h-screen">
        <div 
          ref={containerRef}
          id="printable-exam-area"
          className="printable-exam-container bg-white text-slate-900 w-full max-w-4xl p-8 md:p-12 shadow-2xl rounded-2xl print:shadow-none print:rounded-none print:p-0 print:max-w-none print:w-full font-sans"
        >
          {/* Header for Exam Paper */}
          <div className="border-b-2 border-slate-900 pb-6 mb-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-700 text-white font-black text-xl rounded-lg flex items-center justify-center">
                  P
                </div>
                <div>
                  <h1 className="text-xl font-black uppercase tracking-wider text-indigo-900">PRACTIX ACADEMY</h1>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sistema de Evaluación y Simulacros de Admisión</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block bg-slate-900 text-white text-xs font-black px-3 py-1 rounded uppercase tracking-wider">
                  ÁREA {exam.area}
                </span>
                <p className="text-xs text-slate-500 font-medium mt-1">Fecha: {createdDateStr}</p>
              </div>
            </div>

            <div className="text-center py-2">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{exam.title}</h2>
              <p className="text-xs text-slate-600 font-bold uppercase tracking-widest mt-0.5">
                {exam.mode === 'CUSTOM' ? 'Examen de Selección Personalizada' : 'Simulacro Tipo Examen de Admisión'} • Total de preguntas: {examQuestions.length}
              </p>
            </div>

            {/* Student Info or Solved Score Header Box */}
            <div className="mt-4 p-4 border border-slate-300 rounded-xl bg-slate-50 text-xs">
              {printMode === 'BLANK' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="font-bold text-slate-700 block">Estudiante:</span>
                    <div className="border-b border-slate-400 mt-4"></div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 block">Fecha de Resolución:</span>
                    <div className="border-b border-slate-400 mt-4"></div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 block">Firma / Calificación:</span>
                    <div className="border-b border-slate-400 mt-4"></div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">Examen Resuelto</span>
                    <span className="text-sm font-black text-slate-800">
                      Puntaje Obtenido: {(exam.score ?? 0).toFixed(2)} / {(exam.maxScore ?? 0).toFixed(2)} pts ({percentage}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded font-black text-xs uppercase tracking-wider ${
                      percentage >= 70 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {percentage >= 70 ? 'Aprobado / Rendimiento Alto' : 'En proceso / A reforzar'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Instructions Box */}
          {printMode === 'BLANK' && (
            <div className="mb-8 p-4 border-l-4 border-slate-800 bg-slate-100/70 text-slate-800 text-xs leading-relaxed rounded-r-lg break-inside-avoid">
              <p className="font-bold uppercase tracking-wider mb-1 text-[11px]">Instrucciones Generales:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                <li>Lea detenidamente cada pregunta antes de marcar la alternativa correspondiente.</li>
                <li>Solo existe una opción correcta por cada ítem.</li>
                <li>Utilice lápiz 2B para el marcado en tarjeta o resuelva directamente en la hoja.</li>
              </ul>
            </div>
          )}

          {/* Questions List */}
          <div className="space-y-8">
            {examQuestions.map((item, idx) => {
              const q = item.question;
              const isFirstInReading = item.readingText && (idx === 0 || examQuestions[idx - 1].readingText?.id !== item.readingText.id);

              return (
                <div key={q.id} className="break-inside-avoid border-b border-slate-200 pb-6 last:border-b-0">
                  {/* Reading Text section */}
                  {isFirstInReading && item.readingText && (
                    <div className="mb-6 p-6 bg-slate-50 border border-slate-300 rounded-xl break-inside-avoid">
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-800 block mb-1">
                        📖 TEXTO DE COMPRENSIÓN LECTORA ({item.readingText.subject.toUpperCase()})
                      </span>
                      <h3 className="text-lg font-black text-slate-900 mb-3 font-serif">{item.readingText.title}</h3>
                      <div className="text-slate-800 text-sm font-serif leading-relaxed whitespace-pre-wrap italic bg-white p-4 rounded border border-slate-200">
                        {item.readingText.content}
                      </div>
                    </div>
                  )}

                  {/* Question Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className="bg-slate-900 text-white font-black text-xs w-7 h-7 rounded flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded">
                          {item.category}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase">
                          {q.subject} • {q.topic}
                        </span>
                      </div>

                      <p className="text-base font-bold text-slate-900 leading-snug whitespace-pre-wrap">
                        {formatQuestionText(q.questionText)}
                      </p>
                    </div>
                  </div>

                  {/* Image if present */}
                  {q.imageUrl && (
                    <div className="my-4 max-w-md mx-auto text-center">
                      <img src={q.imageUrl} alt="Pregunta" className="max-h-60 mx-auto rounded border border-slate-300" />
                    </div>
                  )}

                  {/* Options List */}
                  <div className="ml-10 grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    {q.options.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isCorrect = optIdx === q.correctIndex;

                      let optionStyle = "border-slate-200 bg-white text-slate-800";
                      let letterStyle = "border-slate-300 text-slate-700 bg-slate-100";

                      if (printMode === 'SOLVED') {
                        if (isCorrect) {
                          optionStyle = "border-emerald-500 bg-emerald-50 text-emerald-950 font-bold";
                          letterStyle = "bg-emerald-600 text-white border-emerald-600";
                        }
                      }

                      return (
                        <div 
                          key={optIdx} 
                          className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm transition-all ${optionStyle}`}
                        >
                          <span className={`w-6 h-6 rounded flex items-center justify-center font-black text-xs border shrink-0 ${letterStyle}`}>
                            {letter}
                          </span>
                          <span className="leading-snug">{parseHTMLTags(opt)}</span>
                          {printMode === 'SOLVED' && isCorrect && (
                            <span className="ml-auto text-xs font-black text-emerald-700">✓ Correcta</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation for SOLVED mode */}
                  {printMode === 'SOLVED' && showExplanations && (
                    <div className="ml-10 mt-3 p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-950">
                      <span className="font-black uppercase text-[10px] text-indigo-800 block mb-0.5">Explicación:</span>
                      <p className="italic leading-relaxed">{parseHTMLTags(q.explanation)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Answer Key section for BLANK print mode */}
          {printMode === 'BLANK' && showAnswerKey && (
            <div className="mt-12 pt-6 border-t-2 border-slate-900 break-inside-avoid">
              <h3 className="text-center font-black uppercase text-sm tracking-wider mb-4 text-slate-900">
                CLAVE DE RESPUESTAS (USO DOCENTE / AUTOEVALUACIÓN)
              </h3>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 border border-slate-300 p-4 rounded-xl bg-slate-50 text-center text-xs">
                {examQuestions.map((item, idx) => (
                  <div key={idx} className="border border-slate-200 bg-white p-1.5 rounded">
                    <span className="text-[10px] font-bold text-slate-400 block">{idx + 1}</span>
                    <span className="font-black text-indigo-900 text-sm">
                      {String.fromCharCode(65 + item.question.correctIndex)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer of Exam Paper */}
          <div className="mt-12 pt-4 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-medium uppercase tracking-wider">
            <span>PRACTIX ACADEMY • Documento generado para impresión / PDF</span>
            <span>Página 1 de 1</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintExamModal;

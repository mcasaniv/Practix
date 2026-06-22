
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Question, ReadingText } from '../types';
import { formatQuestionText, parseHTMLTags } from '../utils';

interface QuizViewProps {
  topicName: string;
  subjectName: string;
  questions: Question[];
  readingTexts: ReadingText[];
  onFinish: (subject: string, topic: string, score: number, total: number) => void;
}

const QuizView: React.FC<QuizViewProps> = ({ topicName, subjectName, questions, readingTexts, onFinish }) => {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, [questions, isFinished, answers]);

  const groupedQuestions = useMemo(() => {
    const groups: { text?: ReadingText, questions: Question[] }[] = [];
    const textIds = Array.from(new Set(questions.map(q => q.readingTextId)));

    textIds.forEach(id => {
      const qs = questions.filter(q => q.readingTextId === id);
      const text = readingTexts.find(t => t.id === id);
      groups.push({ text, questions: qs });
    });

    return groups;
  }, [questions, readingTexts]);

  const handleSelect = (qId: string, optIndex: number) => {
    if (isFinished) return;
    setAnswers(prev => ({ ...prev, [qId]: optIndex }));
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctIndex) score++;
    });
    return score;
  };

  const handleGrade = () => {
    const score = calculateScore();
    setIsFinished(true);
    onFinish(subjectName, topicName, score, questions.length);
  };

  const scoreValue = calculateScore();

  const renderTextWithMarkdown = (text: string) => {
    return formatQuestionText(text);
  };

  return (
    <div className="max-w-4xl mx-auto" ref={containerRef}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100">{topicName}</h2>
          <p className="text-gray-400 dark:text-gray-500 text-sm">Contesta todas las preguntas para ver tus resultados.</p>
        </div>
        {!isFinished ? (
          <button 
            onClick={handleGrade}
            className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all"
          >
            Calificar Simulacro
          </button>
        ) : (
          <div className="text-center px-6 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl">
            <span className="text-xs uppercase font-black text-indigo-400 dark:text-indigo-300 block tracking-widest">Puntaje Final</span>
            <span className="text-3xl font-black text-indigo-700 dark:text-indigo-200">{scoreValue} / {questions.length}</span>
          </div>
        )}
      </div>

      <div className="space-y-12 pb-24">
        {groupedQuestions.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-8">
            {group.text && (
              <div className="bg-slate-50 dark:bg-slate-800/40 border-l-4 border-indigo-500 rounded-r-2xl p-6 md:p-8 shadow-inner">
                <h3 className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-xs tracking-widest mb-4">LECTURA ASOCIADA</h3>
                <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">{group.text.title}</h4>
                <div className="text-gray-600 dark:text-gray-300 leading-relaxed font-serif whitespace-pre-wrap text-lg italic">
                  {group.text.content}
                </div>
              </div>
            )}

            {group.questions.map((q, qIdx) => {
              const selected = answers[q.id];
              const isCorrect = selected === q.correctIndex;
              const globalIdx = questions.indexOf(q) + 1;

              return (
                <div key={q.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 md:p-8">
                  <div className="flex items-start gap-4 mb-6">
                    <span className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 font-bold w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                      {globalIdx}
                    </span>
                    <div className="flex-grow pt-1">
                      {q.imageUrl && (
                        <div className="mb-6 rounded-2xl overflow-hidden border dark:border-slate-800 shadow-inner bg-gray-50 dark:bg-slate-800/50">
                          <img 
                            src={q.imageUrl} 
                            alt="Question Illustration" 
                            className="max-w-full h-auto mx-auto max-h-[400px] object-contain" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <p className="text-lg font-medium text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {renderTextWithMarkdown(q.questionText)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 ml-0 md:ml-14">
                    {q.options.map((opt, optIdx) => {
                      const isUserSelection = selected === optIdx;
                      const isCorrectAnswer = optIdx === q.correctIndex;

                      let bgColor = "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50";
                      let textColor = "text-gray-700 dark:text-gray-300";
                      let borderColor = "border-gray-200 dark:border-slate-700";

                      if (isFinished) {
                        if (isCorrectAnswer) {
                          bgColor = "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 ring-1 ring-emerald-500";
                          textColor = "text-emerald-800 dark:text-emerald-200";
                          borderColor = "border-emerald-500";
                        } else if (isUserSelection && !isCorrect) {
                          bgColor = "bg-rose-50 dark:bg-rose-900/30 border-rose-500 ring-1 ring-rose-500";
                          textColor = "text-rose-800 dark:text-rose-200";
                          borderColor = "border-rose-500";
                        } else {
                          bgColor = "bg-white dark:bg-slate-900 opacity-60 border-gray-200 dark:border-slate-800";
                        }
                      } else if (isUserSelection) {
                        bgColor = "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 ring-1 ring-indigo-500";
                        textColor = "text-indigo-800 dark:text-indigo-200";
                        borderColor = "border-indigo-500";
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={isFinished}
                          onClick={() => handleSelect(q.id, optIdx)}
                          className={`relative text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${bgColor} ${textColor} ${borderColor}`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isUserSelection ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-slate-600'}`}>
                            {isUserSelection && <div className="w-2 h-2 bg-white rounded-full"></div>}
                          </div>
                          <div className="flex-grow flex flex-col gap-2">
                            <span className="whitespace-pre-wrap">{parseHTMLTags(opt)}</span>
                             {q.optionsImageUrls && q.optionsImageUrls[optIdx] && (
                              <img src={q.optionsImageUrls[optIdx]} alt={`Opción ${String.fromCharCode(65 + optIdx)}`} className="max-w-full h-auto rounded-lg border dark:border-slate-700 max-h-[200px] object-contain self-start" referrerPolicy="no-referrer" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {isFinished && (
                    <div className="mt-6 ml-0 md:ml-14 bg-indigo-50/50 dark:bg-indigo-900/20 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                      <p className="text-indigo-800 dark:text-indigo-200 mb-2 font-bold flex items-center gap-1">Respuesta correcta: <span>{parseHTMLTags(q.options[q.correctIndex])}</span></p>
                      <div className="text-gray-600 dark:text-gray-400 text-sm italic leading-relaxed whitespace-pre-wrap">
                        {parseHTMLTags(q.explanation)}
                         {q.explanationImageUrl && (
                          <img src={q.explanationImageUrl} alt="Resolución" className="mt-4 max-w-full h-auto rounded-xl border dark:border-slate-700 max-h-[300px] object-contain block" referrerPolicy="no-referrer" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {!isFinished && (
          <div className="flex justify-center pt-8">
            <button 
              onClick={handleGrade}
              className="w-full md:w-auto bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black text-lg uppercase tracking-widest hover:bg-indigo-700 shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              Calificar Simulacro
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizView;
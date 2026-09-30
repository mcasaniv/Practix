
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Question, ReadingText, UserProfile, TopicResult } from '../types';
import { formatQuestionText, parseHTMLTags } from '../utils';
import { QuizizzGame } from '../components/QuizizzGame';

interface QuizViewProps {
  topicName: string;
  subjectName: string;
  questions: Question[];
  readingTexts: ReadingText[];
  results?: Record<string, TopicResult>;
  onFinish: (subject: string, topic: string, score: number, total: number, mode?: 'CLASSIC' | 'QUIZZIZ') => void;
  onBack: () => void;
  initialMode?: 'CLASSIC' | 'QUIZZIZ';
  userProfile?: UserProfile;
}

const QuizView: React.FC<QuizViewProps> = ({ 
  topicName, 
  subjectName, 
  questions, 
  readingTexts, 
  results = {},
  onFinish, 
  onBack,
  initialMode = 'CLASSIC',
  userProfile
}) => {
  const [practiceMode, setPracticeMode] = useState<'CLASSIC' | 'QUIZZIZ'>(initialMode);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTopicResult = results[`${subjectName}|${topicName}`];
  const previousTimes = currentTopicResult?.timesPracticed ?? (currentTopicResult ? 1 : 0);

  const groupedQuestions = useMemo(() => {
    const groups: { text?: ReadingText, questions: Question[] }[] = [];
    const safeQuestions = (questions || []).filter(q => Boolean(q && q.id));
    const textIds = Array.from(new Set(safeQuestions.map(q => q.readingTextId)));

    textIds.forEach(id => {
      const qs = safeQuestions.filter(q => q.readingTextId === id);
      const text = (readingTexts || []).find(t => Boolean(t && t.id === id));
      groups.push({ text, questions: qs });
    });

    return groups;
  }, [questions, readingTexts]);

  if (practiceMode === 'QUIZZIZ') {
    return (
      <QuizizzGame
        title={`${subjectName} - ${topicName}`}
        subtitle="Práctica interactiva estilo Practix con tiempo, rachas y comodines"
        questions={questions}
        readingTexts={readingTexts}
        userProfile={userProfile}
        onFinish={(score, total) => {
          onFinish(subjectName, topicName, score, total, 'QUIZZIZ');
        }}
        onBack={onBack}
      />
    );
  }

  const handleSelect = (qId: string, optIndex: number) => {
    if (isFinished || !qId) return;
    setAnswers(prev => ({ ...prev, [qId]: optIndex }));
  };

  const calculateScore = () => {
    let score = 0;
    (questions || []).forEach(q => {
      if (q && q.id && answers[q.id] === q.correctIndex) score++;
    });
    return score;
  };

  const handleGrade = () => {
    const score = calculateScore();
    setIsFinished(true);
    onFinish(subjectName, topicName, score, questions.length, 'CLASSIC');
  };

  const scoreValue = calculateScore();

  const renderTextWithMarkdown = (text: string) => {
    return formatQuestionText(text);
  };

  return (
    <div className="max-w-4xl mx-auto px-1 sm:px-4" ref={containerRef}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase tracking-wider transition-colors min-h-[44px] px-2 py-1 rounded-xl"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Salir del Simulacro
        </button>

        {/* Practice Mode Switcher */}
        <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-inner">
          <button
            onClick={() => setPracticeMode('CLASSIC')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 min-h-[38px] ${
              practiceMode === 'CLASSIC'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Clásico</span>
          </button>
          <button
            onClick={() => setPracticeMode('QUIZZIZ')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 min-h-[38px] ${
              practiceMode === 'QUIZZIZ'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Practix</span>
          </button>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 sm:p-6 mb-6 sm:mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-xl sm:text-2xl font-black text-gray-800 dark:text-gray-100">{topicName}</h2>
            {previousTimes > 0 && (
              <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{previousTimes} {previousTimes === 1 ? 'intento' : 'intentos'}</span>
              </span>
            )}
          </div>
          <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm">Contesta todas las preguntas para ver tus resultados.</p>
        </div>
        {!isFinished ? (
          <button 
            onClick={handleGrade}
            className="w-full md:w-auto bg-indigo-600 text-white px-6 sm:px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-all active:scale-95 min-h-[44px] text-sm"
          >
            Calificar Simulacro
          </button>
        ) : (
          <div className="w-full md:w-auto text-center px-6 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl">
            <span className="text-xs uppercase font-black text-indigo-400 dark:text-indigo-300 block tracking-widest">
              Puntaje Final • Intento #{previousTimes + 1}
            </span>
            <span className="text-2xl sm:text-3xl font-black text-indigo-700 dark:text-indigo-200">{scoreValue} / {questions.length}</span>
          </div>
        )}
      </div>

      <div className="space-y-8 sm:space-y-12 pb-24">
        {groupedQuestions.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-6 sm:space-y-8">
            {group.text && (
              <div className="bg-slate-50 dark:bg-slate-800/40 border-l-4 border-indigo-500 rounded-r-2xl p-4 sm:p-6 md:p-8 shadow-inner">
                <h3 className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-xs tracking-widest mb-3">LECTURA ASOCIADA</h3>
                <h4 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">{group.text.title}</h4>
                <div className="text-gray-600 dark:text-gray-300 leading-relaxed font-serif whitespace-pre-wrap text-base sm:text-lg italic">
                  {group.text.content}
                </div>
              </div>
            )}

            {group.questions.map((q, qIdx) => {
              const selected = answers[q.id];
              const isCorrect = selected === q.correctIndex;
              const globalIdx = questions.indexOf(q) + 1;

              return (
                <div key={q.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-4 sm:p-6 md:p-8">
                  <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <span className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-black text-xs sm:text-sm w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0">
                      {globalIdx}
                    </span>
                    <div className="flex-grow pt-0.5 sm:pt-1">
                      {(q.targetSubject || q.area || q.weight) && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {q.targetSubject && (
                            <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                              {q.targetSubject}
                            </span>
                          )}
                          {q.area && (
                            <span className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                              {q.area}
                            </span>
                          )}
                          {q.weight && (
                            <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 font-mono">
                              {q.weight.toFixed(3)} pts
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-base sm:text-lg font-medium text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {renderTextWithMarkdown(q.questionText)}
                      </div>
                      {q.imageUrl && (
                        <div className="mt-4 mb-3 rounded-2xl overflow-hidden border dark:border-slate-800 shadow-inner bg-gray-50 dark:bg-slate-800/50 max-w-xl mx-auto p-2">
                          <img 
                            src={q.imageUrl} 
                            alt="Question Illustration" 
                            className="max-w-full h-auto mx-auto max-h-[400px] object-contain rounded-xl" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:gap-3 ml-0 md:ml-14">
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
                          className={`relative text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start sm:items-center gap-3 sm:gap-4 min-h-[48px] active:scale-[0.99] ${bgColor} ${textColor} ${borderColor}`}
                        >
                          <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${isUserSelection ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-slate-600'}`}>
                            {isUserSelection && <div className="w-2 h-2 bg-white rounded-full"></div>}
                          </div>
                          <div className="flex-grow flex flex-col gap-2 min-w-0">
                            <span className="whitespace-pre-wrap break-words text-sm sm:text-base">{parseHTMLTags(opt)}</span>
                            {q.optionsImageUrls && q.optionsImageUrls[optIdx] && (
                              <img src={q.optionsImageUrls[optIdx]} alt={`Opción ${String.fromCharCode(65 + optIdx)}`} className="max-w-full h-auto rounded-lg border dark:border-slate-700 max-h-[200px] object-contain self-start" referrerPolicy="no-referrer" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {isFinished && (
                    <div className="mt-4 sm:mt-6 ml-0 md:ml-14 bg-indigo-50/50 dark:bg-indigo-900/20 p-4 sm:p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                      <p className="text-indigo-800 dark:text-indigo-200 mb-2 font-bold flex items-center gap-1 text-sm">Respuesta correcta: <span>{parseHTMLTags(q.options[q.correctIndex])}</span></p>
                      <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm italic leading-relaxed whitespace-pre-wrap">
                        {parseHTMLTags(q.explanation)}
                        {q.explanationImageUrl && (
                          <img src={q.explanationImageUrl} alt="Resolución" className="mt-3 max-w-full h-auto rounded-xl border dark:border-slate-700 max-h-[300px] object-contain block" referrerPolicy="no-referrer" />
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
          <div className="flex justify-center pt-4 sm:pt-8">
            <button 
              onClick={handleGrade}
              className="w-full sm:w-auto bg-indigo-600 text-white px-8 sm:px-12 py-4 sm:py-5 rounded-2xl font-black text-base sm:text-lg uppercase tracking-wider hover:bg-indigo-700 shadow-xl transition-all active:scale-95 min-h-[48px]"
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
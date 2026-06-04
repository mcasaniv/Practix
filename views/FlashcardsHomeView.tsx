import React, { useState, useMemo } from 'react';
import { ACADEMIC_STRUCTURE } from '../constants';
import { Flashcard, CourseStructure } from '../types';

interface FlashcardsHomeViewProps {
  flashcards: Flashcard[];
  onStartPlay: (course: string, subject: string, topic?: string) => void;
  onGoToAdmin: () => void;
  initialCourseName?: string | null;
  onSelectCourse?: (course: string) => void;
  onClearCourse?: () => void;
  academicStructure?: CourseStructure[];
  onMoveTopic?: (topicName: string, subjectName: string, courseName: string, direction: 'UP' | 'DOWN') => void;
}

const FlashcardsHomeView: React.FC<FlashcardsHomeViewProps> = ({ 
  flashcards = [], 
  onStartPlay,
  onGoToAdmin,
  initialCourseName,
  onSelectCourse,
  onClearCourse,
  academicStructure = ACADEMIC_STRUCTURE,
  onMoveTopic
}) => {
  const [selectedCourseName, setSelectedCourseName] = useState<string | null>(initialCourseName || null);
  const [selectedSubjectName, setSelectedSubjectName] = useState<string | null>(null);

  const handleSelectCourse = (courseName: string) => {
    setSelectedCourseName(courseName);
    setSelectedSubjectName(null); // Reset subject when changing course
    if (onSelectCourse) onSelectCourse(courseName);
  };

  const handleClearCourse = () => {
    setSelectedCourseName(null);
    setSelectedSubjectName(null);
    if (onClearCourse) onClearCourse();
  };

  // Calculate card counts
  const getCourseCardCount = (courseName: string) => {
    return flashcards.filter(f => f.course === courseName).length;
  };

  const getSubjectCardCount = (subjectName: string) => {
    return flashcards.filter(f => f.course === selectedCourseName && f.subject === subjectName).length;
  };

  const getCourseMastery = (courseName: string) => {
    const courseCards = flashcards.filter(f => f.course === courseName);
    if (courseCards.length === 0) return null;
    const rated = courseCards.filter(f => f.difficulty);
    if (rated.length === 0) return null;
    const easy = courseCards.filter(f => f.difficulty === 'EASY').length;
    const medium = courseCards.filter(f => f.difficulty === 'MEDIUM').length;
    return Math.round(((easy * 1.0 + medium * 0.5) / courseCards.length) * 100);
  };

  const getSubjectMastery = (subjectName: string) => {
    const subjectCards = flashcards.filter(f => f.course === selectedCourseName && f.subject === subjectName);
    if (subjectCards.length === 0) return null;
    const rated = subjectCards.filter(f => f.difficulty);
    if (rated.length === 0) return null;
    const easy = subjectCards.filter(f => f.difficulty === 'EASY').length;
    const medium = subjectCards.filter(f => f.difficulty === 'MEDIUM').length;
    return Math.round(((easy * 1.0 + medium * 0.5) / subjectCards.length) * 100);
  };

  const selectedCourse = academicStructure.find(c => c.name === selectedCourseName);

  // Group cards of current subject by unique topics
  const topicsData = useMemo(() => {
    if (!selectedCourseName || !selectedSubjectName) return [];
    
    const subjectCards = flashcards.filter(
      f => f.course === selectedCourseName && f.subject === selectedSubjectName
    );

    const groups: Record<string, { name: string; isDefault: boolean; count: number; easy: number; medium: number; rated: number; order: number }> = {};

    subjectCards.forEach(card => {
      // Default to a friendly title if card does not have a topic assigned
      const tName = card.topic ? card.topic.trim() : 'General / Sin Tema';
      const isDefault = !card.topic;

      if (!groups[tName]) {
        groups[tName] = {
          name: tName,
          isDefault,
          count: 0,
          easy: 0,
          medium: 0,
          rated: 0,
          order: card.order ?? 999
        };
      }
      groups[tName].count++;
      if (card.difficulty === 'EASY') groups[tName].easy++;
      if (card.difficulty === 'MEDIUM') groups[tName].medium++;
      if (card.difficulty) groups[tName].rated++;
    });

    return Object.values(groups).map(g => {
      const percent = g.rated > 0 ? Math.round(((g.easy * 1.0 + g.medium * 0.5) / g.count) * 100) : null;
      return {
        ...g,
        percent
      };
    }).sort((a, b) => {
      if (a.isDefault) return 1; // Put general at the bottom
      if (b.isDefault) return -1;
      return (a.order ?? 999) - (b.order ?? 999);
    });
  }, [flashcards, selectedCourseName, selectedSubjectName]);

  // VIEW 1: SELECT CODES / COURSES
  if (!selectedCourseName) {
    return (
      <div className="animate-fade-in">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider mb-3 inline-block">
            Módulo de Autoaprendizaje
          </span>
          <h2 className="text-4xl font-extrabold text-gray-800 dark:text-gray-100 mb-3 tracking-tight">Estudio con Flashcards</h2>
          <p className="text-gray-500 dark:text-gray-400 text-md">
            Memoriza de forma efectiva usando el algoritmo de repetición espaciada. Selecciona un curso para comenzar a repasar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {academicStructure.map((course) => {
            const count = getCourseCardCount(course.name);
            const mastery = getCourseMastery(course.name);
            return (
              <div 
                key={course.name}
                onClick={() => handleSelectCourse(course.name)}
                className="group cursor-pointer bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden relative"
              >
                {mastery !== null && (
                  <div className="absolute top-4 right-4 text-[10px] uppercase font-black tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 shadow-sm animate-fade-in">
                    <span className={`w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                      mastery >= 80 ? 'bg-emerald-500' : mastery >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}></span>
                    <span>{mastery}% dominio</span>
                  </div>
                )}

                <div className={`w-14 h-14 rounded-2xl overflow-hidden mb-4 ${course.color.split(' ')[0]} dark:opacity-90 relative shadow-inner`}>
                  <img 
                    src={course.icon} 
                    alt={course.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1 group-hover:text-indigo-600 transition-colors">
                  {course.name}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {course.subjects.length} Materias disponibles
                </p>
                
                <div className="mt-4 flex items-center justify-between">
                  <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    count > 0 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-400'
                  }`}>
                    {count === 1 ? '1 Tarjeta' : `${count} Tarjetas`}
                  </span>
                  
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // VIEW 3: SELECT TOPIC INSIDE SUBJECT
  if (selectedSubjectName) {
    const totalSubjectCards = flashcards.filter(f => f.course === selectedCourseName && f.subject === selectedSubjectName).length;

    return (
      <div className="animate-fade-in">
        <button 
          onClick={() => setSelectedSubjectName(null)}
          className="mb-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Materias
        </button>

        <div className="mb-8">
          <p className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest leading-none mb-1">
            Curso: {selectedCourseName} &gt; {selectedSubjectName}
          </p>
          <h2 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">Selecciona el Tema de Flashcards</h2>
        </div>

        {/* Big CTA to start studying all subject flashcards */}
        {totalSubjectCards > 0 && (
          <div 
            onClick={() => onStartPlay(selectedCourseName, selectedSubjectName, undefined)}
            className="mb-8 p-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl shadow-md cursor-pointer group transition-all transform hover:-translate-y-0.5 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <span className="bg-white/20 text-white font-black text-[9px] uppercase px-3 py-1 rounded-full tracking-widest">
                Recomendado
              </span>
              <h3 className="text-2xl font-black mt-2 leading-tight">Repasar Todos los Temas</h3>
              <p className="text-indigo-100 text-sm mt-1">Mezcla y practica las {totalSubjectCards} tarjetas de todos los temas de esta materia.</p>
            </div>
            <span className="px-5 py-3 bg-white text-indigo-700 font-bold rounded-xl shadow group-hover:bg-indigo-50 transition-all text-center text-sm uppercase tracking-wider shrink-0">
              Estudiar Todo
            </span>
          </div>
        )}

        {topicsData.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-8 max-w-md mx-auto">
            <span className="text-4xl block mb-3">📭</span>
            <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">Sin Tarjetas en esta Materia</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6Shared">
              Pronto se agregarán flashcards para {selectedSubjectName}. Puedes subir tus propias tarjetas desde el Editor de Preguntas en Administración.
            </p>
            <button 
              onClick={onGoToAdmin}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase transition-all"
            >
              Ir a Administración
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {topicsData.map((topic) => {
              const mastery = topic.percent;
              const nonDefaultTopics = topicsData.filter(t => !t.isDefault);
              const nonDefaultIndex = nonDefaultTopics.findIndex(t => t.name === topic.name);
              const nonDefaultCount = nonDefaultTopics.length;

              let cardBgBorder = "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/60";
              if (mastery !== null) {
                if (mastery >= 80) cardBgBorder = "bg-emerald-50/20 dark:bg-emerald-950/5 border-emerald-100/70 dark:border-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-800";
                else if (mastery >= 50) cardBgBorder = "bg-amber-50/15 dark:bg-amber-950/5 border-amber-100/70 dark:border-amber-900/50 hover:border-amber-300 dark:hover:border-amber-800";
                else cardBgBorder = "bg-rose-50/15 dark:bg-rose-950/5 border-rose-100/70 dark:border-rose-900/50 hover:border-rose-300 dark:hover:border-rose-800";
              }

              return (
                <div 
                  key={topic.name}
                  onClick={() => onStartPlay(selectedCourseName!, selectedSubjectName!, topic.isDefault ? undefined : topic.name)}
                  className={`rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md cursor-pointer group transition-all flex flex-col sm:flex-row sm:items-center justify-between border gap-4 ${cardBgBorder}`}
                >
                  <div className="flex items-center gap-4 flex-grow min-w-0">
                    <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 shadow-inner">
                      {topic.isDefault ? (
                        <span className="text-xl">★</span>
                      ) : (
                        <span>{nonDefaultIndex === -1 ? '?' : (nonDefaultIndex + 1)}</span>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {topic.name}
                        </h4>
                        
                        {mastery !== null ? (
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                            mastery >= 80 
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/40 dark:border-emerald-900/30'
                              : mastery >= 50
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/40 dark:border-amber-900/30'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200/40 dark:border-rose-900/30'
                          }`}>
                            🧠 {mastery}% dominio
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-100/40">
                            Nuevo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                        {topic.count} {topic.count === 1 ? 'tarjeta disponible' : 'tarjetas disponibles'} en este tema
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-end shrink-0" onClick={(e) => e.stopPropagation()}>
                    {onMoveTopic && !topic.isDefault && (
                      <div className="flex border dark:border-slate-800 rounded-lg overflow-hidden bg-gray-50/50 dark:bg-slate-800/50 z-10 shrink-0">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveTopic(topic.name, selectedSubjectName!, selectedCourseName!, 'UP');
                          }}
                          disabled={nonDefaultIndex === 0}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-500 dark:text-gray-400"
                          title="Mover Arriba"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveTopic(topic.name, selectedSubjectName!, selectedCourseName!, 'DOWN');
                          }}
                          disabled={nonDefaultIndex === nonDefaultCount - 1}
                          className="p-1.5 border-l dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-500 dark:text-gray-400"
                          title="Mover Abajo"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => onStartPlay(selectedCourseName!, selectedSubjectName!, topic.isDefault ? undefined : topic.name)}
                      className="bg-indigo-600 hover:bg-indigo-700 hover:shadow text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                    >
                      <span>Estudiar</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white/95" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // VIEW 2: SELECT SUBJECT INSIDE COURSE
  return (
    <div className="animate-fade-in">
      {/* Back to Courses */}
      <button 
        onClick={handleClearCourse}
        className="mb-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a Cursos
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className={`w-12 h-12 rounded-xl overflow-hidden shadow-md ${selectedCourse?.color.split(' ')[0]} dark:opacity-90`}>
          <img 
            src={selectedCourse?.icon} 
            alt={selectedCourseName} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">Materias de {selectedCourseName}</h2>
          <p className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mt-1">Estudio con Tarjetas de Memoria</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {selectedCourse?.subjects.map((subject) => {
          const count = getSubjectCardCount(subject);
          const mastery = getSubjectMastery(subject);
          
          let cardBgBorder = "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800";
          if (mastery !== null) {
            if (mastery >= 80) cardBgBorder = "bg-emerald-50/30 dark:bg-emerald-950/5 border-emerald-200 dark:border-emerald-900/55";
            else if (mastery >= 50) cardBgBorder = "bg-amber-50/20 dark:bg-amber-950/5 border-amber-200 dark:border-amber-900/55";
            else cardBgBorder = "bg-rose-50/20 dark:bg-rose-950/5 border-rose-200 dark:border-rose-900/55";
          }

          return (
            <div 
              key={subject}
              onClick={() => setSelectedSubjectName(subject)}
              className={`border rounded-2xl p-6 shadow-sm hover:shadow-md cursor-pointer group transition-all ${cardBgBorder}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {subject}
                </h3>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 dark:group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              <div className="flex items-center justify-between mt-5 border-t border-gray-100 dark:border-slate-800/40 pt-4 gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  count > 0 
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300' 
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-400'
                }`}>
                  {count === 1 ? '1 tarjeta' : `${count} tarjetas`}
                </span>

                {mastery !== null && (
                  <span className={`text-[10px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                    mastery >= 80 
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-950'
                      : mastery >= 50
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-950'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-950'
                  }`}>
                    🧠 {mastery}% Dom.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {getCourseCardCount(selectedCourseName) === 0 && (
        <div className="mt-12 p-8 text-center bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 max-w-lg mx-auto">
          <span className="text-3xl mb-3 block">🎴</span>
          <h4 className="text-lg font-bold text-amber-800 dark:text-amber-400 mb-2">No hay flashcards agregadas para este curso</h4>
          <p className="text-sm text-amber-700/80 dark:text-amber-500/80 mb-6">
            Sube o crea tarjetas para comenzar a memorizar conceptos, fórmulas y respuestas clave en {selectedCourseName}.
          </p>
          <button 
            onClick={onGoToAdmin}
            className="px-5 py-2.5 bg-amber-600 text-white font-bold rounded-xl text-sm hover:bg-amber-700 shadow-md transition-all active:scale-95"
          >
            Subir e Importar Flashcards
          </button>
        </div>
      )}
    </div>
  );
};

export default FlashcardsHomeView;

import React, { useState, useMemo } from 'react';
import { ACADEMIC_STRUCTURE } from '../constants';
import { Flashcard, CourseStructure } from '../types';
import { ImageOcclusionModal } from '../components/ImageOcclusionModal';
import { FormulaBuilderModal } from '../components/FormulaBuilderModal';
import { FlashcardTopicCard } from '../components/FlashcardTopicCard';

interface FlashcardsHomeViewProps {
  flashcards: Flashcard[];
  onStartPlay: (course: string, subject: string, topic?: string) => void;
  onGoToAdmin: () => void;
  initialCourseName?: string | null;
  onSelectCourse?: (course: string) => void;
  onClearCourse?: () => void;
  academicStructure?: CourseStructure[];
  onMoveTopic?: (topicName: string, subjectName: string, courseName: string, direction: 'UP' | 'DOWN') => void;
  onSaveFlashcardsBatch?: (cards: Flashcard[]) => void;
  onToast?: (msg: string) => void;
}

const FlashcardsHomeView: React.FC<FlashcardsHomeViewProps> = ({ 
  flashcards = [], 
  onStartPlay,
  onGoToAdmin,
  initialCourseName,
  onSelectCourse,
  onClearCourse,
  academicStructure = ACADEMIC_STRUCTURE,
  onMoveTopic,
  onSaveFlashcardsBatch,
  onToast
}) => {
  const [selectedCourseName, setSelectedCourseName] = useState<string | null>(initialCourseName || null);
  const [selectedSubjectName, setSelectedSubjectName] = useState<string | null>(null);
  const [showOcclusionModal, setShowOcclusionModal] = useState<boolean>(false);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [presetTopicName, setPresetTopicName] = useState<string>('');

  const handleSelectCourse = (courseName: string) => {
    setSelectedCourseName(courseName);
    setSelectedSubjectName(null);
    if (onSelectCourse) onSelectCourse(courseName);
  };

  const handleClearCourse = () => {
    setSelectedCourseName(null);
    setSelectedSubjectName(null);
    if (onClearCourse) onClearCourse();
  };

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

  const topicsData = useMemo(() => {
    if (!selectedCourseName || !selectedSubjectName) return [];
    
    const subjectCards = flashcards.filter(
      f => f.course === selectedCourseName && f.subject === selectedSubjectName
    );

    const groups: Record<string, { name: string; isDefault: boolean; count: number; easy: number; medium: number; rated: number; order: number; imageCount: number }> = {};

    subjectCards.forEach(card => {
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
          order: card.order ?? 999,
          imageCount: 0
        };
      }
      groups[tName].count++;
      if (card.difficulty === 'EASY') groups[tName].easy++;
      if (card.difficulty === 'MEDIUM') groups[tName].medium++;
      if (card.difficulty) groups[tName].rated++;
      if (card.type === 'IMAGE_OCCLUSION' || card.imageUrl) groups[tName].imageCount++;
    });

    return Object.values(groups).map(g => {
      const percent = g.rated > 0 ? Math.round(((g.easy * 1.0 + g.medium * 0.5) / g.count) * 100) : null;
      return {
        ...g,
        percent
      };
    }).sort((a, b) => {
      if (a.isDefault) return 1;
      if (b.isDefault) return -1;
      return (a.order ?? 999) - (b.order ?? 999);
    });
  }, [flashcards, selectedCourseName, selectedSubjectName]);

  // VIEW 1: SELECT CODES / COURSES
  if (!selectedCourseName) {
    return (
      <div className="space-y-6 sm:space-y-8 animate-fade-in">
        <div className="text-center max-w-2xl mx-auto px-2">
          <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider mb-2.5 inline-block">
            Módulo Memory • Memorización Activa
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-800 dark:text-white mb-2 tracking-tight">
            Memory: Tarjetas & Juegos de Memoria
          </h2>
          <p className="text-gray-500 dark:text-white/80 text-xs sm:text-sm">
            Memoriza fórmulas, definiciones y conceptos con Flashcards 3D, Unir Parejas, Opción Múltiple y Selección Múltiple de propiedades y valencias.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            <button
              onClick={() => setShowOcclusionModal(true)}
              className="px-5 py-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2.5 border border-indigo-400/30 min-h-[44px]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Subir Imagen con Oclusión</span>
            </button>

            <button
              onClick={() => setShowFormulaModal(true)}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2.5 border border-amber-300/30 min-h-[44px]"
            >
              <span className="text-base sm:text-lg">🧩</span>
              <span>Armar Fórmula (Bloques)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5">
          {academicStructure.map((course) => {
            const count = getCourseCardCount(course.name);
            const mastery = getCourseMastery(course.name);
            return (
              <div 
                key={course.name}
                onClick={() => handleSelectCourse(course.name)}
                className="group cursor-pointer bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 sm:p-5 hover:shadow-xl hover:dark:border-slate-700 active:scale-[0.98] transition-all overflow-hidden relative"
              >
                {mastery !== null && (
                  <div className="absolute top-3.5 right-3.5 text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1.5 bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-white border border-indigo-100 dark:border-slate-700 shadow-sm">
                    <span className={`w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                      mastery >= 80 ? 'bg-emerald-500' : mastery >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}></span>
                    <span className="dark:text-white">{mastery}%</span>
                  </div>
                )}

                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden mb-3.5 ${course.color.split(' ')[0]} dark:opacity-90 relative shadow-inner`}>
                  <img 
                    src={course.icon} 
                    alt={course.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h3 className="text-lg font-black text-gray-800 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {course.name}
                </h3>
                <p className="text-gray-400 dark:text-white/80 text-xs font-semibold">
                  {course.subjects.length} Materias
                </p>
                
                <div className="mt-3.5 pt-3 border-t border-gray-50 dark:border-slate-800 flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    count > 0 
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-white border border-emerald-200/50 dark:border-emerald-800/60' 
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-white/60'
                  }`}>
                    {count === 1 ? '1 Tarjeta' : `${count} Tarjetas`}
                  </span>
                  
                  <span className="text-xs font-bold text-indigo-500 group-hover:translate-x-1 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <ImageOcclusionModal
          isOpen={showOcclusionModal}
          onClose={() => {
            setShowOcclusionModal(false);
            setPresetTopicName('');
          }}
          initialCourseName={selectedCourseName}
          initialSubjectName={selectedSubjectName}
          initialTopicName={presetTopicName}
          academicStructure={academicStructure}
          onSaveFlashcards={(newCards) => {
            if (onSaveFlashcardsBatch) onSaveFlashcardsBatch(newCards);
          }}
          onToast={onToast}
        />

        <FormulaBuilderModal
          isOpen={showFormulaModal}
          onClose={() => {
            setShowFormulaModal(false);
            setPresetTopicName('');
          }}
          initialCourseName={selectedCourseName}
          initialSubjectName={selectedSubjectName}
          initialTopicName={presetTopicName}
          academicStructure={academicStructure}
          onSaveFlashcards={(newCards) => {
            if (onSaveFlashcardsBatch) onSaveFlashcardsBatch(newCards);
          }}
          onToast={onToast}
        />
      </div>
    );
  }

  // VIEW 3: SELECT TOPIC INSIDE SUBJECT
  if (selectedSubjectName) {
    const totalSubjectCards = flashcards.filter(f => f.course === selectedCourseName && f.subject === selectedSubjectName).length;

    return (
      <div id="flashcards-home-topics-root" className="space-y-6 animate-fade-in">
        <button 
          onClick={() => setSelectedSubjectName(null)}
          className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs sm:text-sm min-h-[44px] px-2 py-1 rounded-xl hover:underline"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Materias
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest leading-none mb-1">
              {selectedCourseName} • {selectedSubjectName}
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white">
              Temas de Flashcards
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFormulaModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0 min-h-[42px]"
            >
              <span>🧩</span>
              <span>+ Armar Fórmula</span>
            </button>

            <button
              onClick={() => setShowOcclusionModal(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0 min-h-[42px]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>+ Imagen con Oclusión</span>
            </button>
          </div>
        </div>

        {/* Big CTA to start studying all subject flashcards */}
        {totalSubjectCards > 0 && (
          <div 
            onClick={() => onStartPlay(selectedCourseName, selectedSubjectName, undefined)}
            className="p-4 sm:p-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl shadow-md cursor-pointer group active:scale-[0.99] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <span className="bg-white/20 text-white font-black text-[9px] uppercase px-3 py-1 rounded-full tracking-widest inline-block">
                Recomendado
              </span>
              <h3 className="text-xl sm:text-2xl font-black mt-2 leading-tight">Repasar Todos los Temas</h3>
              <p className="text-indigo-100 text-xs sm:text-sm mt-1">Mezcla y practica las {totalSubjectCards} tarjetas de todos los temas de esta materia.</p>
            </div>
            <button className="px-5 py-3 bg-white text-indigo-700 font-black rounded-xl shadow group-hover:bg-indigo-50 transition-all text-center text-xs sm:text-sm uppercase tracking-wider shrink-0 min-h-[44px]">
              Estudiar Todo
            </button>
          </div>
        )}

        {topicsData.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 max-w-md mx-auto shadow-sm">
            <div className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-slate-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-gray-800 dark:text-white mb-2">Sin Tarjetas en esta Materia</h4>
            <p className="text-xs text-gray-500 dark:text-white/80 mb-5">
              Pronto se agregarán flashcards para {selectedSubjectName}. Puedes subir tus propias tarjetas o imágenes con oclusión.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button 
                onClick={() => setShowOcclusionModal(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase transition-all min-h-[44px]"
              >
                + Subir Imagen con Oclusión
              </button>
              <button 
                onClick={onGoToAdmin}
                className="px-5 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-white border border-gray-200 dark:border-slate-700 font-bold rounded-xl text-xs uppercase transition-all min-h-[44px]"
              >
                Ir a Administración
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:gap-4">
            {topicsData.map((topic, index) => {
              const nonDefaultTopics = topicsData.filter(t => !t.isDefault);
              const nonDefaultIndex = nonDefaultTopics.findIndex(t => t.name === topic.name);
              const nonDefaultCount = nonDefaultTopics.length;

              return (
                <FlashcardTopicCard
                  key={topic.name}
                  topic={topic}
                  index={index}
                  nonDefaultIndex={nonDefaultIndex}
                  nonDefaultCount={nonDefaultCount}
                  selectedCourseName={selectedCourseName!}
                  selectedSubjectName={selectedSubjectName!}
                  onStartPlay={onStartPlay}
                  onMoveTopic={onMoveTopic}
                  onUploadOcclusionForTopic={(topicName) => {
                    setPresetTopicName(topicName);
                    setShowOcclusionModal(true);
                  }}
                  onCreateFormulaForTopic={(topicName) => {
                    setPresetTopicName(topicName);
                    setShowFormulaModal(true);
                  }}
                />
              );
            })}
          </div>
        )}

        <ImageOcclusionModal
          isOpen={showOcclusionModal}
          onClose={() => {
            setShowOcclusionModal(false);
            setPresetTopicName('');
          }}
          initialCourseName={selectedCourseName}
          initialSubjectName={selectedSubjectName}
          initialTopicName={presetTopicName}
          academicStructure={academicStructure}
          onSaveFlashcards={(newCards) => {
            if (onSaveFlashcardsBatch) onSaveFlashcardsBatch(newCards);
          }}
          onToast={onToast}
        />

        <FormulaBuilderModal
          isOpen={showFormulaModal}
          onClose={() => {
            setShowFormulaModal(false);
            setPresetTopicName('');
          }}
          initialCourseName={selectedCourseName}
          initialSubjectName={selectedSubjectName}
          initialTopicName={presetTopicName}
          academicStructure={academicStructure}
          onSaveFlashcards={(newCards) => {
            if (onSaveFlashcardsBatch) onSaveFlashcardsBatch(newCards);
          }}
          onToast={onToast}
        />
      </div>
    );
  }

  // VIEW 2: SELECT SUBJECT INSIDE COURSE
  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <button 
        onClick={handleClearCourse}
        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs sm:text-sm min-h-[44px] px-2 py-1 rounded-xl hover:underline"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a Cursos
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-md ${selectedCourse?.color.split(' ')[0]} dark:opacity-90 shrink-0`}>
            <img 
              src={selectedCourse?.icon} 
              alt={selectedCourseName} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white truncate">
              Materias de {selectedCourseName}
            </h2>
            <p className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mt-0.5">
              Estudio con Tarjetas de Memoria
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowOcclusionModal(true)}
          className="self-start sm:self-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0 min-h-[42px]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>+ Imagen con Oclusión</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
        {selectedCourse?.subjects.map((subject) => {
          const count = getSubjectCardCount(subject);
          const mastery = getSubjectMastery(subject);
          
          let cardBgBorder = "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-slate-700";
          if (mastery !== null) {
            if (mastery >= 80) cardBgBorder = "bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700/80 hover:border-emerald-400";
            else if (mastery >= 50) cardBgBorder = "bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700/80 hover:border-amber-400";
            else cardBgBorder = "bg-white dark:bg-slate-900 border-rose-300 dark:border-rose-700/80 hover:border-rose-400";
          }

          return (
            <div 
              key={subject}
              onClick={() => setSelectedSubjectName(subject)}
              className={`border rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer group transition-all ${cardBgBorder}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                  {subject}
                </h3>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300 dark:text-slate-500 group-hover:text-indigo-400 dark:group-hover:text-indigo-300 group-hover:translate-x-1 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              <div className="flex items-center justify-between mt-4 border-t border-gray-100 dark:border-slate-800 pt-3 gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  count > 0 
                    ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-white border border-indigo-200/50 dark:border-slate-700' 
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-white/60'
                }`}>
                  {count === 1 ? '1 tarjeta' : `${count} tarjetas`}
                </span>

                {mastery !== null && (
                  <span className={`text-[10px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                    mastery >= 80 
                      ? 'bg-emerald-100/80 dark:bg-emerald-950/70 text-emerald-800 dark:text-white border-emerald-300/80 dark:border-emerald-700/70'
                      : mastery >= 50
                        ? 'bg-amber-100/80 dark:bg-amber-950/70 text-amber-800 dark:text-white border-amber-300/80 dark:border-amber-700/70'
                        : 'bg-rose-100/80 dark:bg-rose-950/70 text-rose-800 dark:text-white border-rose-300/80 dark:border-rose-700/70'
                  }`}>
                    <span className="dark:text-white">{mastery}%</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {getCourseCardCount(selectedCourseName) === 0 && (
        <div className="mt-8 p-6 sm:p-8 text-center bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 max-w-lg mx-auto">
          <div className="w-12 h-12 mx-auto mb-2 text-amber-500 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h4 className="text-base sm:text-lg font-bold text-amber-800 dark:text-amber-400 mb-2">No hay flashcards agregadas para este curso</h4>
          <p className="text-xs sm:text-sm text-amber-700/80 dark:text-amber-500/80 mb-5">
            Sube o crea tarjetas para comenzar a memorizar conceptos, fórmulas y respuestas clave en {selectedCourseName}.
          </p>
          <button 
            onClick={onGoToAdmin}
            className="px-5 py-2.5 bg-amber-600 text-white font-bold rounded-xl text-xs sm:text-sm hover:bg-amber-700 shadow-md transition-all active:scale-95 min-h-[44px]"
          >
            Subir e Importar Flashcards
          </button>
        </div>
      )}

      <ImageOcclusionModal
        isOpen={showOcclusionModal}
        onClose={() => {
          setShowOcclusionModal(false);
          setPresetTopicName('');
        }}
        initialCourseName={selectedCourseName}
        initialSubjectName={selectedSubjectName}
        initialTopicName={presetTopicName}
        academicStructure={academicStructure}
        onSaveFlashcards={(newCards) => {
          if (onSaveFlashcardsBatch) onSaveFlashcardsBatch(newCards);
        }}
        onToast={onToast}
      />

      <FormulaBuilderModal
        isOpen={showFormulaModal}
        onClose={() => {
          setShowFormulaModal(false);
          setPresetTopicName('');
        }}
        initialCourseName={selectedCourseName}
        initialSubjectName={selectedSubjectName}
        initialTopicName={presetTopicName}
        academicStructure={academicStructure}
        onSaveFlashcards={(newCards) => {
          if (onSaveFlashcardsBatch) onSaveFlashcardsBatch(newCards);
        }}
        onToast={onToast}
      />
    </div>
  );
};

export default FlashcardsHomeView;

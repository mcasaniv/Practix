
import React, { useState } from 'react';
import { ViewType, NavigationState, AppDatabase } from '../types';

interface NavbarProps {
  onNavigate: (view: ViewType, params?: Partial<NavigationState>) => void;
  onBack: () => void;
  onImport: (data: AppDatabase) => void;
  onExport: () => void;
  onResetPracticed: () => void;
  onResetFlashcardsPracticed: () => void;
  currentView: ViewType;
  navState: NavigationState;
  isDark: boolean;
  toggleTheme: () => void;
  totalPracticed: number;
  totalFlashcardsPracticed: number;
  onToast: (message: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  onNavigate, 
  onBack, 
  onImport, 
  onExport, 
  onResetPracticed,
  onResetFlashcardsPracticed,
  currentView, 
  navState, 
  isDark, 
  toggleTheme,
  totalPracticed,
  totalFlashcardsPracticed,
  onToast
}) => {
  const [showResetModal, setShowResetModal] = useState(false);
  const [showResetFlashcardsModal, setShowResetFlashcardsModal] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        onImport(json);
      } catch (err) {
        onToast("Error al procesar el archivo JSON.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <nav className="bg-indigo-700 dark:bg-indigo-900 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {currentView !== 'HOME' && (
            <button 
              onClick={onBack}
              className="p-2 hover:bg-indigo-600 dark:hover:bg-indigo-800 rounded-full transition-colors"
              title="Volver"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <div 
            className="cursor-pointer flex items-center gap-2.5 group" 
            onClick={() => onNavigate('HOME')}
          >
            {/* Espacio diseñado para el logo de la app */}
            <div className="w-10 h-10 flex items-center justify-center overflow-hidden transition-all duration-300 hover:scale-105 shrink-0" title="Logo de la App">
              <img 
                src="https://i.imgur.com/cXKUutn.png" 
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const parent = (e.currentTarget as HTMLElement).parentElement;
                  if (parent && !parent.querySelector('.fallback-badge')) {
                    const fallback = document.createElement('span');
                    fallback.className = "fallback-badge text-[15px] font-black text-white/90 select-none bg-white/10 px-2.5 py-1 rounded-lg";
                    fallback.innerText = "AU";
                    parent.appendChild(fallback);
                  }
                }}
                alt="Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white group-hover:text-indigo-100 transition-colors">Academia Ugarte</h1>
          </div>
          <div className="flex bg-indigo-800/65 dark:bg-indigo-950/65 p-1 rounded-xl ml-2 sm:ml-4 text-xs border border-indigo-400/20">
            <button 
              onClick={() => onNavigate('HOME')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${currentView !== 'FLASHCARDS_HOME' && currentView !== 'FLASHCARDS_SUBJECTS' && currentView !== 'FLASHCARDS_PLAY' ? 'bg-indigo-600 dark:bg-indigo-800 text-white shadow-sm' : 'text-indigo-200 hover:text-white'}`}
            >
              Práctica
            </button>
            <button 
              onClick={() => onNavigate('FLASHCARDS_HOME')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${currentView === 'FLASHCARDS_HOME' || currentView === 'FLASHCARDS_SUBJECTS' || currentView === 'FLASHCARDS_PLAY' ? 'bg-indigo-600 dark:bg-indigo-800 text-white shadow-sm' : 'text-indigo-200 hover:text-white'}`}
            >
              Flashcards
            </button>
          </div>
        </div>

        {/* Contadores de Preguntas y Flashcards */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Contador de Preguntas */}
          <div className="flex items-center gap-2 bg-indigo-805/40 dark:bg-indigo-950/40 px-3.5 py-1.5 rounded-2xl border border-indigo-400/20 backdrop-blur-sm group">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <div className="flex flex-col leading-none">
              <span className="text-[9px] uppercase font-black text-indigo-300/85 tracking-tighter">Preguntas</span>
              <span className="text-lg font-black font-mono">{totalPracticed}</span>
            </div>
            <button 
              onClick={() => setShowResetModal(true)}
              className="ml-1 p-1 hover:bg-white/10 rounded-full text-indigo-300 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
              title="Reiniciar contador de preguntas"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Contador de Flashcards */}
          <div className="flex items-center gap-2 bg-indigo-805/40 dark:bg-indigo-950/40 px-3.5 py-1.5 rounded-2xl border border-indigo-400/20 backdrop-blur-sm group">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div className="flex flex-col leading-none">
              <span className="text-[9px] uppercase font-black text-indigo-300/85 tracking-tighter">Flashcards</span>
              <span className="text-lg font-black font-mono">{totalFlashcardsPracticed}</span>
            </div>
            <button 
              onClick={() => setShowResetFlashcardsModal(true)}
              className="ml-1 p-1 hover:bg-white/10 rounded-full text-indigo-300 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
              title="Reiniciar contador de flashcards"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 bg-indigo-800 dark:bg-indigo-950 hover:bg-indigo-600 rounded-lg transition-colors mr-2"
            title={isDark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
          >
            {isDark ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.95 16.95l.707.707M7.05 7.05l.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <label className="cursor-pointer bg-indigo-800 dark:bg-indigo-950 hover:bg-indigo-600 dark:hover:bg-indigo-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Importar</span>
            <input type="file" className="hidden" accept=".json" onChange={handleFileChange} />
          </label>
          <button 
            onClick={onExport}
            className="bg-indigo-800 dark:bg-indigo-950 hover:bg-indigo-600 dark:hover:bg-indigo-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Exportar</span>
          </button>
          <button 
            onClick={() => onNavigate('ADMIN')}
            className="bg-white text-indigo-700 hover:bg-gray-100 dark:bg-indigo-100 dark:hover:bg-white px-4 py-2 rounded-lg text-sm font-bold transition-colors ml-2"
          >
            Panel Admin
          </button>
        </div>
      </div>
      
      {/* Breadcrumbs / Subtitle */}
      <div className="bg-indigo-800/50 dark:bg-indigo-950/50 py-1.5 px-4 text-xs font-medium text-indigo-100 border-t border-indigo-600/30 dark:border-indigo-800/30">
        <div className="container mx-auto">
          {currentView === 'HOME' && "Inicio / Cursos"}
          {currentView === 'SUBJECTS' && `Cursos / ${navState.selectedCourse}`}
          {currentView === 'TOPICS' && `Cursos / ${navState.selectedCourse} / ${navState.selectedSubject}`}
          {currentView === 'QUIZ' && `Cursos / ${navState.selectedCourse} / ${navState.selectedSubject} / ${navState.selectedTopic}`}
          {currentView === 'ADMIN' && "Administración / Editor de Preguntas"}
          {currentView === 'MEGA_QUIZ' && "Simulacro / General 80 Preguntas"}
          {currentView === 'FLASHCARDS_HOME' && (navState.selectedCourse ? `Flashcards / ${navState.selectedCourse}` : "Flashcards / Inicio")}
          {currentView === 'FLASHCARDS_PLAY' && `Flashcards / ${navState.selectedCourse} / ${navState.selectedSubject}${navState.selectedTopic ? ` / ${navState.selectedTopic}` : ''}`}
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100 dark:border-slate-800 text-gray-800 dark:text-gray-100">
            <h3 className="text-xl font-bold mb-2">Reiniciar Preguntas</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ¿Deseas reiniciar el contador de preguntas practicadas a cero?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onResetPracticed();
                  setShowResetModal(false);
                }}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
              >
                Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetFlashcardsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100 dark:border-slate-800 text-gray-800 dark:text-gray-100">
            <h3 className="text-xl font-bold mb-2">Reiniciar Flashcards</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ¿Deseas reiniciar el contador de flashcards practicadas a cero?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetFlashcardsModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onResetFlashcardsPracticed();
                  setShowResetFlashcardsModal(false);
                }}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
              >
                Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

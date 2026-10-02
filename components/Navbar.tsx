import React, { useState } from 'react';
import { ViewType, NavigationState, AppDatabase } from '../types';

interface NavbarProps {
  onNavigate: (view: ViewType, params?: Partial<NavigationState>) => void;
  onBack: () => void;
  onImport: (data: any) => void;
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const isExamView = currentView === 'QUIZ' || currentView === 'MEGA_QUIZ' || currentView === 'MIXED_QUIZ' || currentView === 'FLASHCARDS_PLAY';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        onImport(text);
        setShowMobileMenu(false);
      } catch (err: any) {
        onToast(err?.message || "Error al procesar el archivo JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getBreadcrumbTitle = () => {
    switch (currentView) {
      case 'HOME':
        return 'Inicio / Cursos';
      case 'CUSTOM_DECKS':
        return 'Mis Mazos';
      case 'STATS':
        return 'Estadísticas y Progreso';
      case 'SUBJECTS':
        return navState.selectedCourse ? `${navState.selectedCourse}` : 'Materias';
      case 'TOPICS':
        return navState.selectedSubject ? `${navState.selectedSubject}` : 'Temas';
      case 'EXAM_SETUP':
        return 'Configurar Simulacro';
      case 'ADMIN':
        return 'Panel de Administración';
      case 'FLASHCARDS_HOME':
        return navState.selectedCourse ? `Flashcards / ${navState.selectedCourse}` : 'Flashcards';
      default:
        return 'Practix';
    }
  };

  const isCursosActive = ['HOME', 'SUBJECTS', 'TOPICS'].includes(currentView);
  const isDecksActive = currentView === 'CUSTOM_DECKS';
  const isFlashcardsActive = ['FLASHCARDS_HOME', 'FLASHCARDS_SUBJECTS'].includes(currentView);
  const isExamActive = currentView === 'EXAM_SETUP';
  const isStatsActive = currentView === 'STATS';
  const isAdminActive = currentView === 'ADMIN';

  return (
    <>
      {/* TOP NAVIGATION BAR */}
      <nav 
        className={`w-full bg-indigo-700 dark:bg-indigo-950 text-white shadow-md ${isExamView ? 'relative' : 'sticky top-0'} z-40 transition-colors`}
        style={!isExamView ? { position: 'sticky', top: 0, zIndex: 40 } : undefined}
      >
        {/* DESKTOP TOP BAR (lg and above: 1024px+) */}
        <div className="hidden lg:block w-full">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2.5 flex items-center justify-between gap-2 xl:gap-4 w-full">
            <div className="flex items-center gap-2 xl:gap-3 shrink-0">
              {currentView !== 'HOME' && (
                <button 
                  onClick={onBack}
                  className="p-2 hover:bg-indigo-600 dark:hover:bg-indigo-800 rounded-full transition-colors flex items-center justify-center min-w-[38px] min-h-[38px]"
                  title="Volver"
                  aria-label="Volver atrás"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
              )}
              <div 
                className="cursor-pointer flex items-center gap-2 group shrink-0" 
                onClick={() => onNavigate('HOME')}
              >
                <div className="w-8 h-8 xl:w-9 xl:h-9 flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-105 shrink-0" title="Practix">
                  <img 
                    src="https://i.imgur.com/hqV69r2.png" 
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const parent = (e.currentTarget as HTMLElement).parentElement;
                      if (parent && !parent.querySelector('.fallback-badge')) {
                        const fallback = document.createElement('span');
                        fallback.className = "fallback-badge text-[13px] font-black text-white/90 select-none bg-white/10 px-2 py-0.5 rounded-lg";
                        fallback.innerText = "PX";
                        parent.appendChild(fallback);
                      }
                    }}
                    alt="Logo" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h1 className="text-lg xl:text-xl font-black tracking-tight text-white group-hover:text-indigo-100 transition-colors">Practix</h1>
              </div>

              {/* Desktop Nav Switcher */}
              <div className="flex bg-indigo-800/70 dark:bg-indigo-900/60 p-1 rounded-xl ml-1.5 xl:ml-3 text-xs border border-indigo-400/20 shrink-0">
                <button 
                  id="nav-btn-practice"
                  onClick={() => onNavigate('HOME')}
                  className={`px-2 xl:px-3 py-1.5 rounded-lg font-bold transition-all ${isCursosActive ? 'bg-indigo-600 dark:bg-indigo-800 text-white shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                >
                  Práctica
                </button>
                <button 
                  id="nav-btn-decks"
                  onClick={() => onNavigate('CUSTOM_DECKS')}
                  className={`px-2 xl:px-3 py-1.5 rounded-lg font-bold transition-all ${isDecksActive ? 'bg-indigo-600 dark:bg-indigo-800 text-white shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                >
                  Mazos
                </button>
                <button 
                  id="nav-btn-flashcards"
                  onClick={() => onNavigate('FLASHCARDS_HOME')}
                  className={`px-2 xl:px-3 py-1.5 rounded-lg font-bold transition-all ${isFlashcardsActive ? 'bg-indigo-600 dark:bg-indigo-800 text-white shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                >
                  Flashcards
                </button>
                <button 
                  id="nav-btn-exam"
                  onClick={() => onNavigate('EXAM_SETUP')}
                  className={`px-2 xl:px-3 py-1.5 rounded-lg font-bold transition-all ${isExamActive ? 'bg-indigo-600 dark:bg-indigo-800 text-white shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                >
                  Simulacros
                </button>
                <button 
                  id="nav-btn-stats"
                  onClick={() => onNavigate('STATS')}
                  className={`px-2 xl:px-3 py-1.5 rounded-lg font-bold transition-all ${isStatsActive ? 'bg-indigo-600 dark:bg-indigo-800 text-white shadow-sm' : 'text-indigo-200 hover:text-white'}`}
                >
                  Estadísticas
                </button>
              </div>
            </div>

            {/* Desktop Right Counters & Controls */}
            <div className="flex items-center gap-1.5 xl:gap-2.5 shrink-0 ml-auto">
              {/* Contador de Preguntas */}
              <div className="flex items-center gap-1.5 bg-indigo-800/50 dark:bg-indigo-900/50 px-2 xl:px-3 py-1.5 rounded-xl border border-indigo-400/20 backdrop-blur-sm group shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <div className="flex flex-col leading-none">
                  <span className="hidden xl:inline text-[9px] uppercase font-black text-indigo-300/85 tracking-tighter">Preguntas</span>
                  <span className="text-sm xl:text-base font-black font-mono">{totalPracticed}</span>
                </div>
                <button 
                  onClick={() => setShowResetModal(true)}
                  className="ml-0.5 p-1 hover:bg-white/10 rounded-full text-indigo-300 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Reiniciar contador de preguntas"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* Contador de Flashcards */}
              <div className="flex items-center gap-1.5 bg-indigo-800/50 dark:bg-indigo-900/50 px-2 xl:px-3 py-1.5 rounded-xl border border-indigo-400/20 backdrop-blur-sm group shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <div className="flex flex-col leading-none">
                  <span className="hidden xl:inline text-[9px] uppercase font-black text-indigo-300/85 tracking-tighter">Flashcards</span>
                  <span className="text-sm xl:text-base font-black font-mono">{totalFlashcardsPracticed}</span>
                </div>
                <button 
                  onClick={() => setShowResetFlashcardsModal(true)}
                  className="ml-0.5 p-1 hover:bg-white/10 rounded-full text-indigo-300 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Reiniciar contador de flashcards"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 bg-indigo-800/60 hover:bg-indigo-600 dark:bg-indigo-900/60 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                title={isDark ? "Modo Claro" : "Modo Oscuro"}
                aria-label="Cambiar tema"
              >
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 xl:h-5 xl:w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.95 16.95l.707.707M7.05 7.05l.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 xl:h-5 xl:w-5 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Import / Export / Admin */}
              <label 
                className="cursor-pointer bg-indigo-800/60 hover:bg-indigo-600 dark:bg-indigo-900/60 p-2 xl:px-3 xl:py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                title="Importar base de datos JSON"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="hidden xl:inline">Importar</span>
                <input type="file" className="hidden" accept=".json" onChange={handleFileChange} />
              </label>

              <button 
                onClick={onExport}
                className="bg-indigo-800/60 hover:bg-indigo-600 dark:bg-indigo-900/60 p-2 xl:px-3 xl:py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                title="Exportar copia de seguridad JSON"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden xl:inline">Exportar</span>
              </button>

              <button 
                onClick={() => onNavigate('ADMIN')}
                className={`px-2.5 xl:px-3.5 py-2 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5 shrink-0 ${
                  isAdminActive 
                    ? 'bg-white text-indigo-700 ring-2 ring-indigo-400' 
                    : 'bg-white text-indigo-700 hover:bg-gray-100'
                }`}
                title="Panel de Administración"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Admin</span>
              </button>
            </div>
          </div>

          {/* Desktop Breadcrumbs Bar */}
          <div className="bg-indigo-800/50 dark:bg-indigo-950/80 py-1.5 px-4 text-xs font-medium text-indigo-100 border-t border-indigo-600/30 dark:border-indigo-800/40">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <span>{getBreadcrumbTitle()}</span>
              <span className="text-[11px] text-indigo-300/80">Ceprunsa 2027 • 3 en 1</span>
            </div>
          </div>
        </div>

        {/* MOBILE & TABLET TOP BAR (< lg, compact, touch-friendly and sticky) */}
        <div className="block lg:hidden">
          <div className="px-3.5 sm:px-5 py-2.5 flex items-center justify-between gap-2 max-w-7xl mx-auto">
            {/* Left: Back button or Logo */}
            <div className="flex items-center gap-2 min-w-0">
              {currentView !== 'HOME' ? (
                <button
                  onClick={onBack}
                  className="p-2 -ml-1 text-white hover:bg-white/10 active:bg-white/20 rounded-xl transition-colors flex items-center gap-1.5 min-h-[44px] min-w-[44px]"
                  aria-label="Volver atrás"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm font-bold truncate max-w-[150px] sm:max-w-[280px] md:max-w-[440px]">
                    {getBreadcrumbTitle()}
                  </span>
                </button>
              ) : (
                <div 
                  onClick={() => onNavigate('HOME')}
                  className="flex items-center gap-2 cursor-pointer py-1"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                    <img 
                      src="https://i.imgur.com/hqV69r2.png" 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-lg font-black tracking-tight text-white">Practix</span>
                </div>
              )}
            </div>

            {/* Right: Quick Counters pill, Theme toggle, and Menu trigger */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Quick Preguntas Counter Indicator */}
              <button
                onClick={() => setShowMobileMenu(true)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold text-white min-h-[40px] transition-all shadow-sm"
                title="Preguntas practicadas"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{totalPracticed}</span>
              </button>

              {/* Quick Flashcards Counter Indicator (shown on tablet / larger screens) */}
              <button
                onClick={() => setShowMobileMenu(true)}
                className="hidden sm:flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold text-white min-h-[40px] transition-all shadow-sm"
                title="Flashcards practicadas"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>{totalFlashcardsPracticed}</span>
              </button>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-2 text-white hover:bg-white/15 active:scale-95 border border-transparent hover:border-white/10 rounded-xl transition-all min-w-[44px] min-h-[44px] flex items-center justify-center shadow-sm"
                title={isDark ? "Modo Claro" : "Modo Oscuro"}
                aria-label="Cambiar tema de color"
              >
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.95 16.95l.707.707M7.05 7.05l.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Mobile Menu / More Button */}
              <button
                onClick={() => setShowMobileMenu(true)}
                className="p-2 text-white hover:bg-white/15 active:scale-95 border border-transparent hover:border-white/10 rounded-xl transition-all min-w-[44px] min-h-[44px] flex items-center justify-center shadow-sm"
                title="Menú y herramientas"
                aria-label="Abrir menú"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* MOBILE & TABLET FIXED BOTTOM NAVIGATION BAR (< lg, thumb-friendly ergonomic tabs) */}
      {!isExamView && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
          <div className="max-w-xl md:max-w-2xl mx-auto grid grid-cols-5 h-16 items-center px-1 sm:px-3">
            {/* Tab 1: Cursos */}
            <button
              onClick={() => onNavigate('HOME')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all min-h-[48px] ${
                isCursosActive 
                  ? 'text-indigo-600 dark:text-indigo-400 font-black' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isCursosActive ? 'scale-110' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isCursosActive ? 2.5 : 2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-[10px] sm:text-[11px] mt-0.5 leading-none font-bold">Cursos</span>
            </button>

            {/* Tab 2: Mazos Personalizados */}
            <button
              onClick={() => onNavigate('CUSTOM_DECKS')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all min-h-[48px] ${
                isDecksActive 
                  ? 'text-purple-600 dark:text-purple-400 font-black' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isDecksActive ? 'scale-110' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isDecksActive ? 2.5 : 2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-[10px] sm:text-[11px] mt-0.5 leading-none font-bold">Mazos</span>
            </button>

            {/* Tab 3: Simulacro (Featured Center Action) */}
            <button
              onClick={() => onNavigate('EXAM_SETUP')}
              className="flex flex-col items-center justify-center -mt-3 min-h-[48px]"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                isExamActive 
                  ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-indigo-300 dark:shadow-none scale-105 ring-2 ring-indigo-400' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className={`text-[10px] sm:text-[11px] mt-1 font-black ${isExamActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                Simulacro
              </span>
            </button>

            {/* Tab 4: Flashcards */}
            <button
              onClick={() => onNavigate('FLASHCARDS_HOME')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all min-h-[48px] ${
                isFlashcardsActive 
                  ? 'text-indigo-600 dark:text-indigo-400 font-black' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isFlashcardsActive ? 'scale-110' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isFlashcardsActive ? 2.5 : 2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-[10px] sm:text-[11px] mt-0.5 leading-none font-bold">Cards</span>
            </button>

            {/* Tab 5: Progreso / Stats */}
            <button
              onClick={() => onNavigate('STATS')}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all min-h-[48px] ${
                isStatsActive 
                  ? 'text-indigo-600 dark:text-indigo-400 font-black' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isStatsActive ? 'scale-110' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isStatsActive ? 2.5 : 2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-[10px] sm:text-[11px] mt-0.5 leading-none font-bold">Progreso</span>
            </button>
          </div>
        </div>
      )}

      {/* MOBILE DRAWER / QUICK ACTIONS SHEET */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setShowMobileMenu(false)}
          />

          {/* Bottom Drawer Card */}
          <div className="relative bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-slate-800 text-gray-800 dark:text-gray-100 z-10 max-h-[85vh] overflow-y-auto pb-safe animate-in slide-in-from-bottom-5 duration-200">
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="font-black text-lg text-gray-800 dark:text-gray-100">Opciones y Herramientas</h3>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Cerrar menú"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Counters Summary Box */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Preguntas</span>
                  <div className="text-2xl font-black font-mono text-indigo-900 dark:text-indigo-200 mt-0.5">{totalPracticed}</div>
                </div>
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowResetModal(true);
                  }}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold mt-2 text-left"
                >
                  Reiniciar a 0
                </button>
              </div>

              <div className="bg-purple-50/70 dark:bg-purple-950/40 p-3.5 rounded-2xl border border-purple-100 dark:border-purple-900/50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">Flashcards</span>
                  <div className="text-2xl font-black font-mono text-purple-900 dark:text-purple-200 mt-0.5">{totalFlashcardsPracticed}</div>
                </div>
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowResetFlashcardsModal(true);
                  }}
                  className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-bold mt-2 text-left"
                >
                  Reiniciar a 0
                </button>
              </div>
            </div>

            {/* Actions List */}
            <div className="space-y-2">
              {/* Admin Panel */}
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onNavigate('ADMIN');
                }}
                className="w-full p-4 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-between shadow-md"
              >
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Panel de Administración</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-80" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Import Backup */}
              <label className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 font-bold text-sm text-gray-700 dark:text-gray-200 active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Importar Copia de Seguridad (.json)</span>
                </div>
                <input type="file" className="hidden" accept=".json" onChange={handleFileChange} />
              </label>

              {/* Export Backup */}
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onExport();
                }}
                className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 font-bold text-sm text-gray-700 dark:text-gray-200 active:scale-[0.98] transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Descargar Copia de Seguridad</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              {/* Color Scheme Switch */}
              <button
                onClick={toggleTheme}
                className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 font-bold text-sm text-gray-700 dark:text-gray-200 active:scale-[0.98] transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {isDark ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.95 16.95l.707.707M7.05 7.05l.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                  <span>Cambiar a {isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
                </div>
                <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
                  {isDark ? 'Oscuro' : 'Claro'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS FOR RESET */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-800 text-gray-800 dark:text-gray-100">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-xl font-black mb-2">Reiniciar Preguntas</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
              ¿Deseas reiniciar el contador de preguntas practicadas a cero? Tus resultados guardados no se borrarán.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="py-3 px-4 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onResetPracticed();
                  setShowResetModal(false);
                }}
                className="py-3 px-4 bg-rose-600 text-white font-black rounded-xl hover:bg-rose-700 active:scale-95 transition-all shadow-md text-sm"
              >
                Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetFlashcardsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-800 text-gray-800 dark:text-gray-100">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-xl font-black mb-2">Reiniciar Flashcards</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
              ¿Deseas reiniciar el contador de flashcards practicadas a cero? Las dificultades guardadas se mantendrán.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowResetFlashcardsModal(false)}
                className="py-3 px-4 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onResetFlashcardsPracticed();
                  setShowResetFlashcardsModal(false);
                }}
                className="py-3 px-4 bg-rose-600 text-white font-black rounded-xl hover:bg-rose-700 active:scale-95 transition-all shadow-md text-sm"
              >
                Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;

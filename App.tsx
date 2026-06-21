
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Question, AppDatabase, ViewType, NavigationState, TopicResult, ReadingText, Flashcard } from './types';
import { ACADEMIC_STRUCTURE, DB_STORAGE_KEY } from './constants';
import Navbar from './components/Navbar';
import HomeView from './views/HomeView';
import SubjectsView from './views/SubjectsView';
import TopicsView from './views/TopicsView';
import QuizView from './views/QuizView';
import AdminView from './views/AdminView';
import MegaQuizView from './views/MegaQuizView';
import ExamSetupView from './views/ExamSetupView';
import FlashcardsHomeView from './views/FlashcardsHomeView';
import FlashcardsPlayView from './views/FlashcardsPlayView';

const sanitizeDatabase = (data: AppDatabase): AppDatabase => {
  const questions = data.questions ? [...data.questions] : [];
  const readingTexts = data.readingTexts ? [...data.readingTexts] : [];
  const flashcards = data.flashcards ? [...data.flashcards] : [];

  const seenQuestionIds = new Set<string>();
  const sanitizedQuestions = questions.map(q => {
    let qId = q.id;
    if (!qId || seenQuestionIds.has(qId)) {
      qId = crypto.randomUUID();
    }
    seenQuestionIds.add(qId);
    return { ...q, id: qId };
  });

  const seenTextIds = new Set<string>();
  const textIdMap = new Map<string, string>();
  const sanitizedReadingTexts = readingTexts.map(t => {
    let tId = t.id;
    if (!tId || seenTextIds.has(tId)) {
      const newId = crypto.randomUUID();
      if (tId) {
        textIdMap.set(tId, newId);
      }
      tId = newId;
    }
    seenTextIds.add(tId);
    return { ...t, id: tId };
  });

  if (textIdMap.size > 0) {
    sanitizedQuestions.forEach(q => {
      if (q.readingTextId && textIdMap.has(q.readingTextId)) {
        q.readingTextId = textIdMap.get(q.readingTextId);
      }
    });
  }

  const seenFlashcardIds = new Set<string>();
  const sanitizedFlashcards = flashcards.map(f => {
    let fId = f.id;
    if (!fId || seenFlashcardIds.has(fId)) {
      fId = crypto.randomUUID();
    }
    seenFlashcardIds.add(fId);
    return { ...f, id: fId };
  });

  return {
    ...data,
    questions: sanitizedQuestions,
    readingTexts: sanitizedReadingTexts,
    flashcards: sanitizedFlashcards
  };
};

const App: React.FC = () => {
  const [dbState, setDbState] = useState<AppDatabase>(() => {
    const saved = localStorage.getItem(DB_STORAGE_KEY);
    const initial = saved ? JSON.parse(saved) : { questions: [], readingTexts: [], flashcards: [] };
    if (!initial.results) initial.results = {};
    if (!initial.readingTexts) initial.readingTexts = [];
    if (!initial.flashcards) initial.flashcards = [];
    if (!initial.courseCovers) initial.courseCovers = {};
    if (initial.totalPracticed === undefined) initial.totalPracticed = 0;
    if (initial.totalFlashcardsPracticed === undefined) initial.totalFlashcardsPracticed = 0;
    return sanitizeDatabase(initial);
  });

  const setDb = useCallback((value: AppDatabase | ((prev: AppDatabase) => AppDatabase)) => {
    setDbState(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      return sanitizeDatabase(next);
    });
  }, []);

  const db = dbState;

  const [nav, setNav] = useState<NavigationState>({
    view: 'HOME'
  });

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  const [selectedArea, setSelectedArea] = useState<'Biomédicas' | 'Ingenierías' | 'Sociales'>(() => {
    const saved = localStorage.getItem('selected_area');
    return (saved as 'Biomédicas' | 'Ingenierías' | 'Sociales') || 'Biomédicas';
  });

  const handleSetSelectedArea = useCallback((area: 'Biomédicas' | 'Ingenierías' | 'Sociales') => {
    setSelectedArea(area);
    localStorage.setItem('selected_area', area);
  }, []);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  }, [db]);

  const handleNavigate = useCallback((view: ViewType, params?: Partial<NavigationState>) => {
    setNav(prev => ({ ...prev, view, ...params }));
  }, []);

  const handleImport = useCallback((data: AppDatabase) => {
    if (!data.results) data.results = {};
    if (!data.readingTexts) data.readingTexts = [];
    if (!data.flashcards) data.flashcards = [];
    if (data.totalPracticed === undefined) data.totalPracticed = 0;
    setDb(data);
    showToast('Base de datos importada con éxito.');
  }, [showToast]);

  const handleExport = useCallback(() => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `practix_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }, [db]);

  const saveQuestions = useCallback((newQuestions: Question[]) => {
    setDb(prev => ({
      ...prev,
      questions: [...prev.questions, ...newQuestions]
    }));
  }, []);

  const updateQuestion = useCallback((updatedQ: Question) => {
    setDb(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === updatedQ.id ? updatedQ : q)
    }));
  }, []);

  const deleteQuestion = useCallback((id: string) => {
    setDb(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id)
    }));
  }, []);

  const saveReadingText = useCallback((text: ReadingText) => {
    setDb(prev => {
      const exists = prev.readingTexts?.find(t => t.id === text.id);
      if (exists) {
        return {
          ...prev,
          readingTexts: prev.readingTexts?.map(t => t.id === text.id ? text : t)
        };
      }
      return {
        ...prev,
        readingTexts: [...(prev.readingTexts || []), text]
      };
    });
  }, []);

  const deleteReadingText = useCallback((id: string) => {
    setDb(prev => ({
      ...prev,
      readingTexts: prev.readingTexts?.filter(t => t.id !== id),
      questions: prev.questions.map(q => q.readingTextId === id ? { ...q, readingTextId: undefined } : q)
    }));
  }, []);

  const deleteTopic = useCallback((topicName: string, subjectName: string) => {
    setDb(prev => {
      const resultKey = `${subjectName}|${topicName}`;
      const newResults = { ...prev.results };
      delete newResults[resultKey];
      
      return {
        ...prev,
        questions: prev.questions.filter(q => !(q.topic === topicName && q.subject === subjectName)),
        results: newResults
      };
    });
  }, []);

  const moveTopic = useCallback((topicName: string, subjectName: string, direction: 'UP' | 'DOWN') => {
    setDb(prev => {
      const allQuestions = [...prev.questions];
      const subjectQuestions = allQuestions.filter(q => q.subject === subjectName);
      
      // Get unique topics for this subject
      const uniqueTopicNames = Array.from(new Set(subjectQuestions.map(q => q.topic)));
      
      // Map them with their current order (first question found)
      const topicsWithOrder = uniqueTopicNames.map(t => ({
        name: t,
        order: subjectQuestions.find(q => q.topic === t)?.order ?? 999
      })).sort((a, b) => a.order - b.order);

      const currentIndex = topicsWithOrder.findIndex(t => t.name === topicName);
      if (currentIndex === -1) return prev;

      const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= topicsWithOrder.length) return prev;

      // Swap names in the array
      const newTopicsOrder = [...topicsWithOrder];
      [newTopicsOrder[currentIndex], newTopicsOrder[targetIndex]] = [newTopicsOrder[targetIndex], newTopicsOrder[currentIndex]];

      // Update the order property of all questions in this subject based on the new array index
      const updatedQuestions = allQuestions.map(q => {
        if (q.subject !== subjectName) return q;
        const newOrder = newTopicsOrder.findIndex(t => t.name === q.topic);
        return { ...q, order: newOrder === -1 ? 999 : newOrder };
      });

      return {
        ...prev,
        questions: updatedQuestions
      };
    });
  }, []);

  const handleFinishQuiz = useCallback((subject: string, topic: string, score: number, total: number) => {
    setDb(prev => ({
      ...prev,
      totalPracticed: (prev.totalPracticed || 0) + total,
      results: {
        ...prev.results,
        [`${subject}|${topic}`]: { score, total }
      }
    }));
  }, []);

  const handleResetPracticed = useCallback(() => {
    setDb(prev => ({ ...prev, totalPracticed: 0 }));
  }, []);

  const handleResetFlashcardsPracticed = useCallback(() => {
    setDb(prev => ({ ...prev, totalFlashcardsPracticed: 0 }));
  }, []);

  const saveFlashcardsBatch = useCallback((newCards: Flashcard[]) => {
    setDb(prev => {
      const existing = prev.flashcards ? [...prev.flashcards] : [];
      newCards.forEach(newCard => {
        const index = existing.findIndex(f => f.id === newCard.id);
        if (index !== -1) {
          existing[index] = newCard;
        } else {
          existing.push(newCard);
        }
      });
      return {
        ...prev,
        flashcards: existing
      };
    });
  }, []);

  const deleteFlashcard = useCallback((id: string) => {
    setDb(prev => ({
      ...prev,
      flashcards: (prev.flashcards || []).filter(f => f.id !== id)
    }));
  }, []);

  const updateFlashcardDifficulty = useCallback((id: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD') => {
    setDb(prev => ({
      ...prev,
      totalFlashcardsPracticed: (prev.totalFlashcardsPracticed || 0) + 1,
      flashcards: (prev.flashcards || []).map(f => f.id === id ? { ...f, difficulty } : f)
    }));
  }, []);

  const moveFlashcardTopic = useCallback((topicName: string, subjectName: string, courseName: string, direction: 'UP' | 'DOWN') => {
    setDb(prev => {
      const allFlashcards = prev.flashcards ? [...prev.flashcards] : [];
      const subjectCards = allFlashcards.filter(f => f.course === courseName && f.subject === subjectName);
      
      const uniqueTopicNames = Array.from(new Set(subjectCards.map(f => f.topic ? f.topic.trim() : 'General / Sin Tema')));
      const nonDefaultTopics = uniqueTopicNames.filter(t => t !== 'General / Sin Tema');
      
      const topicsWithOrder = nonDefaultTopics.map(t => ({
        name: t,
        order: subjectCards.find(f => f.topic === t)?.order ?? 999
      })).sort((a, b) => a.order - b.order);

      const currentIndex = topicsWithOrder.findIndex(t => t.name === topicName);
      if (currentIndex === -1) return prev;

      const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= topicsWithOrder.length) return prev;

      const newTopicsOrder = [...topicsWithOrder];
      [newTopicsOrder[currentIndex], newTopicsOrder[targetIndex]] = [newTopicsOrder[targetIndex], newTopicsOrder[currentIndex]];

      const updatedFlashcards = allFlashcards.map(f => {
        if (f.course !== courseName || f.subject !== subjectName) return f;
        if (!f.topic) return f;
        const newOrder = newTopicsOrder.findIndex(t => t.name === f.topic);
        return { ...f, order: newOrder === -1 ? 999 : newOrder };
      });

      return {
        ...prev,
        flashcards: updatedFlashcards
      };
    });
  }, []);

  const academicStructure = useMemo(() => {
    return ACADEMIC_STRUCTURE.map(course => {
      const customCover = db.courseCovers?.[course.name];
      if (customCover) {
        return {
          ...course,
          icon: customCover
        };
      }
      return course;
    });
  }, [db.courseCovers]);

  const handleSaveCourseCovers = useCallback((newCovers: Record<string, string>) => {
    setDb(prev => ({
      ...prev,
      courseCovers: newCovers
    }));
  }, []);

  const handleBack = useCallback(() => {
    setNav(prev => {
      if (prev.view === 'ADMIN' || prev.view === 'MEGA_QUIZ' || prev.view === 'EXAM_SETUP') return { ...prev, view: 'HOME', examMode: undefined, selectedExamSubjects: undefined };
      if (prev.view === 'QUIZ' || prev.view === 'MIXED_QUIZ') return { ...prev, view: 'TOPICS', mixedQuestions: undefined };
      if (prev.view === 'TOPICS') return { ...prev, view: 'SUBJECTS', selectedTopic: undefined };
      if (prev.view === 'SUBJECTS') return { ...prev, view: 'HOME', selectedSubject: undefined };
      if (prev.view === 'FLASHCARDS_HOME') {
        if (prev.selectedCourse) return { ...prev, selectedCourse: undefined };
        return { ...prev, view: 'HOME' };
      }
      if (prev.view === 'FLASHCARDS_PLAY') return { ...prev, view: 'FLASHCARDS_HOME', selectedSubject: undefined };
      return prev;
    });
  }, []);

  const renderView = () => {
    switch (nav.view) {
      case 'HOME':
        return (
          <HomeView 
            academicStructure={academicStructure}
            onSelectCourse={(course) => handleNavigate('SUBJECTS', { selectedCourse: course })} 
            onStartMegaQuiz={(mode) => {
              if (mode === 'GENERAL') {
                handleNavigate('MEGA_QUIZ', { examMode: 'GENERAL', selectedExamSubjects: undefined });
              } else {
                handleNavigate('EXAM_SETUP', { examMode: 'CUSTOM' });
              }
            }}
          />
        );
      case 'EXAM_SETUP':
        return (
          <ExamSetupView 
            mode={nav.examMode!}
            selectedArea={selectedArea}
            onSetSelectedArea={handleSetSelectedArea}
            onCancel={() => handleNavigate('HOME')}
            onStart={(subjects) => handleNavigate('MEGA_QUIZ', { selectedExamSubjects: subjects })}
          />
        );
      case 'SUBJECTS':
        return (
          <SubjectsView 
            academicStructure={academicStructure}
            courseName={nav.selectedCourse!} 
            onSelectSubject={(subject) => handleNavigate('TOPICS', { selectedSubject: subject })} 
          />
        );
      case 'TOPICS':
        return (
          <TopicsView 
            key={nav.selectedSubject}
            subjectName={nav.selectedSubject!} 
            questions={db.questions.filter(q => q.subject === nav.selectedSubject)}
            readingTexts={db.readingTexts || []}
            results={db.results || {}}
            onSelectTopic={(topic) => handleNavigate('QUIZ', { selectedTopic: topic })}
            onStartMixedQuiz={(questions) => handleNavigate('MIXED_QUIZ', { mixedQuestions: questions })}
            onDeleteTopic={(topic) => deleteTopic(topic, nav.selectedSubject!)}
            onMoveTopic={(topic, dir) => moveTopic(topic, nav.selectedSubject!, dir)}
          />
        );
      case 'QUIZ':
        return (
          <QuizView 
            topicName={nav.selectedTopic!}
            subjectName={nav.selectedSubject!}
            questions={db.questions.filter(q => q.topic === nav.selectedTopic && q.subject === nav.selectedSubject)}
            readingTexts={db.readingTexts || []}
            onFinish={handleFinishQuiz}
          />
        );
      case 'MIXED_QUIZ':
        return (
          <QuizView 
            topicName="Examen Mixto"
            subjectName={nav.selectedSubject!}
            questions={nav.mixedQuestions || []}
            readingTexts={db.readingTexts || []}
            onFinish={handleFinishQuiz}
          />
        );
      case 'MEGA_QUIZ':
        return (
          <MegaQuizView 
            questions={db.questions}
            readingTexts={db.readingTexts || []}
            mode={nav.examMode}
            selectedArea={selectedArea}
            onSetSelectedArea={handleSetSelectedArea}
            selectedExamSubjects={nav.selectedExamSubjects}
            onFinishMega={(total) => setDb(prev => ({ ...prev, totalPracticed: (prev.totalPracticed || 0) + total }))}
          />
        );
      case 'ADMIN':
        return (
          <AdminView 
            questions={db.questions}
            readingTexts={db.readingTexts || []}
            flashcards={db.flashcards || []}
            onSaveBatch={saveQuestions}
            onUpdateQuestion={updateQuestion}
            onDeleteQuestion={deleteQuestion}
            onSaveReadingText={saveReadingText}
            onDeleteReadingText={deleteReadingText}
            onSaveFlashcardsBatch={saveFlashcardsBatch}
            onDeleteFlashcard={deleteFlashcard}
            courseCovers={db.courseCovers}
            onSaveCourseCovers={handleSaveCourseCovers}
          />
        );
      case 'FLASHCARDS_HOME':
        return (
          <FlashcardsHomeView 
            academicStructure={academicStructure}
            flashcards={db.flashcards || []}
            initialCourseName={nav.selectedCourse}
            onSelectCourse={(course) => handleNavigate('FLASHCARDS_HOME', { selectedCourse: course })}
            onClearCourse={() => handleNavigate('FLASHCARDS_HOME', { selectedCourse: undefined })}
            onStartPlay={(course, subject, topic) => handleNavigate('FLASHCARDS_PLAY', { selectedCourse: course, selectedSubject: subject, selectedTopic: topic })}
            onGoToAdmin={() => handleNavigate('ADMIN')}
            onMoveTopic={moveFlashcardTopic}
          />
        );
      case 'FLASHCARDS_PLAY': {
        const filteredCards = (db.flashcards || []).filter(f => {
          const matchCourse = f.course === nav.selectedCourse;
          const matchSubject = f.subject === nav.selectedSubject;
          const matchTopic = !nav.selectedTopic || f.topic === nav.selectedTopic;
          return matchCourse && matchSubject && matchTopic;
        });

        return (
          <FlashcardsPlayView 
            subjectName={nav.selectedSubject!}
            courseName={nav.selectedCourse!}
            topicName={nav.selectedTopic}
            flashcards={filteredCards}
            onUpdateCardDifficulty={updateFlashcardDifficulty}
            onFinish={() => {}}
            onBack={() => handleNavigate('FLASHCARDS_HOME', { selectedCourse: nav.selectedCourse })}
          />
        );
      }
      default:
        return <HomeView onSelectCourse={(course) => handleNavigate('SUBJECTS', { selectedCourse: course })} onStartMegaQuiz={() => handleNavigate('MEGA_QUIZ')} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      <Navbar 
        onNavigate={handleNavigate} 
        onBack={handleBack} 
        onImport={handleImport} 
        onExport={handleExport}
        onResetPracticed={handleResetPracticed}
        onResetFlashcardsPracticed={handleResetFlashcardsPracticed}
        currentView={nav.view}
        navState={nav}
        isDark={isDark}
        toggleTheme={() => setIsDark(!isDark)}
        totalPracticed={db.totalPracticed || 0}
        totalFlashcardsPracticed={db.totalFlashcardsPracticed || 0}
        onToast={showToast}
      />
      <main className="flex-grow container mx-auto px-4 py-8 relative">
        {toastMessage && (
          <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-fade-in-up flex items-center gap-3">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {toastMessage}
          </div>
        )}
        {renderView()}
      </main>
      <footer className="bg-white dark:bg-slate-900 dark:border-slate-800 border-t py-6 text-center text-sm text-gray-500 dark:text-gray-400 font-sans tracking-wide">
        &copy; {new Date().getFullYear()} Practix • Sistema de Gestión Académica
      </footer>
    </div>
  );
};

export default App;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Question, AppDatabase, ViewType, NavigationState, TopicResult, ReadingText, Flashcard, SavedExam, UserProfile, CustomDeck } from './types';
import { ACADEMIC_STRUCTURE, DB_STORAGE_KEY } from './constants';
import { getQuestionProcess } from './utils';
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
import { CustomDecksView } from './views/CustomDecksView';
import { StatsView } from './views/StatsView';

const sanitizeDatabase = (data: AppDatabase): AppDatabase => {
  // Migrate legacy Ecología and Anatomía records to Biología, and filter out Francés
  const questions = (data.questions ? [...data.questions] : [])
    .filter(q => q.subject !== 'Francés')
    .map(q => {
      let subj = q.subject;
      let crs = q.course;
      if (subj === 'Ecología' || subj === 'Anatomía') {
        subj = 'Biología';
      }
      if (subj === 'Comprensión Lectora') {
        crs = 'Razonamiento';
      }
      return { ...q, subject: subj, course: crs };
    });
  const readingTexts = (data.readingTexts ? [...data.readingTexts] : [])
    .filter(t => t.subject !== 'Francés')
    .map(t => {
      let subj = t.subject;
      if (subj === 'Ecología' || subj === 'Anatomía') {
        subj = 'Biología';
      }
      return { ...t, subject: subj };
    });
  const flashcards = (data.flashcards ? [...data.flashcards] : [])
    .filter(f => f.subject !== 'Francés')
    .map(f => {
      let subj = f.subject;
      let crs = f.course;
      if (subj === 'Ecología' || subj === 'Anatomía') {
        subj = 'Biología';
      }
      if (subj === 'Comprensión Lectora') {
        crs = 'Razonamiento';
      }
      return { ...f, subject: subj, course: crs };
    });

  const seenQuestionIds = new Set<string>();
  const sanitizedQuestions = questions.map(q => {
    let qId = q.id;
    if (!qId || seenQuestionIds.has(qId)) {
      qId = crypto.randomUUID();
    }
    seenQuestionIds.add(qId);
    const process = q.process && typeof q.process === 'string' && q.process.trim() ? q.process.trim() : 'Ceprunsa I Fase 2027';
    return { ...q, id: qId, process };
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

  const seenCustomDeckIds = new Set<string>();
  const sanitizedCustomDecks = (data.customDecks ? [...data.customDecks] : []).map(d => {
    let dId = d.id;
    if (!dId || seenCustomDeckIds.has(dId)) {
      dId = crypto.randomUUID();
    }
    seenCustomDeckIds.add(dId);
    return {
      ...d,
      id: dId,
      questionIds: Array.isArray(d.questionIds) ? d.questionIds : []
    };
  });

  const migratedResults: Record<string, TopicResult> = {};
  if (data.results) {
    Object.entries(data.results).forEach(([key, val]) => {
      let targetKey = key;
      if (key.startsWith('Ecología|')) {
        targetKey = key.replace('Ecología|', 'Biología|');
      } else if (key.startsWith('Anatomía|')) {
        targetKey = key.replace('Anatomía|', 'Biología|');
      } else if (key.startsWith('Francés|')) {
        return;
      }

      const existing = migratedResults[targetKey];
      if (existing) {
        migratedResults[targetKey] = {
          ...val,
          score: existing.score + val.score,
          total: existing.total + val.total,
          timesPracticed: (existing.timesPracticed || 1) + (val.timesPracticed || 1),
          classicPracticesCount: (existing.classicPracticesCount || 0) + (val.classicPracticesCount || 0),
          gamePracticesCount: (existing.gamePracticesCount || 0) + (val.gamePracticesCount || 0),
          bestScore: Math.max(existing.bestScore ?? existing.score, val.bestScore ?? val.score),
          history: [...(existing.history || []), ...(val.history || [])]
        };
      } else {
        migratedResults[targetKey] = {
          ...val,
          timesPracticed: val.timesPracticed ?? (val.total > 0 ? 1 : 0),
          bestScore: val.bestScore ?? val.score
        };
      }
    });
  }

  return {
    ...data,
    questions: sanitizedQuestions,
    readingTexts: sanitizedReadingTexts,
    flashcards: sanitizedFlashcards,
    results: migratedResults,
    customDecks: sanitizedCustomDecks
  };
};

const App: React.FC = () => {
  const [dbState, setDbState] = useState<AppDatabase>(() => {
    const saved = localStorage.getItem(DB_STORAGE_KEY);
    const initial = saved ? JSON.parse(saved) : { questions: [], readingTexts: [], flashcards: [], savedExams: [], customDecks: [] };
    if (!initial.results) initial.results = {};
    if (!initial.readingTexts) initial.readingTexts = [];
    if (!initial.flashcards) initial.flashcards = [];
    if (!initial.courseCovers) initial.courseCovers = {};
    if (!initial.savedExams) initial.savedExams = [];
    if (!initial.customDecks) initial.customDecks = [];
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

  const handleCreateDeck = useCallback((deckData: Omit<CustomDeck, 'id' | 'createdAt'>) => {
    const newDeck: CustomDeck = {
      ...deckData,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    };
    setDb(prev => ({
      ...prev,
      customDecks: [...(prev.customDecks || []), newDeck]
    }));
    showToast(`Mazo "${newDeck.title}" creado con éxito.`);
  }, [showToast]);

  const handleUpdateDeck = useCallback((updatedDeck: CustomDeck) => {
    setDb(prev => ({
      ...prev,
      customDecks: (prev.customDecks || []).map(d => d.id === updatedDeck.id ? updatedDeck : d)
    }));
    showToast("Mazo actualizado.");
  }, [showToast]);

  const handleDeleteDeck = useCallback((deckId: string) => {
    setDb(prev => ({
      ...prev,
      customDecks: (prev.customDecks || []).filter(d => d.id !== deckId)
    }));
    showToast("Mazo eliminado.");
  }, [showToast]);

  const handleAddQuestionToDeck = useCallback((deckId: string, qData: Omit<Question, 'id' | 'createdAt'>) => {
    const newQId = crypto.randomUUID();
    const newQ: Question = {
      ...qData,
      id: newQId,
      createdAt: Date.now()
    };
    setDb(prev => ({
      ...prev,
      questions: [...prev.questions, newQ],
      customDecks: (prev.customDecks || []).map(d => {
        if (d.id === deckId) {
          return {
            ...d,
            questionIds: [...d.questionIds, newQId],
            updatedAt: Date.now()
          };
        }
        return d;
      })
    }));
    showToast("Pregunta creada y añadida al mazo.");
  }, [showToast]);

  const handleToggleQuestionInDeck = useCallback((deckId: string, questionId: string) => {
    setDb(prev => ({
      ...prev,
      customDecks: (prev.customDecks || []).map(d => {
        if (d.id === deckId) {
          const exists = d.questionIds.includes(questionId);
          return {
            ...d,
            questionIds: exists ? d.questionIds.filter(id => id !== questionId) : [...d.questionIds, questionId],
            updatedAt: Date.now()
          };
        }
        return d;
      })
    }));
  }, []);

  const handlePlayDeck = useCallback((deck: CustomDeck, mode: 'CLASSIC' | 'QUIZZIZ') => {
    const qMap = new Map(db.questions.map(q => [q.id, q]));
    const deckQuestions = deck.questionIds.map(id => qMap.get(id)).filter((q): q is Question => q !== undefined);
    
    if (deckQuestions.length === 0) {
      showToast("El mazo no tiene preguntas aún.");
      return;
    }

    handleNavigate('MIXED_QUIZ', {
      selectedTopic: deck.title,
      selectedSubject: 'Mazo Propio',
      selectedDeckId: deck.id,
      mixedQuestions: deckQuestions,
      quizMode: mode
    });
  }, [db.questions, handleNavigate, showToast]);

  const handleFinishQuiz = useCallback((subject: string, topic: string, score: number, total: number, mode: 'CLASSIC' | 'QUIZZIZ' = 'CLASSIC') => {
    setDb(prev => {
      let updatedCustomDecks = prev.customDecks;
      if (nav.selectedDeckId && prev.customDecks) {
        updatedCustomDecks = prev.customDecks.map(d => {
          if (d.id === nav.selectedDeckId) {
            return {
              ...d,
              timesPracticed: (d.timesPracticed || 0) + 1,
              bestScore: Math.max(d.bestScore ?? score, score),
              lastPracticedAt: Date.now()
            };
          }
          return d;
        });
      }

      const key = `${subject}|${topic}`;
      const prevResult = prev.results?.[key];
      const prevTimes = prevResult?.timesPracticed ?? (prevResult && prevResult.total > 0 ? 1 : 0);
      const prevClassic = prevResult?.classicPracticesCount ?? (prevResult && !prevResult.gamePracticesCount ? prevTimes : 0);
      const prevGame = prevResult?.gamePracticesCount ?? 0;
      const prevBest = prevResult?.bestScore ?? prevResult?.score ?? 0;

      const newHistoryItem = {
        score,
        total,
        date: Date.now(),
        mode
      };

      const newResult: TopicResult = {
        score,
        total,
        timesPracticed: prevTimes + 1,
        classicPracticesCount: mode === 'CLASSIC' ? prevClassic + 1 : prevClassic,
        gamePracticesCount: mode === 'QUIZZIZ' ? prevGame + 1 : prevGame,
        lastPracticedAt: Date.now(),
        bestScore: Math.max(prevBest, score),
        history: [...(prevResult?.history || []), newHistoryItem]
      };

      return {
        ...prev,
        totalPracticed: (prev.totalPracticed || 0) + total,
        customDecks: updatedCustomDecks,
        results: {
          ...prev.results,
          [key]: newResult
        }
      };
    });
  }, [nav.selectedDeckId]);

  const handleSaveExamResult = useCallback((savedExam: SavedExam) => {
    setDb(prev => {
      const existing = prev.savedExams ? [...prev.savedExams] : [];
      const index = existing.findIndex(e => e.id === savedExam.id);
      if (index !== -1) {
        existing[index] = savedExam;
      } else {
        existing.unshift(savedExam);
      }
      return {
        ...prev,
        savedExams: existing
      };
    });
  }, [setDb]);

  const handleDeleteSavedExam = useCallback((examId: string) => {
    setDb(prev => ({
      ...prev,
      savedExams: (prev.savedExams || []).filter(e => e.id !== examId)
    }));
    showToast('Examen eliminado del registro.');
  }, [setDb, showToast]);

  const handleUpdateUserProfile = useCallback((profile: UserProfile) => {
    setDb(prev => ({
      ...prev,
      userProfile: profile
    }));
  }, [setDb]);

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
      if (prev.view === 'ADMIN' || prev.view === 'MEGA_QUIZ' || prev.view === 'EXAM_SETUP' || prev.view === 'STATS') return { ...prev, view: 'HOME', examMode: undefined, selectedExamSubjects: undefined, selectedExamWeeks: undefined, retakeExam: undefined };
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
                handleNavigate('MEGA_QUIZ', { examMode: 'GENERAL', selectedExamSubjects: undefined, selectedExamWeeks: undefined, retakeExam: undefined });
              } else {
                handleNavigate('EXAM_SETUP', { examMode: 'CUSTOM' });
              }
            }}
            onViewSavedExams={() => handleNavigate('TOPICS', { selectedCourse: 'Exámenes', selectedSubject: 'Exámenes Rendidos' })}
            savedExamsCount={db.savedExams?.length || 0}
            onNavigateToCustomDecks={() => handleNavigate('CUSTOM_DECKS')}
            customDecks={db.customDecks || []}
          />
        );
      case 'EXAM_SETUP':
        return (
          <ExamSetupView 
            mode={nav.examMode!}
            questions={db.questions}
            selectedArea={selectedArea}
            onSetSelectedArea={handleSetSelectedArea}
            onCancel={() => handleNavigate('HOME')}
            onStart={(subjects, weeks, processes) => handleNavigate('MEGA_QUIZ', { 
              selectedExamSubjects: subjects && subjects.length > 0 ? subjects : undefined,
              selectedExamWeeks: weeks && weeks.length > 0 ? weeks : undefined,
              selectedExamProcesses: processes && processes.length > 0 ? processes : undefined,
              retakeExam: undefined 
            })}
          />
        );
      case 'SUBJECTS':
        return (
          <SubjectsView 
            academicStructure={academicStructure}
            courseName={nav.selectedCourse!} 
            questions={db.questions}
            results={db.results || {}}
            savedExams={db.savedExams || []}
            onSelectSubject={(subject) => handleNavigate('TOPICS', { selectedCourse: nav.selectedCourse, selectedSubject: subject })} 
          />
        );
      case 'TOPICS':
        return (
          <TopicsView 
            key={nav.selectedSubject}
            subjectName={nav.selectedSubject!} 
            courseName={nav.selectedCourse}
            questions={db.questions.filter(q => q.subject === nav.selectedSubject)}
            allDatabaseQuestions={db.questions}
            readingTexts={db.readingTexts || []}
            results={db.results || {}}
            savedExams={db.savedExams || []}
            onSelectTopic={(topic, mode, process) => handleNavigate('QUIZ', { selectedTopic: topic, quizMode: mode, selectedProcess: process })}
            onStartMixedQuiz={(questions, mode) => handleNavigate('MIXED_QUIZ', { mixedQuestions: questions, quizMode: mode })}
            onDeleteTopic={(topic) => deleteTopic(topic, nav.selectedSubject!)}
            onMoveTopic={(topic, dir) => moveTopic(topic, nav.selectedSubject!, dir)}
            onRetakeExam={(exam) => handleNavigate('MEGA_QUIZ', { retakeExam: exam, examMode: exam.mode, isReviewMode: false })}
            onViewExamResolution={(exam) => handleNavigate('MEGA_QUIZ', { retakeExam: exam, examMode: exam.mode, isReviewMode: true })}
            onDeleteSavedExam={handleDeleteSavedExam}
            onStartNewExam={() => handleNavigate('EXAM_SETUP', { examMode: 'CUSTOM' })}
            onSaveQuestions={saveQuestions}
            selectedArea={selectedArea}
            onToast={showToast}
          />
        );
      case 'QUIZ':
        return (
          <QuizView 
            topicName={nav.selectedTopic!}
            subjectName={nav.selectedSubject!}
            questions={db.questions.filter(q => 
              q.topic === nav.selectedTopic && 
              q.subject === nav.selectedSubject && 
              (!nav.selectedProcess || getQuestionProcess(q) === nav.selectedProcess)
            )}
            readingTexts={db.readingTexts || []}
            results={db.results || {}}
            initialMode={nav.quizMode || 'CLASSIC'}
            userProfile={db.userProfile}
            onFinish={handleFinishQuiz}
            onBack={handleBack}
          />
        );
      case 'MIXED_QUIZ':
        return (
          <QuizView 
            topicName="Examen Mixto"
            subjectName={nav.selectedSubject!}
            questions={nav.mixedQuestions || []}
            readingTexts={db.readingTexts || []}
            results={db.results || {}}
            initialMode={nav.quizMode || 'CLASSIC'}
            userProfile={db.userProfile}
            onFinish={handleFinishQuiz}
            onBack={handleBack}
          />
        );
      case 'MEGA_QUIZ':
        return (
          <MegaQuizView 
            questions={db.questions}
            readingTexts={db.readingTexts || []}
            results={db.results || {}}
            mode={nav.examMode}
            selectedArea={selectedArea}
            onSetSelectedArea={handleSetSelectedArea}
            selectedExamSubjects={nav.selectedExamSubjects}
            selectedExamWeeks={nav.selectedExamWeeks}
            selectedExamProcesses={nav.selectedExamProcesses}
            retakeExam={nav.retakeExam}
            isReviewMode={nav.isReviewMode}
            onSaveExamResult={handleSaveExamResult}
            userProfile={db.userProfile}
            onFinishMega={(total) => setDb(prev => ({ ...prev, totalPracticed: (prev.totalPracticed || 0) + total }))}
            onBack={handleBack}
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
      case 'STATS':
        return (
          <StatsView 
            questions={db.questions}
            results={db.results || {}}
            selectedArea={selectedArea}
            onSetSelectedArea={handleSetSelectedArea}
            academicStructure={academicStructure}
            userProfile={db.userProfile}
            onUpdateProfile={handleUpdateUserProfile}
          />
        );
      case 'CUSTOM_DECKS':
        return (
          <CustomDecksView 
            decks={db.customDecks || []}
            questions={db.questions}
            readingTexts={db.readingTexts || []}
            results={db.results || {}}
            onCreateDeck={handleCreateDeck}
            onUpdateDeck={handleUpdateDeck}
            onDeleteDeck={handleDeleteDeck}
            onPlayDeck={handlePlayDeck}
            onAddQuestionToDeck={handleAddQuestionToDeck}
            onToggleQuestionInDeck={handleToggleQuestionInDeck}
            onDeleteQuestion={deleteQuestion}
            onBackToHome={() => handleNavigate('HOME')}
          />
        );
      default:
        return (
          <HomeView 
            onSelectCourse={(course) => handleNavigate('SUBJECTS', { selectedCourse: course })} 
            onStartMegaQuiz={(mode) => handleNavigate('MEGA_QUIZ', { examMode: mode })}
            onNavigateToCustomDecks={() => handleNavigate('CUSTOM_DECKS')}
            customDecks={db.customDecks || []}
          />
        );
    }
  };

  const showNavbar = nav.view !== 'FLASHCARDS_PLAY' && nav.view !== 'QUIZ' && nav.view !== 'MEGA_QUIZ' && nav.view !== 'MIXED_QUIZ';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      {showNavbar && (
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
      )}
      <main className={`flex-grow w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 ${showNavbar ? 'pb-24 lg:pb-8' : 'pb-8'} relative`}>
        {toastMessage && (
          <div className="fixed bottom-20 lg:bottom-4 right-3 sm:right-4 left-3 sm:left-auto max-w-md bg-gray-900/95 text-white px-4 sm:px-6 py-3 rounded-2xl shadow-2xl z-50 animate-fade-in-up flex items-center gap-3 backdrop-blur-md border border-gray-700">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
          </div>
        )}
        {renderView()}
      </main>
      <footer className={`bg-white dark:bg-slate-900 dark:border-slate-800 border-t py-6 ${showNavbar ? 'pb-24 lg:pb-6' : 'pb-6'} text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-sans tracking-wide`}>
        &copy; {new Date().getFullYear()} Practix • Sistema de Gestión Académica
      </footer>
    </div>
  );
};

export default App;

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Question, ReadingText, Flashcard } from '../types';
import { ACADEMIC_STRUCTURE } from '../constants';
import { formatQuestionText, parseHTMLTags } from '../utils';

interface AdminViewProps {
  questions: Question[];
  readingTexts: ReadingText[];
  flashcards: Flashcard[];
  onSaveBatch: (questions: Question[]) => void;
  onUpdateQuestion: (question: Question) => void;
  onDeleteQuestion: (id: string) => void;
  onSaveReadingText: (text: ReadingText) => void;
  onDeleteReadingText: (id: string) => void;
  onSaveFlashcardsBatch: (flashcards: Flashcard[]) => void;
  onDeleteFlashcard: (id: string) => void;
  courseCovers?: Record<string, string>;
  onSaveCourseCovers?: (covers: Record<string, string>) => void;
}

const TextFormatterBar: React.FC<{
  targetId: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ targetId, value, onChange }) => {
  const insertTag = (tag: 'b' | 'i' | 'u') => {
    const el = document.getElementById(targetId) as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = value.substring(start, end);
    const replacement = `<${tag}>${selectedText}</${tag}>`;
    const newVal = value.substring(0, start) + replacement + value.substring(end);
    onChange(newVal);
    
    // Refocus and place selection inside tag or after
    setTimeout(() => {
      el.focus();
      const offset = selectedText ? replacement.length : tag.length + 2; 
      const newCursorPos = start + offset;
      el.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  return (
    <div className="flex gap-1 mb-1 bg-gray-100 dark:bg-slate-800 border dark:border-slate-700/60 p-1 rounded-lg w-max shadow-sm shrink-0">
      <button
        type="button"
        onClick={() => insertTag('b')}
        className="px-2 py-0.5 text-xs font-bold rounded hover:bg-gray-250 dark:hover:bg-slate-700 text-gray-750 dark:text-gray-300 transition-all flex items-center gap-0.5 active:scale-95 border border-transparent hover:border-gray-300/30"
        title="Negrita <b>"
      >
        <span className="font-extrabold text-[12px] tracking-tight">B</span>
        <span className="text-[8px] opacity-30 font-mono">{'<b>'}</span>
      </button>
      <button
        type="button"
        onClick={() => insertTag('i')}
        className="px-2 py-0.5 text-xs italic rounded hover:bg-gray-250 dark:hover:bg-slate-700 text-gray-750 dark:text-gray-300 transition-all flex items-center gap-0.5 active:scale-95 border border-transparent hover:border-gray-300/30"
        title="Inclinado (Itálica) <i>"
      >
        <span className="font-serif font-black text-[12px] tracking-tight">I</span>
        <span className="text-[8px] opacity-30 font-not-italic font-mono font-normal">{'<i>'}</span>
      </button>
      <button
        type="button"
        onClick={() => insertTag('u')}
        className="px-2 py-0.5 text-xs underline rounded hover:bg-gray-250 dark:hover:bg-slate-700 text-gray-750 dark:text-gray-300 transition-all flex items-center gap-0.5 active:scale-95 border border-transparent hover:border-gray-300/30"
        title="Subrayado <u>"
      >
        <span className="font-bold underline text-[12px] tracking-tight">U</span>
        <span className="text-[8px] opacity-30 no-underline font-mono font-normal">{'<u>'}</span>
      </button>
    </div>
  );
};

const AdminView: React.FC<AdminViewProps> = ({ 
  questions, 
  readingTexts, 
  flashcards = [],
  onSaveBatch, 
  onUpdateQuestion, 
  onDeleteQuestion,
  onSaveReadingText,
  onDeleteReadingText,
  onSaveFlashcardsBatch,
  onDeleteFlashcard,
  courseCovers = {},
  onSaveCourseCovers
}) => {
  const [activeTab, setActiveTab] = useState<'EDITOR' | 'MANAGE' | 'TEXTS' | 'FLASHCARDS_ADD' | 'FLASHCARDS_MANAGE' | 'COVERS'>('EDITOR');
  const [currentBatch, setCurrentBatch] = useState<Question[]>([]);
  
  const [tempCovers, setTempCovers] = useState<Record<string, string>>({});

  const courseCoversStr = JSON.stringify(courseCovers);

  useEffect(() => {
    if (courseCovers) {
      setTempCovers(courseCovers);
    }
  }, [courseCoversStr]);

  const coursesWithFullData = useMemo(() => {
    return ACADEMIC_STRUCTURE.map(course => ({
      ...course,
      defaultIcon: course.icon,
    }));
  }, []);

  const handleCoverChange = (courseName: string, val: string) => {
    setTempCovers(prev => ({
      ...prev,
      [courseName]: val
    }));
  };

  const handleSaveSingleCover = (courseName: string) => {
    if (onSaveCourseCovers) {
      const updated = {
        ...tempCovers,
        [courseName]: tempCovers[courseName] ? tempCovers[courseName].trim() : ''
      };
      if (!updated[courseName]) {
        delete updated[courseName];
      }
      onSaveCourseCovers(updated);
      showToast(`Portada de ${courseName} guardada.`);
    }
  };

  const handleResetSingleCover = (courseName: string) => {
    const updated = { ...tempCovers };
    delete updated[courseName];
    setTempCovers(updated);
    if (onSaveCourseCovers) {
      onSaveCourseCovers(updated);
    }
    showToast(`Portada de ${courseName} restablecida.`);
  };
  
  // Form State Question
  const [editingId, setEditingId] = useState<string | null>(null);
  const [course, setCourse] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [week, setWeek] = useState<number | ''>('');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '', '']);
  const [optionsImageUrls, setOptionsImageUrls] = useState<string[]>(['', '', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [explanationImageUrl, setExplanationImageUrl] = useState('');
  const [readingTextId, setReadingTextId] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const previewRef = useRef<HTMLDivElement>(null);
  const fcPreviewRef = useRef<HTMLDivElement>(null);

  // LaTeX preview effect
  useEffect(() => {
    if (previewRef.current && (window as any).renderMathInElement) {
      (window as any).renderMathInElement(previewRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
  }, [questionText, options, explanation, activeTab]);

  // Flashcards Forms State
  const [fcCourse, setFcCourse] = useState('');
  const [fcSubject, setFcSubject] = useState('');
  const [fcTopic, setFcTopic] = useState('');
  const [fcFront, setFcFront] = useState('');
  const [fcBack, setFcBack] = useState('');
  
  // Bulk upload of flashcards
  const [fcBulkText, setFcBulkText] = useState('');
  const [fcBulkCourse, setFcBulkCourse] = useState('');
  const [fcBulkSubject, setFcBulkSubject] = useState('');
  const [fcBulkFormat, setFcBulkFormat] = useState<'SEMICOLON' | 'JSON'>('SEMICOLON');
  const [fcDeleteId, setFcDeleteId] = useState<string | null>(null);
  const [fcEditing, setFcEditing] = useState<Flashcard | null>(null);

  // LaTeX preview effect for Flashcards
  useEffect(() => {
    if (fcPreviewRef.current && (window as any).renderMathInElement) {
      (window as any).renderMathInElement(fcPreviewRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
  }, [fcFront, fcBack, activeTab]);

  // Form State ReadingText
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textSubject, setTextSubject] = useState('Comprensión Lectora');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [textToDelete, setTextToDelete] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isBatchStarted = currentBatch.length > 0;
  const isEditing = !!editingId;

  const currentCourse = ACADEMIC_STRUCTURE.find(c => c.name === course);
  const availableSubjects = currentCourse?.subjects || [];

  const resetForm = (full: boolean = true) => {
    setQuestionText('');
    setOptions(['', '', '', '', '']);
    setOptionsImageUrls(['', '', '', '', '']);
    setCorrectIndex(0);
    setExplanation('');
    setExplanationImageUrl('');
    setEditingId(null);
    setReadingTextId('');
    setImageUrl('');
    setWeek('');
    if (full) {
      setCourse('');
      setSubject('');
      setTopic('');
    }
  };

  const resetTextForm = () => {
    setTextTitle('');
    setTextContent('');
    setTextSubject('Comprensión Lectora');
    setEditingTextId(null);
  };

  const handleAddOrUpdate = () => {
    if (!course || !subject || !topic || !questionText || options.some(o => !o) || !explanation) {
      showToast("Por favor completa todos los campos.");
      return;
    }

    if ((subject === 'Comprensión Lectora' || subject === 'Inglés Lectura') && !readingTextId) {
      showToast("Por favor selecciona una lectura para esta pregunta.");
      return;
    }

    const qData = {
      course,
      subject,
      topic,
      questionText,
      options: [...options],
      correctIndex,
      explanation,
      readingTextId: readingTextId || undefined,
      imageUrl: imageUrl || undefined,
      optionsImageUrls: optionsImageUrls.some(url => url) ? [...optionsImageUrls] : undefined,
      explanationImageUrl: explanationImageUrl || undefined,
      week: week !== '' ? Number(week) : undefined
    };

    if (isEditing) {
      const updatedQ: Question = {
        ...qData,
        id: editingId!,
        order: questions.find(q => q.id === editingId)?.order ?? 999,
        createdAt: questions.find(q => q.id === editingId)?.createdAt ?? Date.now()
      } as Question;
      onUpdateQuestion(updatedQ);
      showToast("Pregunta actualizada.");
      resetForm();
      setActiveTab('MANAGE');
    } else {
      const newQ: Question = {
        ...qData,
        id: crypto.randomUUID(),
        order: 999,
        createdAt: Date.now()
      } as Question;
      setCurrentBatch(prev => [...prev, newQ]);
      resetForm(false); 
    }
  };

  const handleSaveReadingTextLocal = () => {
    if (!textTitle || !textContent || !textSubject) {
      showToast("Completa el título y contenido del texto.");
      return;
    }
    const newText: ReadingText = {
      id: editingTextId || crypto.randomUUID(),
      title: textTitle,
      content: textContent,
      subject: textSubject
    };
    onSaveReadingText(newText);
    resetTextForm();
    showToast("Texto guardado.");
  };

  const handleEditExisting = (q: Question) => {
    setEditingId(q.id);
    setCourse(q.course);
    setSubject(q.subject);
    setTopic(q.topic);
    setQuestionText(q.questionText);
    setOptions([...q.options]);
    setOptionsImageUrls(q.optionsImageUrls ? [...q.optionsImageUrls] : ['', '', '', '', '']);
    setCorrectIndex(q.correctIndex);
    setExplanation(q.explanation);
    setExplanationImageUrl(q.explanationImageUrl || '');
    setReadingTextId(q.readingTextId || '');
    setImageUrl(q.imageUrl || '');
    setWeek(q.week !== undefined && q.week !== null ? q.week : '');
    setActiveTab('EDITOR');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditExistingText = (t: ReadingText) => {
    setEditingTextId(t.id);
    setTextTitle(t.title);
    setTextContent(t.content);
    setTextSubject(t.subject);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExisting = (id: string) => {
    setQuestionToDelete(id);
  };

  const handleSaveAllBatch = () => {
    if (currentBatch.length === 0) return;
    onSaveBatch(currentBatch);
    setCurrentBatch([]);
    resetForm();
    showToast("Práctica guardada correctamente.");
  };

  const handleSaveFcIndividual = () => {
    if (!fcCourse || !fcSubject || !fcTopic.trim() || !fcFront.trim() || !fcBack.trim()) {
      showToast("Por favor completa todos los campos obligatorios: Curso, Materia, Tema (Título), Anverso y Reverso.");
      return;
    }
    const newCard: Flashcard = {
      id: crypto.randomUUID(),
      course: fcCourse,
      subject: fcSubject,
      topic: fcTopic.trim(),
      front: fcFront.trim(),
      back: fcBack.trim(),
      createdAt: Date.now()
    };
    onSaveFlashcardsBatch([newCard]);
    setFcFront('');
    setFcBack('');
    showToast("Flashcard añadida con éxito!");
  };

  const handleSaveFcBulk = () => {
    if (!fcBulkCourse || !fcBulkSubject) {
      showToast("Selecciona el Curso y la Materia de destino.");
      return;
    }
    if (!fcBulkText.trim()) {
      showToast("Ingresa texto para importar.");
      return;
    }

    const cards: Flashcard[] = [];

    if (fcBulkFormat === 'JSON') {
      try {
        const parsed = JSON.parse(fcBulkText);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            const front = item.front || item.anverso || item.pregunta || item.q || '';
            const back = item.back || item.reverso || item.respuesta || item.a || '';
            const topic = item.topic || item.tema || '';
            if (front && back) {
              cards.push({
                id: crypto.randomUUID(),
                course: fcBulkCourse,
                subject: fcBulkSubject,
                topic: topic || undefined,
                front: front.trim(),
                back: back.trim(),
                createdAt: Date.now()
              });
            }
          });
        } else {
          showToast("El JSON debe ser un arreglo de objetos.");
          return;
        }
      } catch (err) {
        showToast("Error al parsear el formato JSON.");
        return;
      }
    } else {
      // SEMICOLON
      const lines = fcBulkText.split('\n');
      lines.forEach(line => {
        if (!line.trim()) return;
        const index = line.indexOf(';');
        if (index === -1) {
          const tabIndex = line.indexOf('\t');
          if (tabIndex !== -1) {
            const front = line.substring(0, tabIndex).trim();
            const back = line.substring(tabIndex + 1).trim();
            if (front && back) {
              cards.push({
                id: crypto.randomUUID(),
                course: fcBulkCourse,
                subject: fcBulkSubject,
                front,
                back,
                createdAt: Date.now()
              });
            }
          }
          return;
        }
        const front = line.substring(0, index).trim();
        const back = line.substring(index + 1).trim();
        if (front && back) {
          cards.push({
            id: crypto.randomUUID(),
            course: fcBulkCourse,
            subject: fcBulkSubject,
            front,
            back,
            createdAt: Date.now()
          });
        }
      });
    }

    if (cards.length === 0) {
      showToast("No se pudieron extraer tarjetas válidas.");
      return;
    }

    onSaveFlashcardsBatch(cards);
    setFcBulkText('');
    showToast(`Se importaron ${cards.length} flashcards.`);
    setActiveTab('FLASHCARDS_MANAGE');
  };

  const fcCurrentCourse = ACADEMIC_STRUCTURE.find(c => c.name === fcCourse);
  const fcAvailableSubjects = fcCurrentCourse?.subjects || [];

  const fcBulkCurrentCourse = ACADEMIC_STRUCTURE.find(c => c.name === fcBulkCourse);
  const fcBulkAvailableSubjects = fcBulkCurrentCourse?.subjects || [];

  const [fcFilterCourse, setFcFilterCourse] = useState('');
  const [fcFilterSubject, setFcFilterSubject] = useState('');

  const filteredFlashcards = useMemo(() => {
    return flashcards.filter(f => {
      const matchCourse = !fcFilterCourse || f.course === fcFilterCourse;
      const matchSubject = !fcFilterSubject || f.subject === fcFilterSubject;
      return matchCourse && matchSubject;
    });
  }, [flashcards, fcFilterCourse, fcFilterSubject]);

  const handleOptionChange = (idx: number, val: string) => {
    const newOpts = [...options];
    newOpts[idx] = val;
    setOptions(newOpts);
  };

  const handleOptionImageUrlChange = (idx: number, val: string) => {
    const newUrls = [...optionsImageUrls];
    newUrls[idx] = val;
    setOptionsImageUrls(newUrls);
  };

  const [manageFilterCourse, setManageFilterCourse] = useState('');
  const [manageFilterSubject, setManageFilterSubject] = useState('');

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchCourse = !manageFilterCourse || q.course === manageFilterCourse;
      const matchSubject = !manageFilterSubject || q.subject === manageFilterSubject;
      return matchCourse && matchSubject;
    });
  }, [questions, manageFilterCourse, manageFilterSubject]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Tab Switcher */}
      <div className="flex flex-wrap bg-gray-100 dark:bg-slate-900 p-1.5 rounded-2xl w-fit mb-8 mx-auto border border-gray-200 dark:border-slate-800 shadow-inner justify-center gap-1.5">
        <button 
          onClick={() => { setActiveTab('EDITOR'); if(!isEditing) resetForm(); }}
          className={`px-4 md:px-6 py-2.5 rounded-xl font-bold text-[11px] md:text-xs transition-all ${activeTab === 'EDITOR' ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
        >
          {isEditing ? 'Editando' : 'Añadir'}
        </button>
        <button 
          onClick={() => setActiveTab('TEXTS')}
          className={`px-4 md:px-6 py-2.5 rounded-xl font-bold text-[11px] md:text-xs transition-all ${activeTab === 'TEXTS' ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
        >
          Lecturas
        </button>
        <button 
          onClick={() => setActiveTab('MANAGE')}
          className={`px-4 md:px-6 py-2.5 rounded-xl font-bold text-[11px] md:text-xs transition-all ${activeTab === 'MANAGE' ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
        >
          Banco ({questions.length})
        </button>
        <button 
          onClick={() => setActiveTab('FLASHCARDS_ADD')}
          className={`px-4 md:px-6 py-2.5 rounded-xl font-bold text-[11px] md:text-xs transition-all ${activeTab === 'FLASHCARDS_ADD' ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
        >
          Subir Flashcards
        </button>
        <button 
          onClick={() => setActiveTab('FLASHCARDS_MANAGE')}
          className={`px-4 md:px-6 py-2.5 rounded-xl font-bold text-[11px] md:text-xs transition-all ${activeTab === 'FLASHCARDS_MANAGE' ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
        >
          Banco Flashcards ({flashcards.length})
        </button>
        <button 
          onClick={() => setActiveTab('COVERS')}
          className={`px-4 md:px-6 py-2.5 rounded-xl font-bold text-[11px] md:text-xs transition-all ${activeTab === 'COVERS' ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
        >
          Portadas
        </button>
      </div>

      {activeTab === 'EDITOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 md:p-8">
              <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-3">
                <span className="bg-indigo-600 dark:bg-indigo-700 text-white p-2 rounded-lg">📝</span>
                {isEditing ? 'Editar Pregunta' : 'Nueva Pregunta'}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Curso</label>
                  <select value={course} onChange={(e) => setCourse(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200">
                    <option value="">Selecciona curso...</option>
                    {ACADEMIC_STRUCTURE.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Materia</label>
                  <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200">
                    <option value="">Selecciona materia...</option>
                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Tema / Práctica</label>
                    <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej. Ecuaciones" className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Semana (Opcional)</label>
                    <input type="number" min="1" max="52" value={week} onChange={(e) => setWeek(e.target.value !== '' ? parseInt(e.target.value) : '')} placeholder="Ej. 1, 2..." className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200" />
                  </div>
                </div>
                {(subject === 'Comprensión Lectora' || subject === 'Inglés Lectura') && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Lectura Asociada</label>
                    <select value={readingTextId} onChange={(e) => setReadingTextId(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200">
                      <option value="">Selecciona una lectura...</option>
                      {readingTexts.filter(t => t.subject === subject).map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Link Imagen (Opcional)</label>
                  <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200" />
                </div>
              </div>

              {/* LaTeX Guide */}
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                <h4 className="text-amber-800 dark:text-amber-300 font-bold text-xs uppercase mb-2">📐 Guía Latex</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono text-amber-700 dark:text-amber-400">
                  <div className="p-1 bg-white/50 dark:bg-slate-800 rounded">{'Potencia: $x^2$'}</div>
                  <div className="p-1 bg-white/50 dark:bg-slate-800 rounded">{'Raíz: $\\sqrt{x}$'}</div>
                  <div className="p-1 bg-white/50 dark:bg-slate-800 rounded">{'Fracción: $\\frac{a}{b}$'}</div>
                  <div className="p-1 bg-white/50 dark:bg-slate-800 rounded">{'Base: $log_{b}$'}</div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Enunciado</label>
                    <TextFormatterBar targetId="admin-question-text" value={questionText} onChange={setQuestionText} />
                  </div>
                  <textarea id="admin-question-text" value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4 min-h-[100px] outline-none dark:text-gray-200 whitespace-pre-wrap" />
                </div>
                <div className="space-y-3">
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Alternativas</label>
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border dark:border-slate-700">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-550">Alternativa {String.fromCharCode(65 + idx)}</span>
                        <TextFormatterBar targetId={`admin-opt-text-${idx}`} value={opt} onChange={(val) => handleOptionChange(idx, val)} />
                      </div>
                      <div className="flex gap-3 items-center">
                        <input type="radio" name="correct" checked={correctIndex === idx} onChange={() => setCorrectIndex(idx)} className="w-5 h-5 accent-indigo-600 shrink-0" />
                        <textarea id={`admin-opt-text-${idx}`} value={opt} onChange={(e) => handleOptionChange(idx, e.target.value)} placeholder={`Alt ${String.fromCharCode(65 + idx)}`} className="flex-grow bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg p-3 outline-none dark:text-gray-200 min-h-[50px] whitespace-pre-wrap" />
                      </div>
                      <div className="flex gap-3 items-center pl-8">
                        <span className="text-xs text-gray-400 font-bold uppercase">Img:</span>
                        <input type="url" value={optionsImageUrls[idx]} onChange={(e) => handleOptionImageUrlChange(idx, e.target.value)} placeholder="Link imagen (opcional)" className="flex-grow bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg p-2 text-sm outline-none dark:text-gray-200" />
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Explicación</label>
                    <TextFormatterBar targetId="admin-explanation-text" value={explanation} onChange={setExplanation} />
                  </div>
                  <textarea id="admin-explanation-text" value={explanation} onChange={(e) => setExplanation(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4 min-h-[80px] outline-none dark:text-gray-200 whitespace-pre-wrap mb-2" />
                  <input type="url" value={explanationImageUrl} onChange={(e) => setExplanationImageUrl(e.target.value)} placeholder="Link imagen resolución (opcional)" className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200" />
                </div>
                <button onClick={handleAddOrUpdate} className="w-full py-4 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg transition-all">
                  {isEditing ? 'Actualizar Pregunta' : 'Añadir a la lista temporal'}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  Cola de Nuevas: 
                  <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-sm">
                    {currentBatch.length}
                  </span>
                </h3>
                {isBatchStarted && (
                  <button onClick={handleSaveAllBatch} className="bg-emerald-600 dark:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-all shadow-md shadow-emerald-100 dark:shadow-none active:scale-95">
                    Guardar Todo
                  </button>
                )}
              </div>
              <div className="max-h-[30vh] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                {currentBatch.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl">
                    <div className="flex justify-between items-start gap-3">
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase">Pregunta {idx + 1}</span>
                      <button 
                        onClick={() => setCurrentBatch(prev => prev.filter(item => item.id !== q.id))}
                        className="text-gray-300 dark:text-gray-600 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l1.293 1.293a1 1 0 01-1.414 1.414L10 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-sm font-medium line-clamp-2 mt-1">{parseHTMLTags(q.questionText)}</p>
                    <div className="mt-2 text-[10px] text-gray-400 uppercase font-black tracking-tighter flex items-center gap-1.5 flex-wrap">
                      <span>{q.subject}</span>
                      {q.week !== undefined && q.week !== null && (
                        <span className="bg-indigo-50 dark:bg-indigo-950 font-black text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[8px]">
                          Semana {q.week}
                        </span>
                      )}
                      {q.readingTextId ? <span>• Con Lectura</span> : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 md:p-8 sticky top-[100px]">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">👁️ Vista Previa Real</h3>
              <div ref={previewRef} className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                <div className="p-4 bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm whitespace-pre-wrap">
                  {questionText ? formatQuestionText(questionText) : <span className="text-gray-400 italic">Escribe algo...</span>}
                </div>
                <div className="space-y-2">
                  {options.map((opt, i) => opt && (
                    <div key={i} className="p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg text-xs whitespace-pre-wrap flex items-center gap-2">
                      <span className="font-bold opacity-50">{String.fromCharCode(65 + i)})</span>
                      <span>{parseHTMLTags(opt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'TEXTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-8">
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-3">📖 {editingTextId ? 'Editar Lectura' : 'Nueva Lectura'}</h2>
            <div className="space-y-4">
              <select value={textSubject} onChange={(e) => setTextSubject(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200">
                <option value="Comprensión Lectora">Comprensión Lectora</option>
                <option value="Inglés Lectura">Inglés Lectura</option>
              </select>
              <input type="text" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} placeholder="Título..." className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200" />
              <textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="Contenido..." className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4 min-h-[300px] outline-none dark:text-gray-200 whitespace-pre-wrap" />
              <button onClick={handleSaveReadingTextLocal} className="w-full py-4 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg">Guardar Lectura</button>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Lecturas ({readingTexts.length})</h3>
            {readingTexts.map(t => (
              <div key={t.id} className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl p-5 shadow-sm flex justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded uppercase">{t.subject}</span>
                  </div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-100">{t.title}</h4>
                  <p className="text-xs text-gray-400 line-clamp-2">{t.content}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditExistingText(t)} className="p-2 text-indigo-400">✏️</button>
                  <button onClick={() => setTextToDelete(t.id)} className="p-2 text-rose-400">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'MANAGE' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100">Banco de Preguntas</h2>
            <select value={manageFilterCourse} onChange={(e) => setManageFilterCourse(e.target.value)} className="bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none dark:text-gray-200">
              <option value="">Cursos...</option>
              {ACADEMIC_STRUCTURE.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuestions.map((q) => (
              <div key={q.id} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-5 flex flex-col group">
                <div className="flex justify-between items-start mb-3">
                  <span className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded uppercase">{q.subject}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditExisting(q)} className="p-1 text-indigo-400">✏️</button>
                    <button onClick={() => handleDeleteExisting(q.id)} className="p-1 text-rose-400">🗑️</button>
                  </div>
                </div>
                <p className="text-sm font-medium mb-4 line-clamp-3 whitespace-pre-wrap dark:text-gray-200">{parseHTMLTags(q.questionText)}</p>
                <div className="mt-auto flex flex-wrap gap-2 items-center justify-between text-[10px] uppercase font-black text-gray-400 dark:text-gray-500 pt-3 border-t dark:border-slate-700/50">
                  <span className="truncate max-w-[150px]">Tema: {q.topic}</span>
                  {q.week !== undefined && q.week !== null && (
                    <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded font-black text-[9px] shrink-0">
                      Semana {q.week}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'FLASHCARDS_ADD' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in text-gray-800 dark:text-gray-100">
          {/* Individual Form */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 md:p-8">
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-3">
              <span className="bg-indigo-600 text-white p-2 rounded-lg">🎴</span>
              Nueva Flashcard
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Curso</label>
                  <select value={fcCourse} onChange={(e) => { setFcCourse(e.target.value); setFcSubject(''); }} className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200">
                    <option value="">Selecciona curso...</option>
                    {ACADEMIC_STRUCTURE.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Materia</label>
                  <select value={fcSubject} onChange={(e) => setFcSubject(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200">
                    <option value="">Selecciona materia...</option>
                    {fcAvailableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Tema / Título (Obligatorio)</label>
                <input type="text" value={fcTopic} onChange={(e) => setFcTopic(e.target.value)} placeholder="Ej. Segunda ley de Newton" className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200 focus:border-indigo-500" required />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Anverso / Pregunta (Soporta LaTeX)</label>
                <textarea value={fcFront} onChange={(e) => setFcFront(e.target.value)} placeholder="Fórmula de la fuerza centrípeta..." className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4 min-h-[100px] outline-none dark:text-gray-200 whitespace-pre-wrap" />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Reverso / Respuesta (Soporta LaTeX)</label>
                <textarea value={fcBack} onChange={(e) => setFcBack(e.target.value)} placeholder="$F_c = \frac{m \cdot v^2}{r}$" className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4 min-h-[100px] outline-none dark:text-gray-200 whitespace-pre-wrap" />
              </div>

              {/* Dynamic Preview face recto-verso */}
              <div className="p-4 bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl">
                <h4 className="text-xs font-black text-indigo-500 uppercase mb-2">👁️ Vista Previa de Tarjeta</h4>
                <div className="grid grid-cols-2 gap-3 text-xs" ref={fcPreviewRef}>
                  <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg min-h-[80px]">
                    <span className="font-bold block text-[10px] text-gray-400 uppercase mb-1">Anverso:</span>
                    <div className="whitespace-pre-wrap font-medium">{fcFront || 'Vacío'}</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg min-h-[80px]">
                    <span className="font-bold block text-[10px] text-amber-500 uppercase mb-1">Reverso:</span>
                    <div className="whitespace-pre-wrap font-medium">{fcBack || 'Vacío'}</div>
                  </div>
                </div>
              </div>

              <button onClick={handleSaveFcIndividual} className="w-full py-4 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg transition-all active:scale-95">
                Guardar Flashcard
              </button>
            </div>
          </div>

          {/* Bulk Import */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 md:p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-3">
                <span className="bg-indigo-600 text-white p-2 rounded-lg">⚡</span>
                Carga en Masa de Flashcards
              </h2>
              
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Curso Destino</label>
                    <select value={fcBulkCourse} onChange={(e) => { setFcBulkCourse(e.target.value); setFcBulkSubject(''); }} className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200">
                      <option value="">Selecciona curso...</option>
                      {ACADEMIC_STRUCTURE.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Materia Destino</label>
                    <select value={fcBulkSubject} onChange={(e) => setFcBulkSubject(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200">
                      <option value="">Selecciona materia...</option>
                      {fcBulkAvailableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Estilo de Formato</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
                    <button 
                      onClick={() => setFcBulkFormat('SEMICOLON')}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${fcBulkFormat === 'SEMICOLON' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                      Punto y Coma (Frente;Atrás)
                    </button>
                    <button 
                      onClick={() => setFcBulkFormat('JSON')}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${fcBulkFormat === 'JSON' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                      JSON Array [{'{...}'}]
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Datos a Importar (Una por línea)</label>
                  <textarea 
                    value={fcBulkText} 
                    onChange={(e) => setFcBulkText(e.target.value)} 
                    placeholder={
                      fcBulkFormat === 'SEMICOLON' 
                        ? 'Ej:\n¿Cuál es el elemento químico H?;Hidrógeno\n¿Qué es la mitosis?;División celular celular\n¿Ley de la gravedad?;$F = G \\frac{m_1 m_2}{r^1}$' 
                        : '[\n  { "front": "¿Qué es la fotosíntesis?", "back": "Proceso químico solar de plantas..." },\n  { "front": "Fórmula del agua", "back": "$H_2O$" }\n]'
                    }
                    className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4 min-h-[180px] outline-none dark:text-gray-200 font-mono text-xs whitespace-pre" 
                  />
                </div>
              </div>
            </div>

            <button onClick={handleSaveFcBulk} className="w-full py-4 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg transition-all active:scale-95">
              Importar Flashcards en Lote
            </button>
          </div>
        </div>
      )}

      {activeTab === 'FLASHCARDS_MANAGE' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 md:p-8 animate-fade-in text-gray-800 dark:text-gray-100">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100">Banco de Flashcards</h2>
            <div className="flex flex-wrap gap-2">
              <select value={fcFilterCourse} onChange={(e) => { setFcFilterCourse(e.target.value); setFcFilterSubject(''); }} className="bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none dark:text-gray-200">
                <option value="">Filtrar Curso...</option>
                {ACADEMIC_STRUCTURE.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <select value={fcFilterSubject} onChange={(e) => setFcFilterSubject(e.target.value)} className="bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none dark:text-gray-200">
                <option value="">Filtrar Materia...</option>
                {ACADEMIC_STRUCTURE.find(c => c.name === fcFilterCourse)?.subjects.map(s => <option key={s} value={s}>{s}</option>) || null}
              </select>
            </div>
          </div>

          {filteredFlashcards.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-600 font-medium">
              No se encontraron flashcards en esta categoría. Puedes añadir algunas en la pestaña "Subir Flashcards".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFlashcards.map(fc => (
                <div key={fc.id} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl p-5 flex flex-col justify-between group shadow-sm">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-wrap gap-1">
                        <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[9px] font-black px-2.5 py-0.5 rounded uppercase">
                          {fc.subject}
                        </span>
                        {fc.topic && (
                          <span className="bg-gray-100 dark:bg-slate-700/65 text-gray-650 dark:text-gray-350 text-[9px] font-bold px-2 py-0.5 rounded uppercase max-w-[120px] truncate" title={fc.topic}>
                            {fc.topic}
                          </span>
                        )}
                        {fc.difficulty && (
                          <span className={`text-[9px] font-black px-2.5 py-0.5 rounded uppercase ${
                            fc.difficulty === 'EASY' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' :
                            fc.difficulty === 'MEDIUM' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' :
                            'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                          }`}>
                            {fc.difficulty === 'EASY' ? 'Fácil' : fc.difficulty === 'MEDIUM' ? 'Casi' : 'Difícil'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 opacity-65 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setFcEditing({ ...fc });
                          }} 
                          className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                          title="Editar Flashcard"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => setFcDeleteId(fc.id)} 
                          className="text-gray-400 hover:text-rose-500 p-1 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                          title="Eliminar Flashcard"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="mb-2">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">Frente:</span>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-3 whitespace-pre-wrap">{fc.front}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">Atrás:</span>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 whitespace-pre-wrap italic">{fc.back}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'COVERS' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 md:p-8 animate-fade-in text-gray-800 dark:text-gray-100">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-3">
              <span className="bg-indigo-600 dark:bg-indigo-700 text-white p-2 rounded-lg">🖼️</span>
              Portadas de Cursos
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Ingresa los links de las imágenes de portada (cover) que deseas asignar a cada curso. Si lo dejas vacío o usas "Restablecer", se restaurará la imagen ilustrativa predeterminada.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {coursesWithFullData.map((course) => {
              const currentUrl = tempCovers[course.name] ?? '';
              return (
                <div key={course.name} className="flex flex-col sm:flex-row gap-4 p-5 bg-gray-50 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-800/80 transition-shadow hover:shadow-md">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 border border-gray-200 dark:border-slate-700 shadow-inner relative group bg-gray-150 dark:bg-slate-800 flex items-center justify-center">
                    <img 
                      src={currentUrl || course.defaultIcon} 
                      alt={course.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300';
                      }}
                    />
                    <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-[2px] text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
                      {currentUrl ? 'Personalizada' : 'Por Defecto'}
                    </div>
                  </div>

                  <div className="flex-grow flex flex-col justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-gray-800 dark:text-gray-100 text-lg">{course.name}</h4>
                      <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1">{course.subjects.join(', ')}</p>
                    </div>

                    <div className="space-y-2">
                      <input 
                        type="url" 
                        value={currentUrl} 
                        onChange={(e) => handleCoverChange(course.name, e.target.value)} 
                        placeholder="Link de imagen (https://...)" 
                        className="w-full text-xs bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 outline-none dark:text-gray-200 focus:border-indigo-500 dark:focus:border-indigo-600 transition-colors"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveSingleCover(course.name)}
                          className="flex-grow py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all active:scale-[0.98]"
                        >
                          Guardar Link
                        </button>
                        <button
                          onClick={() => handleResetSingleCover(course.name)}
                          className="py-2 px-3 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 text-xs font-bold transition-all active:scale-[0.98]"
                        >
                          Restablecer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Flashcard Modal */}
      {fcDeleteId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Eliminar Tarjeta</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ¿Estás seguro de que deseas eliminar esta flashcard del banco? No se puede deshacer.
            </p>
            <div className="flex justify-end gap-3 font-semibold text-sm">
              <button
                onClick={() => setFcDeleteId(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteFlashcard(fcDeleteId);
                  setFcDeleteId(null);
                  showToast("Flashcard eliminada con éxito.");
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 active:scale-95 transition-all shadow-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Flashcard Modal */}
      {fcEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in text-gray-800 dark:text-gray-150 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 max-w-xl w-full shadow-2xl border border-gray-100 dark:border-slate-800 my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">✏️</span>
                Editar Flashcard
              </h3>
              <button 
                onClick={() => setFcEditing(null)}
                className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 transition-colors"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Curso</label>
                  <select 
                    value={fcEditing.course} 
                    onChange={(e) => {
                      setFcEditing({
                        ...fcEditing,
                        course: e.target.value,
                        subject: '' // Reset subject when course changes
                      });
                    }} 
                    className="w-full bg-gray-50 dark:bg-slate-850 border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200 focus:border-indigo-500"
                  >
                    <option value="">Selecciona curso...</option>
                    {ACADEMIC_STRUCTURE.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Materia</label>
                  <select 
                    value={fcEditing.subject} 
                    onChange={(e) => setFcEditing({ ...fcEditing, subject: e.target.value })} 
                    className="w-full bg-gray-50 dark:bg-slate-850 border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200 focus:border-indigo-500"
                  >
                    <option value="">Selecciona materia...</option>
                    {(ACADEMIC_STRUCTURE.find(c => c.name === fcEditing.course)?.subjects || []).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Tema / Título (Obligatorio)</label>
                <input 
                  type="text" 
                  value={fcEditing.topic || ''} 
                  onChange={(e) => setFcEditing({ ...fcEditing, topic: e.target.value })} 
                  placeholder="Ej. Segunda ley de Newton" 
                  className="w-full bg-gray-50 dark:bg-slate-850 border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-205 focus:border-indigo-500" 
                  required 
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Anverso / Pregunta (Soporta LaTeX)</label>
                <textarea 
                  value={fcEditing.front} 
                  onChange={(e) => setFcEditing({ ...fcEditing, front: e.target.value })} 
                  placeholder="Fórmula de la fuerza centrípeta..." 
                  className="w-full bg-gray-50 dark:bg-slate-850 border border-gray-200 dark:border-slate-700 rounded-xl p-3 min-h-[100px] outline-none dark:text-gray-205 focus:border-indigo-500 whitespace-pre-wrap" 
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Reverso / Respuesta (Soporta LaTeX)</label>
                <textarea 
                  value={fcEditing.back} 
                  onChange={(e) => setFcEditing({ ...fcEditing, back: e.target.value })} 
                  placeholder="$F_c = \frac{m \cdot v^2}{r}$" 
                  className="w-full bg-gray-50 dark:bg-slate-850 border border-gray-200 dark:border-slate-700 rounded-xl p-3 min-h-[100px] outline-none dark:text-gray-205 focus:border-indigo-500 whitespace-pre-wrap" 
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">Dificultad</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['EASY', 'MEDIUM', 'HARD'] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setFcEditing({ ...fcEditing, difficulty: diff })}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        fcEditing.difficulty === diff 
                          ? diff === 'EASY' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : diff === 'MEDIUM' ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                          : 'bg-gray-50 dark:bg-slate-850 border-gray-200 dark:border-slate-700 text-gray-650 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {diff === 'EASY' ? 'Fácil' : diff === 'MEDIUM' ? 'Medio' : 'Difícil'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 font-semibold text-sm mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setFcEditing(null)}
                className="px-5 py-2.5 text-gray-600 dark:text-gray-405 font-medium hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!fcEditing.topic || !fcEditing.topic.trim()) {
                    showToast("El título/tema es obligatorio para la flashcard.");
                    return;
                  }
                  if (!fcEditing.course || !fcEditing.subject) {
                    showToast("Por favor, selecciona un curso y una materia.");
                    return;
                  }
                  onSaveFlashcardsBatch([fcEditing]);
                  setFcEditing(null);
                  showToast("Flashcard actualizada con éxito.");
                }}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-md"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-fade-in-up font-medium">
          {toastMessage}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {questionToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Eliminar Pregunta</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ¿Estás seguro de que deseas eliminar esta pregunta del banco? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setQuestionToDelete(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteQuestion(questionToDelete);
                  setQuestionToDelete(null);
                  showToast("Pregunta eliminada.");
                }}
                className="px-4 py-2 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 active:scale-95 transition-all shadow-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Text Confirmation Modal */}
      {textToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100 dark:border-slate-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Eliminar Lectura</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ¿Seguro? Se desvincularán las preguntas asociadas a esta lectura.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTextToDelete(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteReadingText(textToDelete);
                  setTextToDelete(null);
                  showToast("Lectura eliminada.");
                }}
                className="px-4 py-2 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 active:scale-95 transition-all shadow-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
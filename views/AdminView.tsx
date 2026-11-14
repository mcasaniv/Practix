
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Question, ReadingText, Flashcard, AcademicArea, TargetArea } from '../types';
import { ACADEMIC_STRUCTURE, ADMISSION_PROCESSES, DEFAULT_ADMISSION_PROCESS, CEPRE_BASE_TYPES } from '../constants';
import { formatQuestionText, parseHTMLTags, getQuestionProcess, getProcessBadgeStyle, getProcessShortName, getAvailableProcesses, getOfficialSubjectWeight, ALL_ACADEMIC_SUBJECTS, getAreaBadgeStyle, ACADEMIC_AREAS, getQuestionArea, getQuestionAreas, matchesQuestionArea, FormulaTokenRenderer, renderMathAndHtml } from '../utils';
import { ImageOcclusionModal } from '../components/ImageOcclusionModal';
import { FormulaBuilderModal, decomposeFormula } from '../components/FormulaBuilderModal';

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

interface FlashcardImageFieldProps {
  label: string;
  sublabel?: string;
  imageUrl: string;
  onChange: (url: string) => void;
  accent: 'indigo' | 'amber';
}

const FlashcardImageField: React.FC<FlashcardImageFieldProps> = ({
  label,
  sublabel,
  imageUrl,
  onChange,
  accent
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Por favor selecciona un archivo de imagen válido.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      alert("La imagen seleccionada supera los 8MB. Por favor elige una imagen más ligera.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        onChange(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const isAmber = accent === 'amber';
  const badgeClasses = isAmber
    ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60'
    : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800/60';

  return (
    <div className="p-3 bg-gray-50/70 dark:bg-slate-800/50 border border-gray-200/80 dark:border-slate-700/70 rounded-xl space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {label}
        </label>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClasses}`}>
          {isAmber ? 'Reverso / Respuesta' : 'Anverso / Pregunta'}
        </span>
      </div>
      {sublabel && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{sublabel}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFile(file);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {imageUrl ? (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl">
            <img
              src={imageUrl}
              alt="Preview"
              className="w-20 h-20 object-contain rounded-lg border border-gray-200 dark:border-slate-700 bg-black/5 dark:bg-white/5 shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="flex-grow min-w-0 text-xs space-y-1.5">
              <div>
                <span className="font-bold text-gray-800 dark:text-slate-100 block truncate">
                  {imageUrl.startsWith('data:') ? 'Imagen local cargada' : imageUrl}
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Imagen adjuntada correctamente
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 rounded-lg transition-colors flex items-center gap-1"
                  title="Reemplazar con otra imagen desde tu dispositivo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Cambiar imagen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!showUrlInput) {
                      setInputUrl(imageUrl.startsWith('data:') ? '' : imageUrl);
                    }
                    setShowUrlInput(!showUrlInput);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-1"
                  title="Cambiar o editar enlace URL de la imagen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {showUrlInput ? 'Cerrar URL' : 'Cambiar URL'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setInputUrl('');
                    setShowUrlInput(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-white bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-600 border border-rose-200 dark:border-rose-900/50 rounded-lg transition-colors flex items-center gap-1"
                  title="Quitar imagen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Quitar
                </button>
              </div>
            </div>
          </div>

          {showUrlInput && (
            <div className="flex gap-2 animate-fade-in">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (inputUrl.trim()) {
                      onChange(inputUrl.trim());
                      setShowUrlInput(false);
                    }
                  }
                }}
                placeholder="https://ejemplo.com/nueva-imagen.png"
                className="flex-grow bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (inputUrl.trim()) {
                    onChange(inputUrl.trim());
                    setShowUrlInput(false);
                  }
                }}
                className="px-3 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shrink-0"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Subir Archivo de Imagen</span>
            </button>

            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>{showUrlInput ? 'Cerrar URL' : 'O pegar enlace URL'}</span>
            </button>
          </div>

          {showUrlInput && (
            <div className="flex gap-2 animate-fade-in pt-1">
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (inputUrl.trim()) {
                      onChange(inputUrl.trim());
                      setShowUrlInput(false);
                    }
                  }
                }}
                placeholder="https://ejemplo.com/diagrama.png"
                className="flex-grow bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (inputUrl.trim()) {
                    onChange(inputUrl.trim());
                    setShowUrlInput(false);
                  }
                }}
                className="px-3 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shrink-0"
              >
                Adjuntar
              </button>
            </div>
          )}
        </div>
      )}
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
  const [activeTab, setActiveTab] = useState<'EDITOR' | 'MANAGE' | 'TEXTS' | 'FLASHCARDS_ADD' | 'FLASHCARDS_MANAGE'>('EDITOR');
  const [currentBatch, setCurrentBatch] = useState<Question[]>([]);
  const [showAdminOcclusionModal, setShowAdminOcclusionModal] = useState(false);
  const [showAdminFormulaModal, setShowAdminFormulaModal] = useState(false);

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
  const [cepreType, setCepreType] = useState<string>('Ceprunsa I Fase');
  const [cepreYear, setCepreYear] = useState<string>('2027');
  const [customProcessText, setCustomProcessText] = useState<string>('');
  const [week, setWeek] = useState<number | ''>('');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '', '']);
  const [optionsImageUrls, setOptionsImageUrls] = useState<string[]>(['', '', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [explanationImageUrl, setExplanationImageUrl] = useState('');
  const [readingTextId, setReadingTextId] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Area state: Aplica a TODAS las preguntas (permite seleccionar 1, 2 o las 3 áreas)
  const [questionAreas, setQuestionAreas] = useState<TargetArea[]>(['Biomédicas']);
  const [questionArea, setQuestionArea] = useState<AcademicArea>('Biomédicas');
  const [manageFilterArea, setManageFilterArea] = useState<string>('');

  const handleToggleQuestionArea = (target: TargetArea) => {
    setQuestionAreas(prev => {
      if (prev.includes(target)) {
        if (prev.length === 1) {
          showToast('La pregunta debe pertenecer al menos a un área.');
          return prev;
        }
        const next = prev.filter(a => a !== target);
        setQuestionArea(next.length === 3 ? 'Todas' : next[0]);
        return next;
      }
      const next = [...prev, target];
      setQuestionArea(next.length === 3 ? 'Todas' : next[0]);
      return next;
    });
  };

  // Official Exam state (para Exámenes / Simulacros Oficiales)
  const [examArea, setExamArea] = useState<'Biomédicas' | 'Ingenierías' | 'Sociales'>('Biomédicas');
  const [examTargetSubject, setExamTargetSubject] = useState<string>('Física');
  const [examCustomWeight, setExamCustomWeight] = useState<string>('');

  const isOfficialExamCourse = course === 'Exámenes' || subject === 'Simulacros Oficiales' || subject === 'Exámenes Simulacros';

  const officialAutoWeight = useMemo(() => {
    const areaForWeight = (questionArea === 'Ingenierías' || questionArea === 'Sociales') ? questionArea : 'Biomédicas';
    return getOfficialSubjectWeight(examTargetSubject, areaForWeight);
  }, [examTargetSubject, questionArea]);

  const effectiveWeight = useMemo(() => {
    if (examCustomWeight && !isNaN(Number(examCustomWeight)) && Number(examCustomWeight) > 0) {
      return Number(examCustomWeight);
    }
    return officialAutoWeight;
  }, [examCustomWeight, officialAutoWeight]);

  const resolvedProcess = useMemo(() => {
    if (cepreType === 'Mazo Propio (Sin Cepre)') {
      return 'Mazo Propio (Sin Cepre)';
    }
    if (cepreType === 'Personalizado / Otro') {
      return customProcessText.trim() || 'Proceso Personalizado';
    }
    const yr = cepreYear.trim();
    return yr ? `${cepreType} ${yr}` : cepreType;
  }, [cepreType, cepreYear, customProcessText]);

  // Lista amplia de años históricos y futuros + años detectados en el banco
  const existingYearsInDb = useMemo(() => {
    const years = new Set<string>();
    // Generar años desde 2030 hacia atrás hasta 2012
    for (let y = 2030; y >= 2012; y--) {
      years.add(String(y));
    }
    // Añadir cualquier año presente en las preguntas cargadas
    questions.forEach(q => {
      const match = q.process?.match(/\b(19\d\d|20\d\d)\b/);
      if (match) years.add(match[0]);
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [questions]);

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
  const [fcFrontImageUrl, setFcFrontImageUrl] = useState('');
  const [fcBackImageUrl, setFcBackImageUrl] = useState('');
  const [fcHasMultiAnswers, setFcHasMultiAnswers] = useState(false);
  const [fcMultiAnswersText, setFcMultiAnswersText] = useState('');
  
  // Bulk upload of flashcards
  const [fcBulkText, setFcBulkText] = useState('');
  const [fcBulkCourse, setFcBulkCourse] = useState('');
  const [fcBulkSubject, setFcBulkSubject] = useState('');
  const [fcBulkTopic, setFcBulkTopic] = useState('');
  const [fcBulkFormat, setFcBulkFormat] = useState<'SEMICOLON' | 'JSON'>('SEMICOLON');
  const [fcDeleteId, setFcDeleteId] = useState<string | null>(null);
  const [fcEditing, setFcEditing] = useState<Flashcard | null>(null);
  const [fcEditNewToken, setFcEditNewToken] = useState('');
  const [fcEditNewDistractor, setFcEditNewDistractor] = useState('');
  const [editingOcclusionFlashcard, setEditingOcclusionFlashcard] = useState<Flashcard | null>(null);

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
  }, [fcFront, fcBack, fcFrontImageUrl, fcBackImageUrl, activeTab]);

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
    setQuestionArea('Biomédicas');
    setQuestionAreas(['Biomédicas']);
    if (full) {
      setCourse('');
      setSubject('');
      setTopic('');
      setCepreType('Ceprunsa I Fase');
      setCepreYear('2027');
      setCustomProcessText('');
      setExamArea('Biomédicas');
      setExamTargetSubject('Física');
      setExamCustomWeight('');
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

    const qData: Partial<Question> = {
      course,
      subject,
      topic,
      process: resolvedProcess,
      questionText,
      options: [...options],
      correctIndex,
      explanation,
      readingTextId: readingTextId || undefined,
      imageUrl: imageUrl || undefined,
      optionsImageUrls: optionsImageUrls.some(url => url) ? [...optionsImageUrls] : undefined,
      explanationImageUrl: explanationImageUrl || undefined,
      week: week !== '' ? Number(week) : undefined,
      targetSubject: isOfficialExamCourse ? examTargetSubject : undefined,
      area: questionAreas.length === 3 ? 'Todas' : questionAreas[0],
      areas: [...questionAreas],
      weight: isOfficialExamCourse ? effectiveWeight : undefined
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
    
    const qProc = q.process || DEFAULT_ADMISSION_PROCESS;
    if (qProc === 'Mazo Propio (Sin Cepre)') {
      setCepreType('Mazo Propio (Sin Cepre)');
      setCepreYear('');
      setCustomProcessText('');
    } else {
      const matchedBase = CEPRE_BASE_TYPES.find(b => b !== 'Mazo Propio (Sin Cepre)' && b !== 'Personalizado / Otro' && qProc.startsWith(b));
      if (matchedBase) {
        setCepreType(matchedBase);
        const yr = qProc.replace(matchedBase, '').trim();
        setCepreYear(yr || '2027');
        setCustomProcessText('');
      } else {
        const yearMatch = qProc.match(/\b\d{4}\b/);
        if (yearMatch) {
          const yr = yearMatch[0];
          const withoutYear = qProc.replace(yr, '').trim();
          const baseCandidate = CEPRE_BASE_TYPES.find(b => withoutYear.toLowerCase().includes(b.toLowerCase()));
          if (baseCandidate) {
            setCepreType(baseCandidate);
            setCepreYear(yr);
            setCustomProcessText('');
          } else {
            setCepreType('Personalizado / Otro');
            setCustomProcessText(qProc);
          }
        } else {
          setCepreType('Personalizado / Otro');
          setCustomProcessText(qProc);
        }
      }
    }

    setQuestionText(q.questionText);
    setOptions([...q.options]);
    setOptionsImageUrls(q.optionsImageUrls ? [...q.optionsImageUrls] : ['', '', '', '', '']);
    setCorrectIndex(q.correctIndex);
    setExplanation(q.explanation);
    setExplanationImageUrl(q.explanationImageUrl || '');
    setReadingTextId(q.readingTextId || '');
    setImageUrl(q.imageUrl || '');
    setWeek(q.week !== undefined && q.week !== null ? q.week : '');
    if (q.targetSubject) {
      setExamTargetSubject(q.targetSubject);
    }
    const resolvedAreas = getQuestionAreas(q);
    setQuestionAreas(resolvedAreas);
    const resolvedArea = resolvedAreas.length === 3 ? 'Todas' : (resolvedAreas[0] || 'Biomédicas');
    setQuestionArea(resolvedArea);
    if (resolvedAreas.length > 0) {
      setExamArea(resolvedAreas[0]);
    }
    if (q.weight) {
      setExamCustomWeight(String(q.weight));
    } else {
      setExamCustomWeight('');
    }
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

    const multiAnswersArray = fcHasMultiAnswers && fcMultiAnswersText.trim()
      ? fcMultiAnswersText.split(/[,;\n]/).map(s => s.trim().replace(/^[-•*]\s*/, '')).filter(Boolean)
      : undefined;

    const newCard: Flashcard = {
      id: crypto.randomUUID(),
      course: fcCourse,
      subject: fcSubject,
      topic: fcTopic.trim(),
      front: fcFront.trim(),
      back: fcBack.trim(),
      frontImageUrl: fcFrontImageUrl.trim() || undefined,
      backImageUrl: fcBackImageUrl.trim() || undefined,
      imageUrl: fcFrontImageUrl.trim() || undefined,
      type: 'TEXT',
      hasMultipleAnswers: fcHasMultiAnswers,
      multiAnswers: multiAnswersArray && multiAnswersArray.length > 1 ? multiAnswersArray : undefined,
      createdAt: Date.now()
    };
    onSaveFlashcardsBatch([newCard]);
    setFcFront('');
    setFcBack('');
    setFcFrontImageUrl('');
    setFcBackImageUrl('');
    setFcHasMultiAnswers(false);
    setFcMultiAnswersText('');
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
            const topic = item.topic || item.tema || fcBulkTopic.trim() || '';
            const frontImg = item.frontImageUrl || item.imagenPregunta || item.imagenAnverso || item.frontImage || item.imageUrl || '';
            const backImg = item.backImageUrl || item.imagenRespuesta || item.imagenReverso || item.backImage || '';
            if (front && back) {
              cards.push({
                id: crypto.randomUUID(),
                course: fcBulkCourse,
                subject: fcBulkSubject,
                topic: topic.trim() || undefined,
                front: front.trim(),
                back: back.trim(),
                frontImageUrl: frontImg.trim() || undefined,
                backImageUrl: backImg.trim() || undefined,
                imageUrl: frontImg.trim() || undefined,
                type: 'TEXT',
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
      // SEMICOLON / FREE-FORM TEXT
      const lines = fcBulkText.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let front = '';
        let back = '';

        // 1. Try semicolon ";"
        const semiIdx = trimmed.indexOf(';');
        if (semiIdx !== -1) {
          front = trimmed.substring(0, semiIdx).trim();
          back = trimmed.substring(semiIdx + 1).trim();
        } 
        // 2. Try tab "\t"
        else if (trimmed.indexOf('\t') !== -1) {
          const tabIdx = trimmed.indexOf('\t');
          front = trimmed.substring(0, tabIdx).trim();
          back = trimmed.substring(tabIdx + 1).trim();
        } 
        // 3. Try double or more spaces
        else if (/\s{2,}/.test(trimmed)) {
          const matchDouble = trimmed.match(/\s{2,}/);
          if (matchDouble && matchDouble.index !== undefined) {
            front = trimmed.substring(0, matchDouble.index).trim();
            back = trimmed.substring(matchDouble.index + matchDouble[0].length).trim();
          }
        } 
        // 4. Try question mark "?" (ends with ? followed by space or end)
        else if (trimmed.includes('?')) {
          const questIdx = trimmed.indexOf('?');
          // Split at question mark but keep "?" as part of the question
          front = trimmed.substring(0, questIdx + 1).trim();
          back = trimmed.substring(questIdx + 1).trim();
        } 
        // 5. Try other separators: " - ", " – ", " — ", " : ", " = "
        else {
          const separators = [" - ", " – ", " — ", " : ", " = "];
          let foundSep = false;
          for (const sep of separators) {
            const sepIdx = trimmed.indexOf(sep);
            if (sepIdx !== -1) {
              front = trimmed.substring(0, sepIdx).trim();
              back = trimmed.substring(sepIdx + sep.length).trim();
              foundSep = true;
              break;
            }
          }
          
          // 6. Fallback: Last space character " "
          if (!foundSep) {
            const lastSpaceIdx = trimmed.lastIndexOf(' ');
            if (lastSpaceIdx !== -1) {
              front = trimmed.substring(0, lastSpaceIdx).trim();
              back = trimmed.substring(lastSpaceIdx + 1).trim();
            }
          }
        }

        if (front && back) {
          cards.push({
            id: crypto.randomUUID(),
            course: fcBulkCourse,
            subject: fcBulkSubject,
            topic: fcBulkTopic.trim() || undefined,
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
    setFcBulkTopic('');
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
  const [manageFilterProcess, setManageFilterProcess] = useState('');

  const availableProcessesList = useMemo(() => {
    return getAvailableProcesses(questions);
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchCourse = !manageFilterCourse || q.course === manageFilterCourse;
      const matchSubject = !manageFilterSubject || q.subject === manageFilterSubject;
      const matchProcess = !manageFilterProcess || getQuestionProcess(q) === manageFilterProcess;
      const resolvedArea = q.area || 'Biomédicas';
      const matchArea = !manageFilterArea || resolvedArea === manageFilterArea;
      return matchCourse && matchSubject && matchProcess && matchArea;
    });
  }, [questions, manageFilterCourse, manageFilterSubject, manageFilterProcess, manageFilterArea]);

  const handleBatchAssignArea = (targetArea: AcademicArea) => {
    if (filteredQuestions.length === 0) return;
    const targetIds = new Set(filteredQuestions.map(q => q.id));
    const updatedAll = questions.map(q => {
      if (targetIds.has(q.id)) {
        return { ...q, area: targetArea };
      }
      return q;
    });
    // Replace questions in batch by saving them
    onSaveBatch(updatedAll.filter(q => targetIds.has(q.id)));
    showToast(`Se asignó el área "${targetArea}" a ${targetIds.size} preguntas.`);
  };

  const handleMarkLegacyAsBiomedicas = () => {
    const legacyWithoutExplicitArea = questions.filter(q => !q.area);
    if (legacyWithoutExplicitArea.length === 0) {
      showToast("Todas las preguntas ya tienen un área asignada.");
      return;
    }
    const updated = legacyWithoutExplicitArea.map(q => ({ ...q, area: 'Biomédicas' as AcademicArea }));
    onSaveBatch(updated);
    showToast(`Se marcaron ${updated.length} preguntas anteriores como Biomédicas.`);
  };

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
      </div>

      {activeTab === 'EDITOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 md:p-8">
              <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-3">
                <span className="bg-indigo-600 dark:bg-indigo-700 text-white p-2 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </span>
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

                {/* Selector intuitivo y flexible de Cepre y cualquier Año */}
                <div className="md:col-span-2 bg-indigo-50/40 dark:bg-slate-800/80 p-4 rounded-2xl border border-indigo-100 dark:border-slate-700/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <label className="block text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest">
                        Proceso de Admisión (Cepre y Año)
                      </label>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Selecciona el Cepre y escribe o elige cualquier año sin restricciones.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <span className="text-[11px] font-bold text-gray-400 uppercase">Resultado:</span>
                      <span className="font-mono font-black text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg shadow-sm">
                        {resolvedProcess}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                    {/* Selector de Cepre base */}
                    <div className={cepreType === 'Mazo Propio (Sin Cepre)' ? 'sm:col-span-12' : cepreType === 'Personalizado / Otro' ? 'sm:col-span-5' : 'sm:col-span-6'}>
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                        Tipo de Cepre / Programa
                      </label>
                      <select 
                        value={cepreType} 
                        onChange={(e) => setCepreType(e.target.value)} 
                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-sm outline-none dark:text-gray-100 font-bold focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      >
                        {CEPRE_BASE_TYPES.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* Input y Selector de Año para CUALQUIER año */}
                    {cepreType !== 'Mazo Propio (Sin Cepre)' && cepreType !== 'Personalizado / Otro' && (
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Año (Escribe cualquiera o selecciona)
                        </label>
                        <div className="flex gap-2 items-center">
                          {/* Campo numérico libre para escribir CUALQUIER año */}
                          <div className="relative w-28 shrink-0">
                            <input
                              type="number"
                              min="1990"
                              max="2040"
                              placeholder="Ej: 2027"
                              value={cepreYear}
                              onChange={(e) => setCepreYear(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-black font-mono outline-none dark:text-gray-100 text-center focus:ring-2 focus:ring-indigo-500 shadow-sm"
                              title="Escribe cualquier año libremente"
                            />
                          </div>

                          {/* Selector desplegable con todos los años disponibles */}
                          <select
                            value={existingYearsInDb.includes(cepreYear) ? cepreYear : ''}
                            onChange={(e) => {
                              if (e.target.value) setCepreYear(e.target.value);
                            }}
                            className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold outline-none dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
                          >
                            <option value="">Años rápidos...</option>
                            {existingYearsInDb.map(yr => (
                              <option key={yr} value={yr}>Año {yr}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Campo personalizado para cualquier texto libre */}
                    {cepreType === 'Personalizado / Otro' && (
                      <div className="sm:col-span-7">
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                          Nombre Completo del Proceso
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Ceprunsa I Fase 2023, Mazo General..."
                          value={customProcessText}
                          onChange={(e) => setCustomProcessText(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-indigo-400 rounded-xl p-2.5 text-sm font-bold outline-none dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Selector de Área / Práctica de Admisión: Permite 1, 2 o las 3 áreas */}
                <div className="md:col-span-2 bg-gray-50 dark:bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-3 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-slate-700/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-gray-700 dark:bg-slate-700 text-white rounded-lg text-xs font-black">
                          ÁREAS
                        </span>
                        <label className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-wide">
                          Áreas a las que Aplica esta Pregunta
                        </label>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        Puedes escoger si esta pregunta va para 1 área, 2 áreas (ej. Biomédicas + Ingenierías) o las 3 áreas a la vez.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0 flex-wrap">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Seleccionadas ({questionAreas.length}):</span>
                      {questionAreas.map(a => {
                        const b = getAreaBadgeStyle(a);
                        return (
                          <span key={a} className={`px-2 py-0.5 rounded-lg text-xs font-black border ${b.bg} ${b.text} ${b.border}`}>
                            {b.icon} {a}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    {(['Biomédicas', 'Ingenierías', 'Sociales'] as const).map(aOption => {
                      const badge = getAreaBadgeStyle(aOption);
                      const isSelected = questionAreas.includes(aOption);
                      return (
                        <button
                          key={aOption}
                          type="button"
                          onClick={() => handleToggleQuestionArea(aOption)}
                          className={`p-3 rounded-xl font-black text-xs transition-all flex items-center justify-between border-2 min-h-[50px] ${
                            isSelected
                              ? 'border-indigo-600 dark:border-indigo-400 bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-md ring-2 ring-indigo-400/30 scale-[1.01]'
                              : 'border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 text-gray-500 dark:text-gray-400 hover:border-indigo-300 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{badge.icon}</span>
                            <span className="text-xs font-black">{aOption}</span>
                          </div>
                          {isSelected ? (
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                              Activa ✓
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-400">
                              + Añadir
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Panel adicional si es un simulacro oficial */}
                  {isOfficialExamCourse && (
                    <div className="pt-3 border-t border-indigo-100 dark:border-indigo-900/60 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-black uppercase text-indigo-900 dark:text-indigo-300 mb-1">
                            Materia Académica en el Simulacro:
                          </label>
                          <select
                            value={examTargetSubject}
                            onChange={(e) => setExamTargetSubject(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl p-2.5 text-xs font-black outline-none"
                          >
                            {ALL_ACADEMIC_SUBJECTS.map(subjName => (
                              <option key={subjName} value={subjName}>
                                {subjName} ({getOfficialSubjectWeight(subjName, examArea).toFixed(3)} pts en {examArea})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-between bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-indigo-100 dark:border-slate-800 text-xs">
                          <span className="text-gray-500 font-bold">Puntaje por acierto:</span>
                          <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{effectiveWeight.toFixed(5)} pts</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] text-gray-400 font-bold">Puntaje personalizado (opc):</span>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder={officialAutoWeight.toFixed(5)}
                          value={examCustomWeight}
                          onChange={(e) => setExamCustomWeight(e.target.value)}
                          className="w-24 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Tema / Práctica</label>
                    <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej. Ecuaciones" className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Semana (Opc.)</label>
                    <input type="number" min="1" max="52" value={week} onChange={(e) => setWeek(e.target.value !== '' ? parseInt(e.target.value) : '')} placeholder="Ej. 1..." className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200" />
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
                <h4 className="text-amber-800 dark:text-amber-300 font-bold text-xs uppercase mb-2">Guía LaTeX</h4>
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
                      {q.targetSubject && (
                        <span className="bg-emerald-100 dark:bg-emerald-950 font-black text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded text-[8px] border border-emerald-200 dark:border-emerald-800">
                          {q.targetSubject} {q.weight ? `• ${q.weight.toFixed(3)} pts` : ''}
                        </span>
                      )}
                      {q.area && (
                        <span className="bg-purple-100 dark:bg-purple-950 font-black text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[8px] border border-purple-200 dark:border-purple-800">
                          {q.area}
                        </span>
                      )}
                      {(() => {
                        const proc = getQuestionProcess(q);
                        const style = getProcessBadgeStyle(proc);
                        return (
                          <span className={`${style.bg} ${style.text} ${style.border} border font-black px-1.5 py-0.5 rounded text-[8px] flex items-center gap-0.5`}>
                            <span>{proc}</span>
                          </span>
                        );
                      })()}
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
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">Vista Previa Real</h3>
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
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-3">
              {editingTextId ? 'Editar Lectura' : 'Nueva Lectura'}
            </h2>
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
                  <button onClick={() => handleEditExistingText(t)} className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => setTextToDelete(t.id)} className="p-2 text-rose-400 hover:text-rose-600 transition-colors" title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'MANAGE' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100">Banco de Preguntas</h2>
              <p className="text-xs text-gray-400 mt-1">Mostrando {filteredQuestions.length} de {questions.length} preguntas</p>
            </div>
            <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
              <select 
                value={manageFilterArea} 
                onChange={(e) => setManageFilterArea(e.target.value)} 
                className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 rounded-xl px-3.5 py-2 text-xs font-black outline-none"
              >
                <option value="">Todas las Áreas</option>
                <option value="Biomédicas">🧬 Biomédicas</option>
                <option value="Ingenierías">⚙️ Ingenierías</option>
                <option value="Sociales">⚖️ Sociales</option>
                <option value="Todas">🌐 Común / Todas</option>
              </select>
              <select 
                value={manageFilterProcess} 
                onChange={(e) => setManageFilterProcess(e.target.value)} 
                className="bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold outline-none dark:text-gray-200"
              >
                <option value="">Todos los Procesos</option>
                {availableProcessesList.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select 
                value={manageFilterCourse} 
                onChange={(e) => setManageFilterCourse(e.target.value)} 
                className="bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold outline-none dark:text-gray-200"
              >
                <option value="">Todos los Cursos</option>
                {ACADEMIC_STRUCTURE.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Barra de Acciones por Área en Lote */}
          <div className="mb-6 p-4 bg-indigo-50/50 dark:bg-slate-800/60 rounded-2xl border border-indigo-100 dark:border-slate-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-black text-indigo-950 dark:text-indigo-200">
                Asignación de Área en Lote ({filteredQuestions.length} preguntas visibles):
              </span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Cambia en un solo clic el área de las preguntas filtradas según corresponda.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleBatchAssignArea('Biomédicas')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-all shadow-sm flex items-center gap-1"
                title="Asignar preguntas visibles al área de Biomédicas"
              >
                <span>🧬 Biomédicas</span>
              </button>
              <button
                type="button"
                onClick={() => handleBatchAssignArea('Ingenierías')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition-all shadow-sm flex items-center gap-1"
                title="Asignar preguntas visibles al área de Ingenierías"
              >
                <span>⚙️ Ingenierías</span>
              </button>
              <button
                type="button"
                onClick={() => handleBatchAssignArea('Sociales')}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] transition-all shadow-sm flex items-center gap-1"
                title="Asignar preguntas visibles al área de Sociales"
              >
                <span>⚖️ Sociales</span>
              </button>
              <button
                type="button"
                onClick={() => handleBatchAssignArea('Todas')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] transition-all shadow-sm flex items-center gap-1"
                title="Marcar como Común a Todas las áreas"
              >
                <span>🌐 Común</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuestions.map((q) => {
              const proc = getQuestionProcess(q);
              const procStyle = getProcessBadgeStyle(proc);
              return (
                <div key={q.id} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-5 flex flex-col group hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        {q.subject}
                      </span>
                      {q.targetSubject && (
                        <span className="bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded uppercase border border-emerald-200 dark:border-emerald-800">
                          {q.targetSubject} {q.weight ? `• ${q.weight.toFixed(3)} pts` : ''}
                        </span>
                      )}
                      {(() => {
                        const qAreas = getQuestionAreas(q);
                        if (qAreas.length === 3) {
                          return (
                            <span className="bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded uppercase border border-amber-200 dark:border-amber-800">
                              🌐 Común (3 Áreas)
                            </span>
                          );
                        }
                        return qAreas.map(a => {
                          const b = getAreaBadgeStyle(a);
                          return (
                            <span key={a} className={`${b.bg} ${b.text} ${b.border} border text-[10px] font-black px-2 py-0.5 rounded uppercase flex items-center gap-1`}>
                              <span>{b.icon}</span>
                              <span>{a}</span>
                            </span>
                          );
                        });
                      })()}
                      <span className={`${procStyle.bg} ${procStyle.text} ${procStyle.border} border text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1`}>
                        <span>{proc}</span>
                      </span>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => handleEditExisting(q)} className="p-1 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteExisting(q.id)} className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors" title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'FLASHCARDS_ADD' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in text-gray-800 dark:text-gray-100">
          {/* Individual Form */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 md:p-8">
            {/* Banner for Interactive Creation Tools */}
            <div className="mb-6 p-4 sm:p-5 bg-gradient-to-br from-indigo-50/80 via-slate-50/40 to-indigo-50/20 dark:from-slate-800/80 dark:via-slate-800/50 dark:to-indigo-950/40 border border-indigo-200/90 dark:border-indigo-800/80 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100/80 dark:border-slate-700/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider bg-indigo-100/80 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    Formatos Especiales
                  </span>
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hidden sm:inline">
                    • Ejercicios interactivos y diagramas
                  </span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-wide uppercase">
                  Creador Avanzado
                </span>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <span>✨</span>
                  <span>Modos de Estudio Dinámicos</span>
                </h3>
                <p className="text-xs text-gray-650 dark:text-gray-350 mt-1 leading-relaxed">
                  Crea ejercicios interactivos con bloques para armar fórmulas paso a paso o utiliza imágenes con oclusión para ocultar nombres en diagramas anatómicos, ciclos y esquemas.
                </p>
              </div>

              {/* Action Buttons Grid - Perfectly balanced on PC & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminFormulaModal(true)}
                  className="group relative flex items-center gap-3 p-3 sm:p-3.5 bg-white dark:bg-[#000c19] hover:bg-amber-50/50 dark:hover:bg-[#00142b] border border-amber-200/80 dark:border-amber-900/50 hover:border-amber-400 dark:hover:border-amber-600 rounded-xl shadow-sm hover:shadow transition-all text-left active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xl shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                    🧩
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-gray-900 dark:text-gray-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        Armar Fórmula
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/70 px-1.5 py-0.2 rounded">
                        Bloques
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      Descomponer en fichas interactivas
                    </p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAdminOcclusionModal(true)}
                  className="group relative flex items-center gap-3 p-3 sm:p-3.5 bg-white dark:bg-[#000c19] hover:bg-indigo-50/50 dark:hover:bg-[#00142b] border border-indigo-200/80 dark:border-indigo-900/50 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-xl shadow-sm hover:shadow transition-all text-left active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xl shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        Editor de Imagen
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100/70 dark:bg-indigo-950/70 px-1.5 py-0.2 rounded">
                        Oclusión
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      Tapar partes en esquemas y fotos
                    </p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-3">
              <span className="bg-indigo-600 text-white p-2 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </span>
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

              {/* Imagen para el Anverso */}
              <FlashcardImageField
                label="Imagen para el Anverso (Opcional)"
                sublabel="Adjunta un gráfico, diagrama o esquema que acompañará a la pregunta"
                imageUrl={fcFrontImageUrl}
                onChange={setFcFrontImageUrl}
                accent="indigo"
              />

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Reverso / Respuesta (Soporta LaTeX)</label>
                <textarea value={fcBack} onChange={(e) => setFcBack(e.target.value)} placeholder="$F_c = \frac{m \cdot v^2}{r}$" className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4 min-h-[100px] outline-none dark:text-gray-200 whitespace-pre-wrap" />
              </div>

              {/* Imagen para el Reverso */}
              <FlashcardImageField
                label="Imagen para el Reverso (Opcional)"
                sublabel="Adjunta una resolución gráfica, esquema o imagen explicativa para la respuesta"
                imageUrl={fcBackImageUrl}
                onChange={setFcBackImageUrl}
                accent="amber"
              />

              {/* Toggle Habilitar Varias Respuestas (Modo Selección Múltiple) */}
              <div className="p-4 bg-indigo-50/60 dark:bg-slate-800/80 border border-indigo-150 dark:border-indigo-900/40 rounded-xl space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fcHasMultiAnswers}
                    onChange={(e) => setFcHasMultiAnswers(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 dark:border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                      Habilitar varias respuestas (Modo Selección Múltiple)
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-normal">
                      Activa el juego de pulsar todas las respuestas correspondientes a esta pregunta.
                    </span>
                  </div>
                </label>

                {fcHasMultiAnswers && (
                  <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/30 space-y-1.5 animate-fade-in">
                    <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      Respuestas válidas (separadas por comas, punto y coma o saltos de línea):
                    </label>
                    <textarea
                      value={fcMultiAnswersText}
                      onChange={(e) => setFcMultiAnswersText(e.target.value)}
                      placeholder="Ej: +1, +3, +5, +7 (o una opción por línea)"
                      rows={3}
                      className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-3 text-xs outline-none dark:text-gray-200 focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      Consejo: Si dejas el campo vacío, se usará el Reverso como respuesta única.
                    </p>
                  </div>
                )}
              </div>

              {/* Dynamic Preview face recto-verso */}
              <div className="p-4 bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl">
                <h4 className="text-xs font-black text-indigo-500 uppercase mb-2">Vista Previa de Tarjeta</h4>
                <div className="grid grid-cols-2 gap-3 text-xs" ref={fcPreviewRef}>
                  <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg min-h-[80px] flex flex-col justify-between">
                    <div>
                      <span className="font-bold block text-[10px] text-gray-400 uppercase mb-1">Anverso:</span>
                      {fcFrontImageUrl && (
                        <div className="mb-2">
                          <img
                            src={fcFrontImageUrl}
                            alt="Preview Anverso"
                            className="max-h-24 w-auto object-contain rounded-md border border-gray-200 dark:border-slate-700 bg-black/5 dark:bg-white/5"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <div className="whitespace-pre-wrap font-medium">{fcFront || 'Vacío'}</div>
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 border rounded-lg min-h-[80px] flex flex-col justify-between">
                    <div>
                      <span className="font-bold block text-[10px] text-amber-500 uppercase mb-1">Reverso:</span>
                      {fcBackImageUrl && (
                        <div className="mb-2">
                          <img
                            src={fcBackImageUrl}
                            alt="Preview Reverso"
                            className="max-h-24 w-auto object-contain rounded-md border border-gray-200 dark:border-slate-700 bg-black/5 dark:bg-white/5"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <div className="whitespace-pre-wrap font-medium">{fcBack || 'Vacío'}</div>
                    </div>
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
                <span className="bg-indigo-600 text-white p-2 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </span>
                Carga en Masa de Flashcards
              </h2>
              
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div>
                    <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Nombre del Mazo / Tema</label>
                    <input 
                      type="text" 
                      value={fcBulkTopic} 
                      onChange={(e) => setFcBulkTopic(e.target.value)} 
                      placeholder="Ej. Biología Celular" 
                      className="w-full bg-gray-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-3 outline-none dark:text-gray-200 focus:border-indigo-500 font-medium text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Estilo de Formato</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
                    <button 
                      onClick={() => setFcBulkFormat('SEMICOLON')}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${fcBulkFormat === 'SEMICOLON' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                      Punto y Coma o Texto Libre
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
                        ? 'Ejemplos de formatos soportados:\n1) Con punto y coma: ¿Quién es el elemento H?;Hidrógeno\n2) Con signo de interrogación: ¿Quién acuño el término Biología? Lamarck y Treviranus\n3) Con espacio o tabulación: Padre de la zoología Aritóteles\n4) Con guión o dos puntos: Padre de la botánica - Teofrasto'
                        : '[\n  { "front": "¿Qué es la fotosíntesis?", "back": "Proceso químico solar de plantas...", "topic": "Mazo Personalizado" },\n  { "front": "Fórmula del agua", "back": "$H_2O$" }\n]'
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
                        {fc.type === 'FORMULA_BUILDER' && (
                          <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-amber-200/60 dark:border-amber-800/50">
                            🧩 Fórmula
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
                            setFcEditNewToken('');
                            setFcEditNewDistractor('');
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

                    {/* Visual badges for images */}
                    {((fc.frontImageUrl || (fc.type !== 'IMAGE_OCCLUSION' && fc.imageUrl)) || fc.backImageUrl) && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(fc.frontImageUrl || (fc.type !== 'IMAGE_OCCLUSION' && fc.imageUrl)) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                            🖼️ Img Frente
                          </span>
                        )}
                        {fc.backImageUrl && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
                            🖼️ Img Reverso
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mb-2">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">Frente:</span>
                      {(fc.frontImageUrl || (fc.type !== 'IMAGE_OCCLUSION' && fc.imageUrl)) && (
                        <div className="my-1">
                          <img
                            src={fc.frontImageUrl || fc.imageUrl}
                            alt="Frente"
                            className="max-h-20 w-auto object-contain rounded-lg border border-gray-200 dark:border-slate-700 bg-black/5 dark:bg-white/5"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 line-clamp-3 whitespace-pre-wrap">
                        {renderMathAndHtml(fc.front)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">Atrás:</span>
                      {fc.backImageUrl && (
                        <div className="my-1">
                          <img
                            src={fc.backImageUrl}
                            alt="Atrás"
                            className="max-h-20 w-auto object-contain rounded-lg border border-gray-200 dark:border-slate-700 bg-black/5 dark:bg-white/5"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      {fc.type === 'FORMULA_BUILDER' && fc.formulaTokens && fc.formulaTokens.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {fc.formulaTokens.map((tok, tIdx) => (
                            <span
                              key={tIdx}
                              className="inline-flex items-center px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 text-xs font-bold text-amber-800 dark:text-amber-200"
                            >
                              <FormulaTokenRenderer text={tok} size="sm" />
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 whitespace-pre-wrap italic">
                          {renderMathAndHtml(fc.back)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in text-gray-800 dark:text-slate-100">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 max-w-xl w-full shadow-2xl border border-gray-100 dark:border-slate-800 my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </span>
                Editar Flashcard
              </h3>
              <button 
                onClick={() => setFcEditing(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
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
                  <label className="block text-xs font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-1.5">Curso</label>
                  <select 
                    value={fcEditing.course} 
                    onChange={(e) => {
                      setFcEditing({
                        ...fcEditing,
                        course: e.target.value,
                        subject: '' // Reset subject when course changes
                      });
                    }} 
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-gray-900 dark:text-slate-100 focus:border-indigo-500"
                  >
                    <option value="">Selecciona curso...</option>
                    {ACADEMIC_STRUCTURE.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-1.5">Materia</label>
                  <select 
                    value={fcEditing.subject} 
                    onChange={(e) => setFcEditing({ ...fcEditing, subject: e.target.value })} 
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-gray-900 dark:text-slate-100 focus:border-indigo-500"
                  >
                    <option value="">Selecciona materia...</option>
                    {(ACADEMIC_STRUCTURE.find(c => c.name === fcEditing.course)?.subjects || []).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-1.5">Tema / Título (Obligatorio)</label>
                <input 
                  type="text" 
                  value={fcEditing.topic || ''} 
                  onChange={(e) => setFcEditing({ ...fcEditing, topic: e.target.value })} 
                  placeholder="Ej. Segunda ley de Newton" 
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 outline-none text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-indigo-500" 
                  required 
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-1.5">Anverso / Pregunta (Soporta LaTeX)</label>
                <textarea 
                  value={fcEditing.front} 
                  onChange={(e) => setFcEditing({ ...fcEditing, front: e.target.value })} 
                  placeholder="Fórmula de la fuerza centrípeta..." 
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 min-h-[100px] outline-none text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-indigo-500 whitespace-pre-wrap" 
                />
              </div>

              {/* Imagen con Oclusión en Edición */}
              {fcEditing.type === 'IMAGE_OCCLUSION' ? (
                <div className="p-3.5 bg-indigo-50/50 dark:bg-slate-800/70 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
                        🖼️ Imagen con Oclusión Adjunta
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400">
                        Cambia la imagen o ajusta los cuadros ocultos y sus respuestas.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingOcclusionFlashcard({ ...fcEditing })}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Editar imagen y cuadros
                    </button>
                  </div>

                  {fcEditing.imageUrl && (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-black/5 dark:bg-slate-900">
                      <img
                        src={fcEditing.imageUrl}
                        alt="Oclusión"
                        className="w-full max-h-56 object-contain mx-auto"
                        referrerPolicy="no-referrer"
                      />
                      {(fcEditing.occlusionBoxes || []).map((box, bIdx) => {
                        const isTarget = fcEditing.activeBoxId ? box.id === fcEditing.activeBoxId : true;
                        return (
                          <div
                            key={box.id}
                            style={{
                              left: `${box.x}%`,
                              top: `${box.y}%`,
                              width: `${box.width}%`,
                              height: `${box.height}%`
                            }}
                            className={`absolute rounded border-2 flex items-center justify-center text-[10px] font-black pointer-events-none ${
                              isTarget
                                ? 'bg-amber-400/75 border-amber-500 text-slate-950'
                                : 'bg-indigo-500/45 border-indigo-400 text-white'
                            }`}
                          >
                            {box.label || `#${bIdx + 1}`}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <FlashcardImageField
                    label="Cambiar Imagen Base de Oclusión"
                    imageUrl={fcEditing.imageUrl || ''}
                    onChange={(url) => {
                      setFcEditing({
                        ...fcEditing,
                        imageUrl: url || undefined
                      });
                    }}
                    accent="indigo"
                  />

                  {(fcEditing.occlusionBoxes || []).length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-gray-600 dark:text-slate-300 block">
                        Respuestas de los cuadros ({fcEditing.occlusionBoxes?.length}):
                      </span>
                      {fcEditing.occlusionBoxes!.map((box, bIdx) => {
                        const isTarget = fcEditing.activeBoxId === box.id;
                        return (
                          <div key={box.id} className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ${
                              isTarget
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40'
                                : 'bg-gray-200/70 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                            }`}>
                              {box.label || `#${bIdx + 1}`}
                            </span>
                            <input
                              type="text"
                              value={box.correctAnswer}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updatedBoxes = fcEditing.occlusionBoxes!.map(b =>
                                  b.id === box.id ? { ...b, correctAnswer: val } : b
                                );
                                setFcEditing({
                                  ...fcEditing,
                                  occlusionBoxes: updatedBoxes,
                                  back: isTarget ? val : fcEditing.back
                                });
                              }}
                              placeholder="Respuesta correcta del cuadro..."
                              className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs outline-none text-gray-900 dark:text-slate-100 focus:border-indigo-500"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Imagen del Anverso en Edición para flashcards normales / fórmula */
                <FlashcardImageField
                  label="Imagen del Anverso (Opcional)"
                  sublabel="Acompaña a la pregunta de la tarjeta"
                  imageUrl={fcEditing.frontImageUrl || fcEditing.imageUrl || ''}
                  onChange={(url) => {
                    setFcEditing({
                      ...fcEditing,
                      frontImageUrl: url || undefined,
                      imageUrl: url || undefined
                    });
                  }}
                  accent="indigo"
                />
              )}

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-1.5">Reverso / Respuesta (Soporta LaTeX)</label>
                <textarea 
                  value={fcEditing.back} 
                  onChange={(e) => setFcEditing({ ...fcEditing, back: e.target.value })} 
                  placeholder="$F_c = \frac{m \cdot v^2}{r}$" 
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 min-h-[100px] outline-none text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-indigo-500 whitespace-pre-wrap" 
                />
              </div>

              {/* Imagen del Reverso en Edición */}
              <FlashcardImageField
                label="Imagen del Reverso (Opcional)"
                sublabel="Acompaña a la respuesta de la tarjeta"
                imageUrl={fcEditing.backImageUrl || ''}
                onChange={(url) => {
                  setFcEditing({
                    ...fcEditing,
                    backImageUrl: url || undefined
                  });
                }}
                accent="amber"
              />

              {/* Formula Builder blocks editor when editing a FORMULA_BUILDER flashcard */}
              {fcEditing.type === 'FORMULA_BUILDER' && (
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                        🧩 Bloques de la Fórmula ({(fcEditing.formulaTokens || []).length})
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Puedes añadir bloques en LaTeX como <code className="px-1 rounded bg-white/80 dark:bg-slate-800">$x_2$</code> o <code className="px-1 rounded bg-white/80 dark:bg-slate-800">\widehat{'{abc}'}</code> como una sola pieza.
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const nextTokens = decomposeFormula(fcEditing.back || '', 'LATEX_BLOCKS');
                          setFcEditing({ ...fcEditing, formulaTokens: nextTokens });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-colors"
                        title="Cada $...$ queda como un solo bloque intacto"
                      >
                        Auto: Bloques $...$
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextTokens = decomposeFormula(fcEditing.back || '', 'SMART');
                          setFcEditing({ ...fcEditing, formulaTokens: nextTokens });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-colors"
                        title="Descomposición inteligente de la fórmula"
                      >
                        Auto: Inteligente
                      </button>
                    </div>
                  </div>

                  {/* Current Tokens */}
                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-white/80 dark:bg-slate-900/70 rounded-xl border border-amber-200/70 dark:border-amber-800/40 min-h-[48px]">
                    {(fcEditing.formulaTokens || []).length === 0 ? (
                      <span className="text-xs text-gray-400 italic self-center">Sin bloques aún. Añade bloques abajo o usa Auto.</span>
                    ) : (
                      (fcEditing.formulaTokens || []).map((tok, idx, arr) => (
                        <div
                          key={`${tok}-${idx}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100/80 dark:bg-amber-900/40 border border-amber-300/80 dark:border-amber-700/60 text-xs font-bold text-amber-900 dark:text-amber-100"
                        >
                          <FormulaTokenRenderer text={tok} size="sm" />
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...arr];
                                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                setFcEditing({ ...fcEditing, formulaTokens: next, back: next.join(' ') });
                              }}
                              className="text-amber-600 dark:text-amber-300 hover:text-amber-900 px-0.5 text-[10px]"
                              title="Mover a la izquierda"
                            >
                              ←
                            </button>
                          )}
                          {idx < arr.length - 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...arr];
                                [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                setFcEditing({ ...fcEditing, formulaTokens: next, back: next.join(' ') });
                              }}
                              className="text-amber-600 dark:text-amber-300 hover:text-amber-900 px-0.5 text-[10px]"
                              title="Mover a la derecha"
                            >
                              →
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const next = arr.filter((_, i) => i !== idx);
                              setFcEditing({ ...fcEditing, formulaTokens: next, back: next.join(' ') });
                            }}
                            className="text-rose-500 hover:text-rose-700 font-black ml-0.5"
                            title="Quitar bloque"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Custom Block */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={fcEditNewToken}
                      onChange={(e) => setFcEditNewToken(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = fcEditNewToken.trim();
                          if (!val) return;
                          const next = [...(fcEditing.formulaTokens || []), val];
                          setFcEditing({ ...fcEditing, formulaTokens: next, back: next.join(' ') });
                          setFcEditNewToken('');
                        }
                      }}
                      placeholder="Nuevo bloque LaTeX (ej: $x_2$, \widehat{abc}, \frac{a}{b})"
                      className="flex-1 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-lg px-3 py-1.5 text-xs outline-none dark:text-gray-200 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = fcEditNewToken.trim();
                        if (!val) return;
                        const next = [...(fcEditing.formulaTokens || []), val];
                        setFcEditing({ ...fcEditing, formulaTokens: next, back: next.join(' ') });
                        setFcEditNewToken('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      + Añadir Bloque
                    </button>
                  </div>
                  {fcEditNewToken.trim() && (
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 bg-white/70 dark:bg-slate-900/60 px-3 py-1.5 rounded-lg border border-amber-200/50 dark:border-amber-800/40">
                      <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Vista previa:</span>
                      <FormulaTokenRenderer text={fcEditNewToken.trim()} size="sm" />
                    </div>
                  )}

                  {/* Formula Distractors */}
                  <div className="pt-2 border-t border-amber-200/70 dark:border-amber-800/40 space-y-2">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block uppercase">
                      Distractores ({(fcEditing.formulaDistractors || []).length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(fcEditing.formulaDistractors || []).map((dist, idx) => (
                        <span
                          key={`${dist}-${idx}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs font-bold text-rose-700 dark:text-rose-300"
                        >
                          <FormulaTokenRenderer text={dist} size="sm" />
                          <button
                            type="button"
                            onClick={() => {
                              const next = (fcEditing.formulaDistractors || []).filter((_, i) => i !== idx);
                              setFcEditing({ ...fcEditing, formulaDistractors: next });
                            }}
                            className="text-rose-500 hover:text-rose-700 font-black"
                            title="Quitar distractor"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={fcEditNewDistractor}
                        onChange={(e) => setFcEditNewDistractor(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = fcEditNewDistractor.trim();
                            if (!val) return;
                            const next = [...(fcEditing.formulaDistractors || []), val];
                            setFcEditing({ ...fcEditing, formulaDistractors: next });
                            setFcEditNewDistractor('');
                          }
                        }}
                        placeholder="Añadir distractor (ej: $x_1$, $x^2$)"
                        className="flex-1 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-lg px-3 py-1.5 text-xs outline-none dark:text-gray-200 focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = fcEditNewDistractor.trim();
                          if (!val) return;
                          const next = [...(fcEditing.formulaDistractors || []), val];
                          setFcEditing({ ...fcEditing, formulaDistractors: next });
                          setFcEditNewDistractor('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors whitespace-nowrap"
                      >
                        + Distractor
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Multi-answers toggle in Edit modal (for standard flashcards) */}
              {fcEditing.type !== 'FORMULA_BUILDER' && fcEditing.type !== 'IMAGE_OCCLUSION' && (
              <div className="p-3 bg-indigo-50/60 dark:bg-slate-800/80 border border-indigo-200 dark:border-indigo-900/40 rounded-xl space-y-2.5">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fcEditing.hasMultipleAnswers || false}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFcEditing({
                        ...fcEditing,
                        hasMultipleAnswers: checked,
                        multiAnswers: checked
                          ? (fcEditing.multiAnswers && fcEditing.multiAnswers.length > 0
                              ? fcEditing.multiAnswers
                              : fcEditing.back.split(/[,;\n]/).map(s => s.trim()).filter(Boolean))
                          : undefined
                      });
                    }}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 dark:border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                      Habilitar varias respuestas (Modo Selección Múltiple)
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-normal">
                      Permite que esta tarjeta aparezca en el modo de pulsar todas las respuestas válidas.
                    </span>
                  </div>
                </label>

                {fcEditing.hasMultipleAnswers && (
                  <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/30 space-y-1 animate-fade-in">
                    <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      Respuestas válidas (separadas por comas o saltos de línea):
                    </label>
                    <textarea
                      value={(fcEditing.multiAnswers || []).join(', ')}
                      onChange={(e) => {
                        const parsed = e.target.value.split(/[,;\n]/).map(s => s.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
                        setFcEditing({
                          ...fcEditing,
                          multiAnswers: parsed
                        });
                      }}
                      placeholder="Ej: +1, +3, +5, +7"
                      rows={2}
                      className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-lg p-2 text-xs outline-none text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
              )}

              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-1.5">Dificultad</label>
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
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
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
                className="px-5 py-2.5 text-gray-600 dark:text-slate-400 font-medium hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
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

      {/* Image Occlusion Modal */}
      <ImageOcclusionModal
        isOpen={showAdminOcclusionModal || Boolean(editingOcclusionFlashcard)}
        onClose={() => {
          setShowAdminOcclusionModal(false);
          setEditingOcclusionFlashcard(null);
        }}
        initialCourseName={fcCourse || undefined}
        initialSubjectName={fcSubject || undefined}
        academicStructure={ACADEMIC_STRUCTURE}
        editingFlashcard={editingOcclusionFlashcard}
        onSaveFlashcards={(newCards) => {
          onSaveFlashcardsBatch(newCards);
          if (editingOcclusionFlashcard && newCards[0]) {
            setFcEditing(newCards[0]);
            setEditingOcclusionFlashcard(null);
            showToast("¡Imagen y cuadros actualizados con éxito!");
          } else {
            showToast(`¡${newCards.length} tarjetas con imagen creadas con éxito!`);
          }
        }}
        onToast={showToast}
      />

      {/* Formula Builder Modal */}
      <FormulaBuilderModal
        isOpen={showAdminFormulaModal}
        onClose={() => setShowAdminFormulaModal(false)}
        initialCourseName={fcCourse || undefined}
        initialSubjectName={fcSubject || undefined}
        initialTopicName={fcTopic || undefined}
        academicStructure={ACADEMIC_STRUCTURE}
        onSaveFlashcards={(newCards) => {
          onSaveFlashcardsBatch(newCards);
          showToast(`¡${newCards.length} tarjeta(s) de fórmula creadas con éxito!`);
        }}
        onToast={showToast}
      />
    </div>
  );
};

export default AdminView;
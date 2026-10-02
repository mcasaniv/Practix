import React from 'react';
import katex from 'katex';
import { AREA_EXAM_CONFIGS, ACADEMIC_STRUCTURE } from './constants';
import { Question, AppDatabase } from './types';

/**
 * Safely renders a LaTeX math expression to an HTML string using KaTeX.
 */
export function renderLatexToString(mathStr: string, isBlock: boolean = false): string | null {
  if (!mathStr || !mathStr.trim()) return null;

  // Clean and normalize escaped backslashes commonly found in JSON data or input (e.g., \\frac -> \frac)
  let normalized = mathStr.trim();
  normalized = normalized.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  try {
    return katex.renderToString(normalized, {
      displayMode: isBlock,
      throwOnError: false,
      output: 'htmlAndMathml'
    });
  } catch {
    try {
      return katex.renderToString(mathStr.trim(), {
        displayMode: isBlock,
        throwOnError: false,
        output: 'html'
      });
    } catch {
      return null;
    }
  }
}

/**
 * Parses basic HTML tags (<b>, <i>, <u>, <strong>, <em>) and Markdown bold/italic.
 */
function parseBasicFormatting(plainText: string, keyPrefix: string | number): React.ReactNode[] {
  if (!plainText) return [];

  // Split by supported HTML tags: <b>, </b>, <i>, </i>, <u>, </u>, <strong>, </strong>, <em>, </em>
  const tagRegex = /(<\/?(?:b|i|u|strong|em)>)/gi;
  const parts = plainText.split(tagRegex);
  const elements: React.ReactNode[] = [];

  let bold = false;
  let italic = false;
  let underline = false;

  parts.forEach((part, i) => {
    const lower = part.toLowerCase();
    if (lower === '<b>' || lower === '<strong>') {
      bold = true;
    } else if (lower === '</b>' || lower === '</strong>') {
      bold = false;
    } else if (lower === '<i>' || lower === '<em>') {
      italic = true;
    } else if (lower === '</i>' || lower === '</em>') {
      italic = false;
    } else if (lower === '<u>') {
      underline = true;
    } else if (lower === '</u>') {
      underline = false;
    } else if (part) {
      let className = '';
      if (bold) className += ' font-bold';
      if (italic) className += ' italic';
      if (underline) className += ' underline';

      if (className) {
        elements.push(
          <span key={`${keyPrefix}-fmt-${i}`} className={className.trim()}>
            {part}
          </span>
        );
      } else {
        elements.push(<React.Fragment key={`${keyPrefix}-fmt-${i}`}>{part}</React.Fragment>);
      }
    }
  });

  return elements;
}

/**
 * Renders both LaTeX mathematical formulas ($...$, $$...$$, \[...\], \(...\))
 * and text formatting (bold, italic, underline) cleanly without mutating the real DOM.
 */
export function renderMathAndHtml(text: string): React.ReactNode {
  if (!text) return "";

  // Regex to detect LaTeX formula delimiters:
  // 1: $$...$$ (Display)
  // 2: \[...\] (Display)
  // 3: $...$ (Inline)
  // 4: \(...\) (Inline)
  const mathRegex = /(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^\$\n]+?)\$|\\\(([\s\S]+?)\\\))/g;

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIdx = 0;

  while ((match = mathRegex.exec(text)) !== null) {
    const matchIndex = match.index;

    // Text prior to the math formula
    if (matchIndex > lastIndex) {
      const plainText = text.substring(lastIndex, matchIndex);
      result.push(
        <React.Fragment key={`txt-${partIdx++}`}>
          {parseBasicFormatting(plainText, partIdx)}
        </React.Fragment>
      );
    }

    // Determine formula content and display mode
    const displayBlock = match[1] !== undefined ? match[1] : match[2];
    const inlineMath = match[3] !== undefined ? match[3] : match[4];

    if (displayBlock !== undefined) {
      const html = renderLatexToString(displayBlock, true);
      if (html) {
        result.push(
          <span
            key={`math-block-${partIdx++}`}
            className="katex-display-container my-3 block overflow-x-auto text-center py-1 select-text"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else {
        result.push(
          <span key={`raw-block-${partIdx++}`} className="font-mono text-sm text-amber-500 my-1 block text-center">
            {match[0]}
          </span>
        );
      }
    } else if (inlineMath !== undefined) {
      const html = renderLatexToString(inlineMath, false);
      if (html) {
        result.push(
          <span
            key={`math-inline-${partIdx++}`}
            className="katex-inline-container inline-block align-middle px-0.5 select-text"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } else {
        result.push(
          <span key={`raw-inline-${partIdx++}`} className="font-mono text-sm text-amber-500">
            {match[0]}
          </span>
        );
      }
    }

    lastIndex = mathRegex.lastIndex;
  }

  // Trailing text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    result.push(
      <React.Fragment key={`txt-end-${partIdx}`}>
        {parseBasicFormatting(remainingText, partIdx)}
      </React.Fragment>
    );
  }

  return <>{result}</>;
}

export function parseHTMLTags(text: string): React.ReactNode {
  if (!text) return "";
  return renderMathAndHtml(text);
}

export function getQuestionWeek(q: { week?: number; topic?: string }): number | undefined {
  if (typeof q.week === 'number' && !isNaN(q.week) && q.week > 0) {
    return q.week;
  }
  if (q.topic) {
    const match = q.topic.match(/(?:semana|sem|s)\s*0*(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return undefined;
}

export function getQuestionProcess(q: { process?: string }): string {
  if (q && q.process && typeof q.process === 'string' && q.process.trim()) {
    return q.process.trim();
  }
  return 'Ceprunsa I Fase 2027';
}

/**
 * Dynamically retrieves all available processes from the questions database,
 * intelligently sorted from newest year (2027, 2026, 2025, 2017...) down,
 * followed by special exams and custom decks.
 */
export function getAvailableProcesses(questions: { process?: string }[] = []): string[] {
  const set = new Set<string>();
  
  // Base current processes
  set.add('Ceprunsa I Fase 2027');
  set.add('Ceprunsa II Fase 2027');
  set.add('Ceprequintos 2027');
  
  // Add any processes present in questions
  questions.forEach(q => {
    const p = getQuestionProcess(q);
    if (p) set.add(p);
  });

  return Array.from(set).sort((a, b) => {
    // Put "Mazo Propio" at the end
    const aIsCustom = a.toLowerCase().includes('propio') || a.toLowerCase().includes('sin cepre');
    const bIsCustom = b.toLowerCase().includes('propio') || b.toLowerCase().includes('sin cepre');
    if (aIsCustom && !bIsCustom) return 1;
    if (!aIsCustom && bIsCustom) return -1;

    // Extract years if present
    const yearA = a.match(/\b(19\d\d|20\d\d)\b/);
    const yearB = b.match(/\b(19\d\d|20\d\d)\b/);
    if (yearA && yearB) {
      const yA = parseInt(yearA[1], 10);
      const yB = parseInt(yearB[1], 10);
      if (yA !== yB) return yB - yA; // Newest first
    }
    if (yearA && !yearB) return -1;
    if (!yearA && yearB) return 1;

    return a.localeCompare(b);
  });
}

/**
 * Returns a concise, readable short name for display on buttons and badges.
 */
export function getProcessShortName(processName?: string): string {
  if (!processName) return 'General';
  const trimmed = processName.trim();
  
  if (trimmed.toLowerCase().includes('propio') || trimmed.toLowerCase().includes('sin cepre') || trimmed.toLowerCase().includes('personalizado')) {
    return 'Mazo Propio';
  }
  if (trimmed.toLowerCase().includes('ceprequintos') || trimmed.toLowerCase().includes('quintos')) {
    const yearMatch = trimmed.match(/\b\d{4}\b/);
    return yearMatch ? `Quintos ${yearMatch[0]}` : 'Ceprequintos';
  }
  
  // Replace long "Ceprunsa" prefix if year is visible
  let short = trimmed.replace(/^Ceprunsa\s+/i, '');
  return short;
}

export function getProcessBadgeStyle(processName?: string): { bg: string; text: string; border: string; icon: string } {
  const p = processName ? processName.toLowerCase() : '';

  // Custom decks (Sin Cepre)
  if (p.includes('propio') || p.includes('personalizado') || p.includes('sin cepre') || p.includes('libre')) {
    return {
      bg: 'bg-purple-50 dark:bg-purple-950/60',
      text: 'text-purple-700 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
      icon: ''
    };
  }

  // 2026 processes
  if (p.includes('2026')) {
    if (p.includes('ii fase') || p.includes('2 fase') || p.includes('segunda')) {
      return {
        bg: 'bg-teal-50 dark:bg-teal-950/60',
        text: 'text-teal-700 dark:text-teal-300',
        border: 'border-teal-200 dark:border-teal-800',
        icon: ''
      };
    }
    return {
      bg: 'bg-cyan-50 dark:bg-cyan-950/60',
      text: 'text-cyan-700 dark:text-cyan-300',
      border: 'border-cyan-200 dark:border-cyan-800',
      icon: ''
    };
  }

  // 2025 processes
  if (p.includes('2025')) {
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/60',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: ''
    };
  }

  // 2024 processes
  if (p.includes('2024')) {
    return {
      bg: 'bg-sky-50 dark:bg-sky-950/60',
      text: 'text-sky-700 dark:text-sky-300',
      border: 'border-sky-200 dark:border-sky-800',
      icon: ''
    };
  }

  // 2017 or historical processes
  if (p.includes('2017') || p.includes('anterior') || p.includes('historico') || /\b(201\d|202[0-3])\b/.test(p)) {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/60',
      text: 'text-amber-800 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      icon: ''
    };
  }

  // II Fase 2027
  if (p.includes('ii fase') || p.includes('2 fase') || p.includes('segunda')) {
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/60',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: ''
    };
  }

  // Ceprequintos 2027
  if (p.includes('ceprequintos') || p.includes('quintos') || p.includes('5tos')) {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/60',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      icon: ''
    };
  }

  // Default or Ceprunsa I Fase 2027
  return {
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    icon: ''
  };
}

/**
 * Formats question statements:
 * - Renders mathematical formulas ($...$, $$...$$) and HTML tags.
 * - Extracts and removes markdown images (![alt](url)) from inside the text so they
 *   are ALWAYS rendered cleanly below (después de) the statement text.
 */
export function formatQuestionText(text: string): React.ReactNode {
  if (!text) return "";

  // 1. Extract all markdown images: ![alt](url)
  const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
  const extractedImages: { alt: string; url: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(text)) !== null) {
    if (match[2] && match[2].trim()) {
      extractedImages.push({
        alt: match[1] || 'Ilustración del enunciado',
        url: match[2].trim()
      });
    }
  }

  // 2. Remove markdown image tags from the text so text flows cleanly without embedded images
  const textWithoutImages = text.replace(imgRegex, '').trim();

  const renderedContent = renderMathAndHtml(textWithoutImages || text);

  // If no images were inside the text, just return the formatted text
  if (extractedImages.length === 0) {
    return renderedContent;
  }

  // If there are images, render text first and images ALWAYS below (después) del enunciado
  return (
    <div className="space-y-3">
      <div className="leading-relaxed">
        {renderedContent}
      </div>
      <div className="flex flex-col items-center gap-3 pt-2">
        {extractedImages.map((img, i) => (
          <img
            key={`md-img-${i}`}
            src={img.url}
            alt={img.alt}
            className="my-2 max-w-full h-auto rounded-2xl shadow-md border border-gray-200 dark:border-slate-800 max-h-[350px] object-contain mx-auto block bg-white dark:bg-slate-950/60 p-1"
            referrerPolicy="no-referrer"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Returns the effective academic subject for a question.
 * If the question is an official exam (course === 'Exámenes' or subject === 'Simulacros Oficiales'),
 * it returns targetSubject if present, otherwise returns subject.
 */
export function getEffectiveQuestionSubject(q: Question): string {
  if (q.targetSubject && q.targetSubject.trim()) {
    return q.targetSubject.trim();
  }
  return q.subject;
}

/**
 * Returns the official score weight for a given academic subject and admission area.
 */
export function getOfficialSubjectWeight(
  subject: string,
  area: 'Biomédicas' | 'Ingenierías' | 'Sociales' = 'Biomédicas'
): number {
  const config = AREA_EXAM_CONFIGS[area] || AREA_EXAM_CONFIGS['Biomédicas'];
  for (const [catName, cat] of Object.entries(config)) {
    if (cat.subjects.includes(subject) || catName === subject) {
      return cat.weight;
    }
  }
  return 1.25;
}

export const ALL_ACADEMIC_SUBJECTS: string[] = [
  'Aritmética',
  'Álgebra',
  'Geometría',
  'Trigonometría',
  'Física',
  'Química',
  'Biología',
  'Lenguaje',
  'Literatura',
  'Historia del Perú',
  'Historia Universal',
  'Geografía',
  'Economía',
  'Cívica',
  'Psicología',
  'Filosofía',
  'Razonamiento Matemático',
  'Razonamiento Verbal',
  'Raz. Lógico',
  'Comprensión Lectora',
  'Inglés',
  'Inglés Lectura'
];

/**
 * Normalizes any question object regardless of key order, property aliases
 * (Spanish/English), or missing optional fields.
 */
export function normalizeQuestionObject(item: any): Question | null {
  if (!item || typeof item !== 'object') return null;

  const questionText = (
    item.questionText ??
    item.pregunta ??
    item.enunciado ??
    item.q ??
    item.texto ??
    ''
  ).toString().trim();

  // Resolve options
  let rawOptions = item.options ?? item.opciones ?? item.alternativas ?? item.respuestas;
  let options: string[] = [];
  if (Array.isArray(rawOptions)) {
    options = rawOptions.map(o => (o !== null && o !== undefined ? o.toString().trim() : ''));
  } else if (item.A !== undefined || item.a !== undefined) {
    options = [
      (item.A ?? item.a ?? '').toString().trim(),
      (item.B ?? item.b ?? '').toString().trim(),
      (item.C ?? item.c ?? '').toString().trim(),
      (item.D ?? item.d ?? '').toString().trim(),
      (item.E ?? item.e ?? '').toString().trim()
    ].filter(Boolean);
  }

  if (!questionText || options.length < 2) return null;

  // Resolve correctIndex
  let correctIndex = 0;
  const rawCorrect = item.correctIndex ?? item.clave ?? item.respuesta ?? item.correcta ?? item.rpta;
  if (typeof rawCorrect === 'number') {
    correctIndex = rawCorrect;
  } else if (typeof rawCorrect === 'string') {
    const trimmed = rawCorrect.trim().toUpperCase();
    if (['A', 'B', 'C', 'D', 'E'].includes(trimmed)) {
      correctIndex = trimmed.charCodeAt(0) - 65;
    } else if (!isNaN(parseInt(trimmed, 10))) {
      const num = parseInt(trimmed, 10);
      correctIndex = num >= 1 && num <= 5 ? num - 1 : num;
    }
  }

  // Resolve subject & course
  let subject = (item.subject ?? item.materia ?? '').toString().trim();
  let course = (item.course ?? item.curso ?? '').toString().trim();

  // If subject is known in ACADEMIC_STRUCTURE, infer course if missing
  if (!course && subject) {
    const found = ACADEMIC_STRUCTURE.find(c => c.subjects.some(s => s.toLowerCase() === subject.toLowerCase()));
    if (found) {
      course = found.name;
      const normSubj = found.subjects.find(s => s.toLowerCase() === subject.toLowerCase());
      if (normSubj) subject = normSubj;
    }
  }

  // Fallbacks
  if (!course) course = 'Ciencias';
  if (!subject) subject = 'General';

  const topic = (item.topic ?? item.tema ?? 'General').toString().trim();
  const explanation = (
    item.explanation ??
    item.explicacion ??
    item.solucion ??
    item.solucionario ??
    item.resolucion ??
    ''
  ).toString().trim();

  const process = (
    item.process ??
    item.proceso ??
    item.fase ??
    item.cepre ??
    'Ceprunsa I Fase 2027'
  ).toString().trim();

  let week: number | undefined = undefined;
  const rawWeek = item.week ?? item.semana;
  if (rawWeek !== undefined && rawWeek !== null && rawWeek !== '') {
    const parsedWeek = Number(rawWeek);
    if (!isNaN(parsedWeek)) week = parsedWeek;
  }

  return {
    id: item.id && typeof item.id === 'string' && item.id.trim() ? item.id.trim() : crypto.randomUUID(),
    course,
    subject,
    topic,
    questionText,
    options,
    correctIndex: Math.max(0, Math.min(correctIndex, options.length - 1)),
    explanation,
    process,
    week,
    order: typeof item.order === 'number' ? item.order : 999,
    createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    imageUrl: item.imageUrl || item.imagen || undefined,
    readingTextId: item.readingTextId || undefined,
    optionsImageUrls: item.optionsImageUrls || undefined,
    explanationImageUrl: item.explanationImageUrl || undefined,
    targetSubject: item.targetSubject || undefined,
    area: item.area || undefined,
    weight: item.weight ? Number(item.weight) : undefined
  };
}

export interface ImportResult {
  database: AppDatabase;
  importedCount: number;
  mode: 'REPLACE_ALL' | 'MERGED_QUESTIONS';
}

/**
 * Universal JSON parser that handles:
 * - Questions with properties in ANY order
 * - Raw arrays: [ {...}, {...} ]
 * - Full database backup objects: { questions: [...], results: {...} }
 * - Question collections: { questions: [...] } or { preguntas: [...] }
 * - Un-bracketed object lists: { ... }, { ... }
 * - JSON Lines (one JSON per line)
 */
export function parseAndNormalizeImport(
  jsonStrOrObj: any,
  currentDb: AppDatabase
): ImportResult {
  let parsed: any = jsonStrOrObj;

  if (typeof jsonStrOrObj === 'string') {
    let text = jsonStrOrObj.trim();
    if (!text) {
      throw new Error("El contenido del archivo JSON está vacío.");
    }

    try {
      parsed = JSON.parse(text);
    } catch (e1) {
      // 1. Try wrapping un-bracketed list with [ ... ]
      if ((text.startsWith('{') && text.endsWith('}')) || text.includes('},\n{') || text.includes('},\r\n{') || text.includes('},{')) {
        try {
          parsed = JSON.parse(`[${text.replace(/,\s*$/, '')}]`);
        } catch {
          // Continue to JSON Lines fallback
        }
      }

      // 2. Try JSON Lines (one object per line)
      if (!parsed) {
        const lineObjects: any[] = [];
        const lines = text.split('\n');
        for (const line of lines) {
          const l = line.trim();
          if (!l) continue;
          try {
            const obj = JSON.parse(l.replace(/,\s*$/, ''));
            if (obj && typeof obj === 'object') lineObjects.push(obj);
          } catch {
            // ignore non-json line
          }
        }
        if (lineObjects.length > 0) {
          parsed = lineObjects;
        } else {
          throw new Error("Formato de JSON inválido. Verifica que sea un JSON válido o una lista de preguntas entre [ ... ].");
        }
      }
    }
  }

  // Case 1: Raw array of questions [ { ... }, { ... } ]
  if (Array.isArray(parsed)) {
    const validQuestions = parsed.map(normalizeQuestionObject).filter(Boolean) as Question[];
    if (validQuestions.length === 0) {
      throw new Error("No se encontraron preguntas válidas en el archivo JSON.");
    }

    // Merge into current database (avoid duplicate ids or update existing)
    const existingMap = new Map((currentDb.questions || []).map(q => [q.id, q]));
    validQuestions.forEach(q => existingMap.set(q.id, q));

    return {
      database: {
        ...currentDb,
        questions: Array.from(existingMap.values())
      },
      importedCount: validQuestions.length,
      mode: 'MERGED_QUESTIONS'
    };
  }

  // Case 2: Object containing an array under questions, preguntas, data, items
  if (parsed && typeof parsed === 'object') {
    const rawList = parsed.questions || parsed.preguntas || parsed.data || parsed.items;
    if (Array.isArray(rawList)) {
      const validQuestions = rawList.map(normalizeQuestionObject).filter(Boolean) as Question[];
      
      // If it's a full backup object (has results, flashcards, or readingTexts)
      if (parsed.results !== undefined || parsed.flashcards !== undefined || parsed.readingTexts !== undefined) {
        return {
          database: {
            ...currentDb,
            ...parsed,
            questions: validQuestions
          },
          importedCount: validQuestions.length,
          mode: 'REPLACE_ALL'
        };
      } else {
        // It's a question pack object: merge with current database
        const existingMap = new Map((currentDb.questions || []).map(q => [q.id, q]));
        validQuestions.forEach(q => existingMap.set(q.id, q));
        return {
          database: {
            ...currentDb,
            questions: Array.from(existingMap.values())
          },
          importedCount: validQuestions.length,
          mode: 'MERGED_QUESTIONS'
        };
      }
    }

    // Case 3: A single question object: { "course": ..., "questionText": ... }
    const singleQ = normalizeQuestionObject(parsed);
    if (singleQ) {
      const existingMap = new Map((currentDb.questions || []).map(q => [q.id, q]));
      existingMap.set(singleQ.id, singleQ);
      return {
        database: {
          ...currentDb,
          questions: Array.from(existingMap.values())
        },
        importedCount: 1,
        mode: 'MERGED_QUESTIONS'
      };
    }
  }

  throw new Error("Formato de JSON no reconocido como banco de preguntas ni copia de seguridad.");
}

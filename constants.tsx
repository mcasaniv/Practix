
import React from 'react';
import { CourseStructure } from './types';

export const ACADEMIC_STRUCTURE: CourseStructure[] = [
  {
    name: 'Comunicación',
    subjects: ['Lenguaje', 'Literatura', 'Comprensión Lectora'],
    icon: 'https://i.pinimg.com/736x/84/9c/c5/849cc5a52cf9d59bc41debd9003770a6.jpg',
    color: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  {
    name: 'Matemática',
    subjects: ['Aritmética', 'Álgebra', 'Geometría', 'Trigonometría'],
    icon: 'https://i.pinimg.com/1200x/23/6a/bb/236abb28cbdc8c4d6f59f597e9aa5b04.jpg',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200'
  },
  {
    name: 'Ciencias',
    subjects: ['Física', 'Química', 'Biología', 'Ecología'],
    icon: 'https://i.pinimg.com/736x/38/ff/ce/38ffce57704b4a2122fc782795ce319d.jpg',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  },
  {
    name: 'Sociales',
    subjects: ['Historia del Perú', 'Historia Universal', 'Geografía', 'Economía'],
    icon: 'https://i.pinimg.com/736x/42/24/72/4224727d94c3c9b4c076b88ea2e3d153.jpg',
    color: 'bg-amber-100 text-amber-700 border-amber-200'
  },
  {
    name: 'DPCC',
    subjects: ['Cívica', 'Psicología', 'Filosofía'],
    icon: 'https://i.pinimg.com/736x/f0/fc/2d/f0fc2d52f460c63189f1cb2f3e9c51db.jpg',
    color: 'bg-rose-100 text-rose-700 border-rose-200'
  },
  {
    name: 'Razonamiento',
    subjects: ['Razonamiento Matemático', 'Razonamiento Verbal', 'Raz. Lógico'],
    icon: 'https://i.pinimg.com/736x/93/bc/75/93bc75ffd6e50150860b176ad1469faf.jpg',
    color: 'bg-purple-100 text-purple-700 border-purple-200'
  },
  {
    name: 'Idioma',
    subjects: ['Inglés', 'Francés', 'Inglés Lectura'],
    icon: 'https://i.pinimg.com/736x/4d/9b/a5/4d9ba51ddd6e842980652b102e7d475c.jpg',
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200'
  },
  {
    name: 'Exámenes',
    subjects: ['Simulacros Oficiales', 'Exámenes Simulacros', 'Exámenes Extraordinarios'],
    icon: 'https://i.pinimg.com/webp/736x/9a/2c/c7/9a2cc7f75ac4443d5d51303bdfbb1b1c.webp',
    color: 'bg-slate-100 text-slate-700 border-slate-200'
  }
];

export interface ExamCategory {
  subjects: string[];
  count: number;
  weight: number;
}

export const BIOMEDICAS_EXAM_CONFIG: Record<string, ExamCategory> = {
  'Raz. Lógico': { subjects: ['Raz. Lógico'], count: 4, weight: 1.12415 },
  'Raz. Matemático': { subjects: ['Razonamiento Matemático'], count: 5, weight: 1.10068 },
  'Raz. Verbal': { subjects: ['Razonamiento Verbal'], count: 4, weight: 1.12415 },
  'Comprensión Lectora': { subjects: ['Comprensión Lectora'], count: 5, weight: 1.10068 },
  'Álgebra': { subjects: ['Álgebra'], count: 3, weight: 1.2654474 },
  'Geometría': { subjects: ['Geometría'], count: 3, weight: 1.2654474 },
  'Trigonometría': { subjects: ['Trigonometría'], count: 3, weight: 1.2036578 },
  'Aritmética': { subjects: ['Aritmética'], count: 3, weight: 1.2654474 },
  'Historia': { subjects: ['Historia del Perú', 'Historia Universal'], count: 5, weight: 1.12354 },
  'Geografía': { subjects: ['Geografía'], count: 4, weight: 1.095575 },
  'Química': { subjects: ['Química'], count: 6, weight: 1.68474 },
  'Biología': { subjects: ['Biología'], count: 9, weight: 1.94514 },
  'Física': { subjects: ['Física'], count: 5, weight: 1.47706 },
  'Filosofía': { subjects: ['Filosofía'], count: 3, weight: 0.79874 },
  'Psicología': { subjects: ['Psicología'], count: 4, weight: 0.80189 },
  'Cívica': { subjects: ['Cívica'], count: 3, weight: 0.79874 },
  'Lenguaje': { subjects: ['Lenguaje'], count: 4, weight: 1.021414 },
  'Literatura': { subjects: ['Literatura'], count: 3, weight: 0.971448 },
  'Inglés Lectura': { subjects: ['Inglés Lectura'], count: 2, weight: 1.2587 },
  'Inglés Gramática': { subjects: ['Inglés'], count: 2, weight: 1.2413 }
};

export const INGENIERIAS_EXAM_CONFIG: Record<string, ExamCategory> = {
  'Raz. Lógico': { subjects: ['Raz. Lógico'], count: 4, weight: 1.12415 },
  'Raz. Matemático': { subjects: ['Razonamiento Matemático'], count: 5, weight: 1.10068 },
  'Raz. Verbal': { subjects: ['Razonamiento Verbal'], count: 4, weight: 1.12415 },
  'Comprensión Lectora': { subjects: ['Comprensión Lectora'], count: 5, weight: 1.10068 },
  'Álgebra': { subjects: ['Álgebra'], count: 4, weight: 1.6583374 },
  'Geometría': { subjects: ['Geometría'], count: 4, weight: 1.65833745 },
  'Trigonometría': { subjects: ['Trigonometría'], count: 3, weight: 1.699477 },
  'Aritmética': { subjects: ['Aritmética'], count: 4, weight: 1.6583374 },
  'Historia': { subjects: ['Historia del Perú', 'Historia Universal'], count: 4, weight: 1.289859 },
  'Geografía': { subjects: ['Geografía'], count: 4, weight: 1.210141 },
  'Química': { subjects: ['Química'], count: 6, weight: 1.425411425 },
  'Biología': { subjects: ['Biología'], count: 5, weight: 1.1547487 },
  'Física': { subjects: ['Física'], count: 7, weight: 1.52482685 },
  'Filosofía': { subjects: ['Filosofía'], count: 3, weight: 0.79874 },
  'Psicología': { subjects: ['Psicología'], count: 4, weight: 0.80189 },
  'Cívica': { subjects: ['Cívica'], count: 3, weight: 0.79874 },
  'Lenguaje': { subjects: ['Lenguaje'], count: 4, weight: 1.021414 },
  'Literatura': { subjects: ['Literatura'], count: 3, weight: 0.971448 },
  'Inglés Lectura': { subjects: ['Inglés Lectura'], count: 2, weight: 1.2587 },
  'Inglés Gramática': { subjects: ['Inglés'], count: 2, weight: 1.2413 }
};

export const SOCIALES_EXAM_CONFIG: Record<string, ExamCategory> = {
  'Raz. Lógico': { subjects: ['Raz. Lógico'], count: 4, weight: 1.12415 },
  'Raz. Matemático': { subjects: ['Razonamiento Matemático'], count: 5, weight: 1.10068 },
  'Raz. Verbal': { subjects: ['Razonamiento Verbal'], count: 4, weight: 1.12415 },
  'Comprensión Lectora': { subjects: ['Comprensión Lectora'], count: 5, weight: 1.10068 },
  'Álgebra': { subjects: ['Álgebra'], count: 3, weight: 0.824574 },
  'Geometría': { subjects: ['Geometría'], count: 3, weight: 0.825011534 },
  'Trigonometría': { subjects: ['Trigonometría'], count: 3, weight: 0.8596135 },
  'Aritmética': { subjects: ['Aritmética'], count: 3, weight: 0.8241343 },
  'Historia': { subjects: ['Historia del Perú', 'Historia Universal'], count: 8, weight: 1.77474 },
  'Geografía': { subjects: ['Geografía'], count: 5, weight: 1.760416 },
  'Química': { subjects: ['Química'], count: 3, weight: 1.109300781 },
  'Biología': { subjects: ['Biología'], count: 3, weight: 1.146903363 },
  'Física': { subjects: ['Física'], count: 3, weight: 1.077129189 },
  'Filosofía': { subjects: ['Filosofía'], count: 3, weight: 0.887877 },
  'Psicología': { subjects: ['Psicología'], count: 5, weight: 0.9345476 },
  'Cívica': { subjects: ['Cívica'], count: 3, weight: 0.887877 },
  'Lenguaje': { subjects: ['Lenguaje'], count: 8, weight: 1.701541 },
  'Literatura': { subjects: ['Literatura'], count: 5, weight: 1.6775344 },
  'Inglés Lectura': { subjects: ['Inglés Lectura'], count: 2, weight: 1.2587 },
  'Inglés Gramática': { subjects: ['Inglés'], count: 2, weight: 1.2413 }
};

export const AREA_EXAM_CONFIGS: Record<string, Record<string, ExamCategory>> = {
  'Biomédicas': BIOMEDICAS_EXAM_CONFIG,
  'Ingenierías': INGENIERIAS_EXAM_CONFIG,
  'Sociales': SOCIALES_EXAM_CONFIG
};

export const MEGA_EXAM_CONFIG: Record<string, ExamCategory> = BIOMEDICAS_EXAM_CONFIG;

export const DB_STORAGE_KEY = 'educasani_cloud_db';

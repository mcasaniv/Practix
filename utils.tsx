import React from 'react';

export function parseHTMLTags(text: string): React.ReactNode {
  if (!text) return "";
  
  const regex = /(<\/?[biu]>)/gi;
  const parts = text.split(regex);
  
  const result: React.ReactNode[] = [];
  const activeStyles = {
    bold: false,
    italic: false,
    underline: false
  };
  
  parts.forEach((part, index) => {
    const lower = part.toLowerCase();
    if (lower === '<b>') {
      activeStyles.bold = true;
    } else if (lower === '</b>') {
      activeStyles.bold = false;
    } else if (lower === '<i>') {
      activeStyles.italic = true;
    } else if (lower === '</i>') {
      activeStyles.italic = false;
    } else if (lower === '<u>') {
      activeStyles.underline = true;
    } else if (lower === '</u>') {
      activeStyles.underline = false;
    } else if (part) {
      let className = '';
      if (activeStyles.bold) className += ' font-bold';
      if (activeStyles.italic) className += ' italic';
      if (activeStyles.underline) className += ' underline';
      
      if (className) {
        result.push(
          <span key={index} className={className.trim()}>
            {part}
          </span>
        );
      } else {
        result.push(<React.Fragment key={index}>{part}</React.Fragment>);
      }
    }
  });
  
  return <>{result}</>;
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

export function getProcessBadgeStyle(processName?: string): { bg: string; text: string; border: string; icon: string } {
  const p = processName ? processName.toLowerCase() : '';
  if (p.includes('ii fase') || p.includes('2 fase') || p.includes('segunda')) {
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/60',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: '📗'
    };
  }
  if (p.includes('ceprequintos') || p.includes('quintos') || p.includes('5tos')) {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/60',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      icon: '📙'
    };
  }
  // Default or Ceprunsa I Fase
  return {
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    icon: '📘'
  };
}


export function formatQuestionText(text: string): React.ReactNode {
  if (!text) return "";
  
  const imgRegex = /!\[.*?\]\((.*?)\)/g;
  const parts = text.split(imgRegex);
  
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 !== 0) {
          return (
            <img 
              key={i} 
              src={part} 
              alt="Markdown Img" 
              className="my-4 max-w-full h-auto rounded-xl shadow-sm border dark:border-slate-800 mx-auto block" 
              referrerPolicy="no-referrer"
            />
          );
        }
        return <span key={i}>{parseHTMLTags(part)}</span>;
      })}
    </>
  );
}

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

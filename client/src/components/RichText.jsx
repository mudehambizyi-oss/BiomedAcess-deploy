import React from 'react';

export default function RichText({ text = '', compact = false }) {
  const lines = String(text).split('\n');
  return <div>{lines.map((line, i) => {
    const match = line.trim().match(/^\[img\](https?:\/\/\S+)$/i);
    if (match) return <img key={i} src={match[1]} alt="" loading="lazy" style={{display:'block',maxWidth:'100%',maxHeight:compact?180:480,objectFit:'contain',margin:'12px 0',borderRadius:8}} />;
    return <React.Fragment key={i}>{line}{i < lines.length - 1 && <br />}</React.Fragment>;
  })}</div>;
}

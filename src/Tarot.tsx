import { expertise } from './data';
function CardArt({ index }: {
    index: number;
}) {
    const id = `tarot-lines-${index}`;
    return <svg viewBox="0 0 280 430" fill="none" aria-hidden="true">
  <defs><pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><path d="M0 0V18" stroke="currentColor" strokeWidth="1"/></pattern></defs>
  <rect x="3" y="3" width="274" height="424" rx="17" stroke="currentColor" strokeWidth="3"/>
  <rect x="15" y="15" width="250" height="400" rx="7" stroke="currentColor"/>
  <rect x="27" y="27" width="226" height="376" rx="2" stroke="currentColor"/>
  {[0, 1].map(side => <g key={side} transform={side ? 'translate(280 430) rotate(180)' : ''}>
   <path d="M28 94Q76 94 76 28M28 76Q58 76 58 28M28 56Q41 56 41 28M28 110L110 28M28 119L119 28M28 137L137 28M28 28L253 403M253 28L28 403" stroke="currentColor"/>
   <path d="M140 27v55m0 12v36m-85-40 145 250M80 45l130 225" stroke="currentColor"/>
   {[40, 55, 70, 95, 120].map(y => <circle key={y} cx="140" cy={y} r={y === 55 ? 9 : y === 70 ? 4 : 2.5} stroke="currentColor" fill="#2026f6"/>)}
   <path d="M181 28a25 25 0 0 0 44 0a22 22 0 0 1-44 0" fill="currentColor"/>
  </g>)}
  <path d="M140 95 245 215 140 335 35 215Z" fill={`url(#${id})`} stroke="currentColor" strokeWidth="3"/>
  <path d="M140 116 225 215 140 314 55 215Z" stroke="currentColor"/>
  <path d="M140 132 209 215 140 298 71 215Z" stroke="currentColor"/>
  <circle cx="140" cy="215" r="52" fill="#2026f6" stroke="currentColor" strokeWidth="2"/>
  <circle cx="140" cy="215" r="43" stroke="currentColor"/>
  {Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return <circle key={i} cx={140 + Math.cos(a) * 59} cy={215 + Math.sin(a) * 59} r="2" fill="currentColor"/>; })}
  <text x="140" y="234" fill="currentColor" textAnchor="middle" fontSize="55" fontWeight="600" fontFamily="Arial">{['S', 'C', 'T', 'P'][index]}</text>
 </svg>;
}
export default function Tarot() {
    return <section className="tarot-section"><div className="tarot-sticky"><h2>ОБЛАСТИ<br />ЭКСПЕРТИЗЫ</h2><div className="tarot-fan">{expertise.map((item, index) => <button key={item.title} className={`tarot-card tarot-card-${index}`} aria-label={`${item.title}: ${item.items.join(', ')}`}><div className="tarot-rotation"><div className="tarot-front"><CardArt index={index}/></div><div className="tarot-back"><small>0{index + 1} / ЭКСПЕРТИЗА</small><h3>{item.title}</h3><ul>{item.items.map(text => <li key={text}>{text}</li>)}</ul><b>{item.letter}</b></div></div></button>)}</div><div className="tarot-note"><span>СОЕДИНЯЕМ РАЗНЫЕ ДИСЦИПЛИНЫ</span><span>НАВЕДИТЕ ИЛИ КОСНИТЕСЬ КАРТЫ ↗</span></div></div></section>;
}

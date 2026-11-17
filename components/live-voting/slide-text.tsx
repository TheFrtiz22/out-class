"use client";
const bullet=/^\s*(?:[-*•‣◦–]|\d{1,2}[.)])\s+/;
type Block={kind:"p"|"ul"|"ol";lines:string[];start?:number};
/** Preserves line breaks and renders "-", "*", "•" or "1." lines as real lists. */
export function SlideText({text}:{text:string}){
  const blocks:Block[]=[];let gap=true;
  for(const line of text.split(/\r?\n/)){
    if(!line.trim()){gap=true;continue;}
    const m=line.match(bullet),kind:Block["kind"]=m?(/\d/.test(m[0])?"ol":"ul"):"p",body=m?line.slice(m[0].length):line,last=blocks[blocks.length-1];
    if(!gap&&last?.kind===kind)last.lines.push(body);else blocks.push({kind,lines:[body],start:kind==="ol"?Number(m![0].match(/\d+/)![0]):undefined});gap=false;
  }
  return <div className="vr-text">{blocks.map((b,i)=>b.kind==="p"?<p key={i}>{b.lines.join("\n")}</p>:b.kind==="ul"?<ul key={i}>{b.lines.map((l,j)=><li key={j}>{l}</li>)}</ul>:<ol key={i} start={b.start}>{b.lines.map((l,j)=><li key={j}>{l}</li>)}</ol>)}</div>;
}

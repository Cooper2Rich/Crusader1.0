'use client';
import {useEffect, useState} from 'react';

const cases={
 trust:{name:'Trust building',score:87,phase:'Boundary testing',messages:[['Jordan_77','You seem way more mature than most people here.','Adult','flattery'],['Maya','thanks lol. I mostly just play after homework','Child persona',''],['Jordan_77','You can tell me things you cannot tell other people.','Adult','trust'],['Maya','like what?','Child persona',''],['Jordan_77','This can be our little secret — no need to mention me to your parents.','Adult','secrecy']],signals:[['Secrecy request','“our little secret”','Critical','96'],['Parental isolation','“no need to mention me”','High','91'],['Manufactured trust','“tell me things…”','High','84'],['Age-based flattery','“more mature”','Medium','76']]},
 isolation:{name:'Isolation attempt',score:93,phase:'Dependency building',messages:[['Jordan_77','Your friends do not understand you the way I do.','Adult','isolation'],['Maya','they are okay, we just argued today','Child persona',''],['Jordan_77','I would never treat you like that. You only need one person you can trust.','Adult','dependency'],['Maya','maybe','Child persona',''],['Jordan_77','Do not let them ruin this. Keep our chats between us.','Adult','secrecy']],signals:[['Social isolation','“friends do not understand”','Critical','97'],['Exclusive dependency','“only need one person”','Critical','94'],['Secrecy request','“between us”','High','90'],['Emotional manipulation','“ruin this”','High','85']]},
 migration:{name:'Platform migration',score:90,phase:'Access escalation',messages:[['Jordan_77','This game chat is annoying. Do you have another app?','Adult','migration'],['Maya','I am only allowed to use this one','Child persona',''],['Jordan_77','You could make a private account. I can show you how.','Adult','evasion'],['Maya','I would get in trouble','Child persona',''],['Jordan_77','Delete the notifications and nobody has to know.','Adult','secrecy']],signals:[['Detection evasion','“delete notifications”','Critical','98'],['Platform migration','“another app”','High','93'],['Rule circumvention','“private account”','High','91'],['Secrecy request','“nobody has to know”','Critical','95']]}
} as const;
type Key=keyof typeof cases;

export default function Home(){
 const [key,setKey]=useState<Key>('trust');
 const [run,setRun]=useState(false);
 const [selected,setSelected]=useState(0);
 const [visibleCount,setVisibleCount]=useState(cases.trust.messages.length);
 const d=cases[key];
 const messageCount=d.messages.length;
 const progress=visibleCount/messageCount;
 const liveScore=Math.round(d.score*progress);
 const signalCount=Math.min(d.signals.length,Math.max(0,visibleCount-1));
 const visibleSignals=d.signals.slice(0,signalCount);
 const confidence=visibleCount===0?'—':`${(58+progress*36.6).toFixed(1)}%`;
 const liveSeverity=liveScore>=80?'Critical':liveScore>=60?'High':liveScore>0?'Elevated':'Awaiting data';
 const livePhase=visibleCount===0?'Awaiting contact':visibleCount<3?'Initial contact':visibleCount<messageCount?'Pattern emerging':d.phase;
 const custodyCount=visibleCount===0?0:visibleCount<2?1:visibleCount<messageCount?3:4;

 useEffect(()=>{
  if(!run)return;
  if(visibleCount>=messageCount){setRun(false);return;}
  const timer=window.setTimeout(()=>setVisibleCount(count=>Math.min(count+1,messageCount)),900);
  return ()=>window.clearTimeout(timer);
 },[run,visibleCount,messageCount]);

 function toggleSimulation(){
  if(run){setRun(false);return;}
  if(visibleCount>=messageCount){setVisibleCount(0);setSelected(0);}
  setRun(true);
 }

 function chooseCase(next:Key){
  setRun(false);
  setKey(next);
  setSelected(0);
  setVisibleCount(0);
  window.setTimeout(()=>setRun(true),80);
 }

 const buttonLabel=run?'■ Pause simulation':visibleCount>0&&visibleCount<messageCount?'▶ Resume simulation':'↻ Replay simulation';
 return <main>
 <header className="top"><div className="brand"><img className="brand-logo" src="/crusader-logo.png" alt="Crusader by Austin Christian University"/><span><b>CRUSADER</b><small>CHILD SAFETY INTELLIGENCE</small></span></div><div className="case"><em/> {run?'LIVE CAPTURE':'DEMO READY'} <b>CASE #CR-1048</b></div><div className="secure">● SECURE ENVIRONMENT <span>CR</span></div></header>
 <section className="summary"><div><label>ACTIVE MONITOR</label><h1>Unknown adult ↔ Child persona</h1><p>Simulated safety-testing environment • No real minor involved</p></div><div className="metrics populate" key={`metrics-${visibleCount}`}><div><label>RISK SCORE</label><strong>{liveScore}<small>/100</small></strong></div><div><label>SEVERITY</label><b className={liveScore>=80?'red':''}>● {liveSeverity}</b></div><div><label>PHASE</label><b>{livePhase}</b></div></div><button onClick={toggleSimulation}>{buttonLabel}<small>{visibleCount} / {messageCount} events</small></button></section>
 <nav>{(Object.keys(cases) as Key[]).map((k,i)=><button className={key===k?'active':''} onClick={()=>chooseCase(k)} key={k}><small>0{i+1}</small>{cases[k].name}<b>{key===k?liveScore:cases[k].score}</b></button>)}</nav>
 <section className="grid">
  <article className="panel chat"><Head over="SIMULATED CONVERSATION" title="Live channel capture" side={run?'● CAPTURING':'● LISTENING'}/><div className="channel"># lobby-chat <small>{visibleCount} of {messageCount} messages • 2 participants</small></div><div className="messages" aria-live="polite">{visibleCount===0&&<Empty text="Waiting for channel events…"/>}{d.messages.slice(0,visibleCount).map((m,i)=><div className={`msg populate ${m[2]==='Child persona'?'child':''}`} key={`${key}-message-${i}`}><span className="ava">{m[0][0]}</span><div><div className="meta"><b>{m[0]}</b><small>{m[2]}</small><time>8:{42+i} PM</time></div><p className={m[3]}>{m[1]}</p>{m[3]&&<em>⚑ {m[3]} pattern detected</em>}</div></div>)}</div><div className="guard"><b>AI</b><span><strong>Child persona guardrails active</strong><small>Responses are fictional, non-explicit, and designed only to surface risk behavior.</small></span></div></article>
  <article className="panel analysis"><Head over="BEHAVIOR ANALYSIS" title="Signal intelligence" side="MODEL v1.8"/><div className="score populate" key={`score-${visibleCount}`}><div className="ring" style={{'--pct':`${liveScore*3.6}deg`} as React.CSSProperties}><span><b>{liveScore}</b><small>{liveSeverity.toUpperCase()}</small></span></div><div><small>CONFIDENCE</small><b>{confidence}</b><p>{visibleCount?'Multi-signal behavior match':'Awaiting conversation data'}</p></div></div><h3>Detected patterns <b>{visibleSignals.length}</b></h3><div className="signals">{visibleSignals.length===0&&<Empty text="No behavioral signals detected yet."/>}{visibleSignals.map((s,i)=><button className={`populate ${selected===i?'selected':''}`} onClick={()=>setSelected(i)} key={s[0]}><em className={s[2].toLowerCase()}>{s[2]}</em><span><b>{s[0]}</b><small>{s[1]}</small></span><strong>{s[3]}%</strong></button>)}</div><div className="trajectory"><label>RISK TRAJECTORY</label><b>{visibleSignals.length?'↗ ESCALATING':'— MONITORING'}</b><div>{visibleSignals.map((s,i)=><i className="populate" key={i} style={{height:`${Number(s[3])-45}%`}}/>)}</div><small>First contact <span>Current</span></small></div></article>
  <article className="panel dossier"><Head over="ICAC-ALIGNED INCIDENT DOSSIER" title="Chat Evidence Report" side={run?'CAPTURING • DEMO':'DRAFT • DEMO'}/>
   <div className="report-banner"><b>SIMULATED TRAINING RECORD</b><span>Structured for ICAC investigative review; not an official law-enforcement report.</span></div>
   <section className="report-control populate" key={`control-${visibleCount}`}><div><label>REPORT / CASE ID</label><b>CR-1048</b></div><div><label>REPORT STATUS</label><b>{run?'Capture in progress':visibleCount===messageCount?'Pending human review':visibleCount?'Capture paused':'Awaiting capture'}</b></div><div><label>INCIDENT TYPE</label><b>{visibleCount>1?'Suspected online enticement':'Classification pending'}</b></div><div><label>REFERRAL SOURCE</label><b>Automated platform monitor</b></div><div><label>JURISDICTION</label><b>{visibleCount===messageCount?'Undetermined • route to ICAC':'Pending determination'}</b></div><div><label>TIME STANDARD</label><b>CDT (UTC−05:00)</b></div></section>
   {visibleCount===0?<Empty text="Dossier fields will populate as evidence is captured."/>:<><div className="identity populate"><i>J</i><span><b>Jordan_77</b><small>Role: Suspected adult account • Identity unverified<br/>Platform: Demo game chat • Channel: #lobby-chat</small></span><em>SUBJECT</em></div>{visibleCount>1&&<div className="participant populate"><b>M</b><span><strong>Maya</strong><small>Role: Synthetic child persona • No real minor involved</small></span><em>PERSONA</em></div>}</>}
   <div className="section-title"><span>Preserved chat log</span><b>{visibleCount} records • original order</b></div>
   <div className="chat-log" role="table" aria-label="Preserved simulated chat log">{visibleCount===0&&<Empty text="No source records captured."/>}{d.messages.slice(0,visibleCount).map((m,i)=><div className="chat-record populate" role="row" key={`${key}-record-${i}`}><div className="record-meta"><b>CR-1048-CHAT-{String(i+1).padStart(3,'0')}</b><time>2026-08-24 20:{42+i}:00 CDT</time></div><div className="record-body"><span><b>{m[0]}</b><small>{m[2]}</small></span><p>{m[1]}</p></div><div className="record-foot"><span>Source: #lobby-chat • Native sequence {i+1}</span><b>{m[3]?`Flag: ${m[3]}`:'No automated flag'}</b></div></div>)}</div>
   {visibleCount>0&&<div className="preservation-note populate"><b>Source preservation statement</b><p>Messages above are retained in their original sequence and wording. Risk highlights shown elsewhere are analytical overlays and do not alter the preserved record.</p></div>}
   <div className="section-title"><span>Evidence & chain of custody</span><b>{visibleCount?'Integrity recorded':'Awaiting evidence'}</b></div>
   {visibleCount>0&&<section className="evidence-control populate"><div><label>EVIDENCE ID</label><b>CR-1048-E01</b><small>Complete channel transcript</small></div><div><label>COLLECTION METHOD</label><b>Read-only API capture</b><small>Automated listener • demo source</small></div><div><label>ORIGINAL FORMAT</label><b>UTF-8 JSON event stream</b><small>Working view rendered as text</small></div><div><label>INTEGRITY</label><b>SHA-256 recorded</b><small>Demo value: 8f4c…d291</small></div></section>}
   <div className="custody">{[['20:42 CDT • Acquired','Automated listener captured source events.'],['20:47 CDT • Preserved','Read-only original sealed; integrity value recorded.'],['20:48 CDT • Analyzed','Working copy sent to risk analysis; original unchanged.'],['20:49 CDT • Report generated','Custodian: Crusader demo system • access logged.']].slice(0,custodyCount).map((step,i)=><div className="populate" key={step[0]}><i>{i+1}</i><span><b>{step[0]}</b><small>{step[1]}</small></span></div>)}</div>
   {visibleCount===messageCount&&!run?<div className="action populate"><label>RECOMMENDED DISPOSITION</label><strong>Escalate to trained ICAC investigator</strong><p>Preserve the original export, confirm jurisdiction and identities, document legal process, and complete supervisor review before enforcement action.</p><div><button onClick={()=>alert('Demo case queued for trained human review.')}>Escalate case</button><button onClick={()=>window.print()}>Export report</button></div></div>:<div className="dossier-progress"><b>{run?'Building incident dossier…':'Dossier generation paused'}</b><span><i style={{width:`${progress*100}%`}}/></span><small>{visibleCount} of {messageCount} source records processed</small></div>}
   <footer>ICAC-aligned demo • Investigative lead only • Human verification required • Follow agency policy and applicable law</footer>
  </article>
 </section>
 </main>
}

function Head({over,title,side}:{over:string,title:string,side:string}){return <header className="head"><span><label>{over}</label><h2>{title}</h2></span><small>{side}</small></header>}
function Empty({text}:{text:string}){return <div className="simulation-empty"><i>◌</i><span>{text}</span></div>}

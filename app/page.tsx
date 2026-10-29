'use client';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react';
import { ArrowUp, RotateCcw, Pause, Play, Maximize2, X, Sparkles, ArrowUpRight, SlidersHorizontal, Sprout, MessageCircle, Sun, CloudRain, CakeSlice, Feather, Users, ChevronDown, Check, BookOpen, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JsonTree } from '@/components/json-tree';
import './island.css';
import { createDecisionRequests } from '@/lib/decision-requests';
import { buildCreatureApiCall, type CreatureCallTrace } from '@/lib/creature-decisions';
import { estimateDecisionUsage, type DecisionUsage } from '@/lib/decision-costs';
import { creatures, initialWorld, places, landmarks, actions, activityLabels, initialNeeds, advanceNeeds, type World } from '@/lib/world';
type DecisionProvider = 'openai' | 'jev';
const colors = { blue: '#79c9f5', pink: '#f4a0b8', yellow: '#f4d779', green: '#9bd59b' };
type Positions = Record<string, { x: number; y: number }>;
function readableRequest(raw: string) {
  try {
    const params = JSON.parse(raw);
    if (params && typeof params === 'object' && typeof params.input === 'string') {
      try {
        const input = JSON.parse(params.input);
        if (input && typeof input === 'object') params.input = input;
      } catch { /* Plain-text inputs stay as text. */ }
    }
    return JSON.stringify(params, null, 2);
  } catch { return raw; }
}
function Arena({ world, paused, selected, onSelect, positions }: { world: World; paused: boolean; selected: string; onSelect: (id: string) => void; positions: RefObject<Positions> }) {
  const stage = useRef<HTMLDivElement>(null);
  const nodes = useRef<Record<string, HTMLButtonElement | null>>({});
  const latest = useRef({ world, paused }); latest.current = { world, paused };
  useEffect(() => {
    let frame = 0, last = 0;
    const tick = (now: number) => {
      const dt = Math.min((now-last)/1000 || 0,.05); last = now;
      if (!latest.current.paused && stage.current) {
        const w = stage.current.clientWidth, h = stage.current.clientHeight;
        creatures.forEach((c,i) => {
          const d = latest.current.world.decisions[c.id], p = positions.current[c.id];
          const place = places[d.target as keyof typeof places], other = positions.current[d.target];
          let tx: number = place?.[0] ?? other?.x ?? 50, ty: number = place?.[1] ?? other?.y ?? 50;
          const angle = i/creatures.length*Math.PI*2;
          if (d.action === 'flee') { tx += Math.cos(angle)*35; ty += Math.sin(angle)*35; }
          else if (d.action === 'wait') { tx = p.x; ty = p.y; }
          else { const radius=['swim','drink','eat','sleep','hide'].includes(d.action)?4.5:9; tx += Math.cos(angle)*radius; ty += Math.sin(angle)*radius; }
          tx = Math.max(9,Math.min(91,tx)); ty = Math.max(14,Math.min(86,ty));
          const dx = tx-p.x, dy = ty-p.y, distance = Math.hypot(dx,dy);
          const step = Math.min(distance,dt*(d.flying ? 23 : d.action === 'flee' ? 20 : 13));
          if (distance > .1) { p.x += dx/distance*step; p.y += dy/distance*step; }
          const lava = places[latest.current.world.lava as keyof typeof places];
          if (lava && !d.flying) { const lx=p.x-lava[0], ly=p.y-lava[1], ld=Math.hypot(lx,ly); if (ld<19) { const a=ld<.1 ? angle : Math.atan2(ly,lx); p.x=lava[0]+Math.cos(a)*19; p.y=lava[1]+Math.sin(a)*19; } }
          p.x=Math.max(8,Math.min(92,p.x)); p.y=Math.max(d.flying?32:20,Math.min(88,p.y));
          const el=nodes.current[c.id]; if (el) { el.dataset.arrived=String(distance < 2.5); el.dataset.activity=d.action; el.style.transform=`translate(${p.x*w/100}px, ${p.y*h/100}px)`; el.style.zIndex=String(Math.round(p.y)+(d.flying?100:0)); }
        });
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  },[]);
  return <div ref={stage} className={`arena ${world.weather} ${paused?'paused':''}`} aria-label="Creature playground">
    <img className="island-scenery" src="/island-woodland.png" alt="" draggable={false}/>
    <div className="island-weather-light" aria-hidden="true"/>
    {landmarks.map(l=><div key={l.id} className={`landmark landmark-${l.id}`} style={{left:`${l.x}%`,top:`${l.y}%`}} title={l.description}><span className="landmark-label">{l.name}</span></div>)}
    {world.lava!=='none' && <div className="lava-zone" style={{left:`${places[world.lava][0]}%`,top:`${places[world.lava][1]}%`}}><span>HOT FLOOR</span></div>}
    {world.cake!=='none' && <div className="cake" style={{left:`${places[world.cake][0]}%`,top:`${places[world.cake][1]}%`}}><span>🍰</span><small>CAKE</small></div>}
    {world.weather==='disco' && <div className="disco-ball" aria-label="Dance party">🪩</div>}{world.weather==='rain' && <div className="rainfall" aria-label="Rain"/>}
    {creatures.map((c,i) => <button key={c.id} ref={el=>{nodes.current[c.id]=el;}} data-color={c.color} className={`creature ${selected===c.id?'selected':''} ${world.decisions[c.id].flying?'flying':''}`} onClick={()=>onSelect(c.id)} aria-label={`Inspect ${c.name}, ${c.color}, ${world.decisions[c.id].action}`} style={{'--hue':`${c.hue}deg`,'--delay':`${-i*.31}s`} as CSSProperties}><span className="creature-shadow"/><span className="creature-body"><img src="/creature.png" alt="" draggable={false}/><span className="flight-spark">✦</span></span><span className="creature-name"><span>{c.name}</span><small>{activityLabels[world.decisions[c.id].action]}</small></span></button>)}
    <div className="world-caption">{world.weather==='disco'?'GOOD VIBES, COLLECTIVELY.':world.lava!=='none'?'A SMALL COMPLICATION.':world.cake!=='none'?'SOMETHING WORTH MOVING FOR.':'TEN PERSONALITIES. ONE SHARED WORLD.'}</div>
  </div>;
}
export default function Home() {
  const [world,setWorld]=useState<World>(initialWorld), [prompt,setPrompt]=useState(''), [history,setHistory]=useState<string[]>([]);
  const [paused,setPaused]=useState(false), [selected,setSelected]=useState('pip'), [apiKey,setApiKey]=useState(''), [keyDraft,setKeyDraft]=useState('');
  const [provider,setProvider]=useState<DecisionProvider>('openai'), [serverProviders,setServerProviders]=useState({openai:false,jev:false});
  const serverConfigured=serverProviders[provider], engineLabel=provider==='openai'?'OpenAI Decisions':'Jev';
  const connected=serverConfigured || (provider==='jev' && Boolean(apiKey));
  const [settings,setSettings]=useState(false), [requestKind,setRequestKind]=useState<'manual'|'automatic'|null>(null), [error,setError]=useState(''), [latency,setLatency]=useState<number|null>(null);
  const busy=requestKind!==null, manualBusy=requestKind==='manual';
  const [model,setModel]=useState(''), [revision,setRevision]=useState(0), [full,setFull]=useState(false);
  const [callTrace,setCallTrace]=useState<CreatureCallTrace|null>(null);
  const [rawRequest,setRawRequest]=useState(false);
  const [usageEntries,setUsageEntries]=useState<{id:number;usage:DecisionUsage}[]>([]);
  const usageSequence=useRef(0);
  const sessionUsage=usageEntries.reduce((total,entry)=>({costUsd:total.costUsd+entry.usage.costUsd,inputTokens:total.inputTokens+entry.usage.inputTokens,inputEstimated:total.inputEstimated||entry.usage.inputEstimated}),{costUsd:0,inputTokens:0,inputEstimated:false});
  const positions=useRef<Positions>(Object.fromEntries(creatures.map(c=>[c.id,{x:c.x,y:c.y}])));
  const requests=useRef(createDecisionRequests());
  const residentsPanel=useRef<HTMLDetailsElement>(null), creaturePanel=useRef<HTMLDetailsElement>(null);
  const current=creatures.find(c=>c.id===selected)!, decision=world.decisions[selected];
  useEffect(()=>{ const change=()=>setFull(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange',change); return ()=>document.removeEventListener('fullscreenchange',change); },[]);
  useEffect(()=>{ void fetch('/api/decide').then(r=>r.json()).then(data=>setServerProviders((data as {providers:{openai:boolean;jev:boolean}}).providers)).catch(()=>{}); },[]);
  const [needs,setNeeds]=useState(initialNeeds);
  const [autonomous,setAutonomous]=useState(false), [calls,setCalls]=useState(0), [autoCalls,setAutoCalls]=useState(0);
  const nextDecision=useRef(0);
  const live=useRef({world,history,needs,paused,autonomous,autoCalls,apiKey,serverConfigured,provider});
  live.current={world,history,needs,paused,autonomous,autoCalls,apiKey,serverConfigured,provider};
  const submitRef=useRef<(text:string,automatic?:boolean)=>Promise<void>>(async()=>{});
  function cancelPending(){requests.current.cancel();setRequestKind(null);}
  function togglePause(){if(!paused)cancelPending();setPaused(!paused);}
  useEffect(()=>{
    const timer=setInterval(()=>{
      const s=live.current;
      if(s.paused || document.hidden)return;
      setNeeds(n=>advanceNeeds(n,s.world,positions.current));
      if(s.autonomous && !requests.current.busy && Date.now()>=nextDecision.current){
        if(s.autoCalls>=30){setAutonomous(false);setError('30 automatic calls reached. Start another session to continue.');return;}
        nextDecision.current=Date.now()+8000;
        void submitRef.current('Reconsider what each creature should do now using current needs, positions, weather, and personalities. Continue the latest user-requested activities until completed or changed by the user; choose freely for creatures without an active user direction. Preserve world objects and abilities. This is a simulation tick, not a new audience command.',true);
      }
    },1000);
    const visibility=()=>{if(document.hidden){setPaused(true);cancelPending();}};
    document.addEventListener('visibilitychange',visibility);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visibility);requests.current.cancel();};
  },[]);
  async function submit(text:string,automatic=false) {
    if(!text.trim())return;
    const s=live.current;
    if(!s.serverConfigured && !(s.provider==='jev' && s.apiKey)){setError(`Connect ${s.provider==='openai'?'OpenAI Decisions':'Jev'} to bring this scene to life.`);setSettings(true);setAutonomous(false);return;}
    if(automatic && (s.paused || !s.autonomous))return;
    const pending=requests.current.begin(automatic);
    if(!pending)return;
    setRequestKind(automatic?'automatic':'manual');setError('');setCalls(v=>v+1);
    if(automatic)setAutoCalls(v=>v+1);
    const controller=pending.controller;
    const body={prompt:text.trim(),world:s.world,history:s.history.slice(-12),positions:positions.current,needs:s.needs,automatic,provider:s.provider,...(s.provider==='jev'?{apiKey:s.apiKey}:{})};
    const usageId=++usageSequence.current;
    const estimatedUsage=estimateDecisionUsage(s.provider,buildCreatureApiCall(body).params);
    setUsageEntries(entries=>[...entries,{id:usageId,usage:estimatedUsage}]);
    const timeout=setTimeout(()=>controller.abort('timeout'),25000);
    try{
      const response=await fetch('/api/decide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const result=await response.json() as {world:World;latency:number;model:string;error?:string;trace?:CreatureCallTrace};
      if(result.trace?.usage)setUsageEntries(entries=>entries.map(entry=>entry.id===usageId?{...entry,usage:result.trace!.usage}:entry));
      else if(!response.ok && response.status>=400 && response.status<500)setUsageEntries(entries=>entries.filter(entry=>entry.id!==usageId));
      if(!requests.current.isCurrent(pending))return;
      if(result.trace)setCallTrace(result.trace);
      if(!response.ok)throw new Error(result.error||'The model could not make a decision.');
      setWorld(result.world);setLatency(result.latency);setModel(result.model);
      const nextHistory=automatic?s.history:[...s.history,text.trim()];
      live.current={...live.current,world:result.world,history:nextHistory};
      if(!automatic){setHistory(nextHistory);setPrompt(value=>value.trim()===text.trim()?'':value);}
      nextDecision.current=Date.now()+8000;
    }catch(e){
      if(!requests.current.owns(pending))return;
      if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Something went wrong.');setAutonomous(false);}
      else if(controller.signal.reason==='timeout'){setError('Decision timed out. Automatic decisions stopped.');setAutonomous(false);}
    }finally{clearTimeout(timeout);if(requests.current.finish(pending))setRequestKind(null);}
  }
  submitRef.current=submit;
  function toggleAutonomy(){
    if(autonomous){setAutonomous(false);live.current={...live.current,autonomous:false};if(requestKind==='automatic')cancelPending();return;}
    if(!connected){setSettings(true);setError(`Connect ${engineLabel} first.`);return;}
    setAutoCalls(0);setAutonomous(true);setPaused(false);nextDecision.current=0;
  }
  function reset(){cancelPending();positions.current=Object.fromEntries(creatures.map(c=>[c.id,{x:c.x,y:c.y}]));setWorld(initialWorld());setNeeds(initialNeeds());setAutonomous(false);setAutoCalls(0);setCalls(0);setHistory([]);setLatency(null);setCallTrace(null);setError('');setPaused(false);setRevision(r=>r+1);}
  function inspectCreature(id:string){setSelected(id);if(residentsPanel.current)residentsPanel.current.open=true;if(creaturePanel.current)creaturePanel.current.open=true;}
  async function toggleFull(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{setError('Fullscreen is unavailable here. Enlarge the preview panel instead.');}}
  function switchProvider(next:DecisionProvider){
    setProvider(next);setAutonomous(false);setSettings(false);setKeyDraft('');setError('');nextDecision.current=0;
    live.current={...live.current,provider:next,autonomous:false,serverConfigured:serverProviders[next]};
  }
  return <main className="creature-demo">
    <header className="island-header">
      <div className="island-identity"><span className="island-mark"><Sprout size={24} strokeWidth={1.6}/></span><div><h1>Tiny World<span>.</span></h1><p>Small creatures. Curious minds.</p></div></div>
      <div className="engine-picker"><label htmlFor="decision-engine">Decision engine</label><select id="decision-engine" aria-label="Decision engine" value={provider} disabled={busy} onChange={e=>switchProvider(e.target.value as DecisionProvider)}><option value="openai">OpenAI Decisions</option><option value="jev">Jev</option></select><span><i className={connected?'ready':''}/>{connected?'Connected':'Key needed'}</span><Button variant="ghost" size="icon" onClick={()=>setSettings(!settings)} aria-label="Connection settings" title="Connection settings"><SlidersHorizontal size={16}/></Button></div>
    </header>
    {settings && provider==='openai' && <section className="connection-panel" aria-label="OpenAI connection"><div><h2>OpenAI Decisions</h2><p>{serverConfigured?'Your saved server key is ready. Send a scene or start automatic decisions.':'Add OPENAI_API_KEY to the server configuration to connect this world.'}</p></div><Button variant="ghost" size="icon" aria-label="Close connection settings" onClick={()=>setSettings(false)}><X/></Button></section>}
    {settings && provider==='jev' && <section className="connection-panel" aria-label="Jev connection"><div><h2>Give your world a mind.</h2><p>Use an OpenRouter API key for live decisions. Kept in memory for this visit only.</p><a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">Get an OpenRouter key <ArrowUpRight size={14}/></a></div><form onSubmit={(e:FormEvent)=>{e.preventDefault();if(keyDraft.trim()){setApiKey(keyDraft.trim());setKeyDraft('');setSettings(false);setError('');}}}><label htmlFor="api-key">OpenRouter API key</label><div className="key-row"><input id="api-key" type="password" autoComplete="off" placeholder="Paste your API key" value={keyDraft} onChange={e=>setKeyDraft(e.target.value)}/><Button type="submit" disabled={!keyDraft.trim()||busy}>Use key</Button>{apiKey&&<Button type="button" variant="outline" disabled={busy} onClick={()=>{setApiKey('');setKeyDraft('');}}>Disconnect</Button>}</div></form><Button variant="ghost" size="icon" aria-label="Close connection settings" onClick={()=>setSettings(false)}><X/></Button></section>}
    <div className="workspace">
      <section className="world-section" aria-label="Interactive world">
        <div className="stage-toolbar"><span><span className="world-dot"/>THE ISLAND <span className="divider">/</span>{paused?'Paused':'10 little lives'}</span><div><Button className="pause-control" variant="ghost" onClick={togglePause} aria-label={paused?'Resume simulation':'Pause simulation'}>{paused?<Play size={14}/>:<Pause size={14}/>}<span>{paused?'Resume':'Pause'}</span></Button><Button variant="ghost" size="icon" onClick={reset} disabled={busy} aria-label="Reset world" title="Reset world"><RotateCcw/></Button><Button variant="ghost" size="icon" onClick={toggleFull} aria-label={full?'Exit fullscreen':'Enter fullscreen'} title={full?'Exit fullscreen':'Fullscreen'}><Maximize2/></Button></div></div>
        <Arena positions={positions} key={revision} world={world} paused={paused} selected={selected} onSelect={inspectCreature}/>
        <div className="island-status" aria-label="Scene status"><span><Sun size={13}/>{world.weather}</span><span><Users size={13}/>10 creatures</span>{Object.values(world.decisions).some(d=>d.flying)&&<span><Feather size={13}/>{Object.values(world.decisions).filter(d=>d.flying).length} flying</span>}{world.cake!=='none'&&<span><CakeSlice size={13}/>Cake at {world.cake.replaceAll('_',' ')}</span>}{world.lava!=='none'&&<span>Lava at {world.lava.replaceAll('_',' ')}</span>}<small>Select a creature to meet them</small></div>
      </section>
      <aside className="demo-console" aria-label="Demo controls">
        <div className={`auto-mode ${autonomous?'enabled':''}`}><div><span className="auto-mode-label"><Sparkles size={15}/>Auto decisions</span><p>{paused?'World paused':autonomous?'They choose. You can step in.':'You set their next move.'}</p></div><button className="auto-switch" type="button" role="switch" aria-label="Auto decisions" aria-checked={autonomous} onClick={toggleAutonomy} disabled={manualBusy&&!autonomous}><span/></button></div>
        <section className="director" aria-label="Direct the island">
          <div className="director-heading"><MessageCircle size={17}/><h2>Direct the island</h2></div>
          <p className="director-intro">Give them a plan, or change the scene.</p>
          <div className="direction-history">{history.length?<><span className="direction-label">Your last direction</span><p>{history[history.length-1]}</p></>:<p className="direction-empty">“Pip, go to the pond. Bean, find some berries.”</p>}</div>
          <form onSubmit={e=>{e.preventDefault();void submit(prompt);}}>
            <label htmlFor="instruction" className="sr-only">Tell the creatures what happens next</label>
            <textarea id="instruction" rows={3} value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={1000} placeholder="What happens next?" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void submit(prompt);}}}/>
            <div className="direction-send"><span>{autonomous?'Your direction takes priority':'Enter to send'}</span><Button type="submit" disabled={manualBusy||!prompt.trim()} aria-label="Send instruction">{manualBusy?'Sending…':'Send'}<ArrowUp size={15}/></Button></div>
          </form>
          <p className="decision-status" aria-live="polite">{requestKind==='manual'?<><Sparkles size={13}/>Applying your direction…</>:requestKind==='automatic'?<><Sparkles size={13}/>The island is thinking. You can still send.</>:paused?'Paused. Resume to watch them move.':history.length?<><Check size={13}/>Direction applied{autonomous?'. Auto continues from here.':'.'}</>:autonomous?'Making their own little plans.':'A little direction goes a long way.'}</p>
          {error&&<p className="demo-error" role="alert">{error}</p>}
        </section>
        <section className="scene-controls" aria-label="Scene controls"><h2>Set the scene</h2><div>
          <button disabled={manualBusy} onClick={()=>void submit('The rain stops and clear daylight returns. Preserve current plans and all objects and abilities.')}><Sun size={17}/><span>Sunshine</span></button>
          <button disabled={manualBusy} onClick={()=>void submit('A sudden thunderstorm arrives. React according to courage, needs, and personality. The rain stays until changed.')}><CloudRain size={17}/><span>Make it rain</span></button>
          <button disabled={manualBusy} onClick={()=>void submit('A delicious cake appears by the pond. React according to needs and personality.')}><CakeSlice size={17}/><span>Drop a cake</span></button>
          <button disabled={manualBusy} onClick={()=>void submit(`${current.name} receives the power of flight. Other abilities are unchanged. Choose how to use it based on needs and personality.`)}><Feather size={17}/><span>Let {current.name} fly</span></button>
        </div></section>
        <details className="action-legend"><summary><BookOpen size={16}/><span>Action legend</span><small>12 actions</small><ChevronDown size={14}/></summary>
          <dl>{Object.entries(actions).map(([action, description])=><div key={action}><dt>{action}</dt><dd>{description}</dd></div>)}</dl>
          <p><Feather size={14}/><span>Flight is an ability. Flying creatures can still do these actions.</span></p>
        </details>
        <details ref={residentsPanel} className="residents-panel"><summary><Users size={16}/><span>Meet the creatures</span><small>10</small><ChevronDown size={14}/></summary>
          <div className="roster-head" aria-hidden="true"><span>Creature</span><span>Activity</span><span>Hunger</span><span>Energy</span><span>Courage</span></div><div className="creature-list">{creatures.map(c=><button key={c.id} onClick={()=>inspectCreature(c.id)} className={selected===c.id?'active':''} aria-label={`${c.name}, ${world.decisions[c.id].action}, hunger ${Math.round(needs[c.id].hunger)} percent, energy ${Math.round(needs[c.id].energy)} percent, courage ${needs[c.id].courage} percent`}><span className="roster-name"><span className="color-swatch" style={{background:colors[c.color]}}/>{c.name}</span><small>{world.decisions[c.id].flying?'flying':world.decisions[c.id].action}</small>{(['hunger','energy','courage'] as const).map(key=><span className={`roster-stat ${key}`} key={key}>{Math.round(needs[c.id][key])}%<span className="roster-track"><i style={{width:`${needs[c.id][key]}%`}}/></span></span>)}</button>)}</div>
              <details ref={creaturePanel} className="creature-details"><summary>Inspect {current.name} · {decision.confidence===undefined?'No decision':`${Math.round(decision.confidence*100)}% confidence`}</summary><div className="decision-detail"><div className="detail-name"><h3>{current.name}</h3><span>{current.color}</span></div><p>{current.trait}</p><div className="needs-panel">{(['hunger','energy','courage'] as const).map(key=><label key={key}><span>{key}</span><meter min="0" max="100" value={needs[selected][key]} aria-label={`${current.name} ${key}`}/><span>{Math.round(needs[selected][key])}</span></label>)}</div><div className="action-summary"><span>NEXT ACTION</span><strong>{decision.action}<span> → {decision.target.replaceAll('_',' ')}</span></strong></div>{decision.probabilities?<div className="probabilities">{Object.entries(decision.probabilities).map(([action,value])=><div key={action}><span>{action}</span><div><i style={{width:`${value*100}%`}}/></div><span>{Math.round(value*100)}%</span></div>)}<p>Confidence: {Math.round((decision.confidence??0)*100)}%</p></div>:<p className="preview-note">{'Try an open-ended situation, or send different creatures to different places.'}</p>}</div></details>
        </details>
        <details className="call-info"><summary><span>Decision details</span><span>{latency===null?'No calls yet':`${(latency/1000).toFixed(2)}s`}<ChevronDown size={12}/></span></summary><strong>{calls} model calls · {paused?'Paused':autonomous?'Automatic':'Manual control'}</strong><small>{autoCalls}/30 automatic calls this session</small><span>{model||engineLabel}</span><small>33 questions per call · Automatic decisions every 8 seconds</small></details>
      </aside>
    </div>
    <details className="api-inspector" open>
      <summary><Code2 size={18}/><span>API request &amp; response</span><small>{busy?'New call running…':'Latest completed call'}</small><ChevronDown size={16}/></summary>
      <section className="api-usage" aria-label="Call costs and tokens"><div><span>Total cost · USD (est.)</span><strong>${sessionUsage.costUsd.toFixed(6)}</strong></div><div><span>Input tokens this visit{sessionUsage.inputEstimated?' (est.)':''}</span><strong>{sessionUsage.inputTokens.toLocaleString('en-US')}</strong></div><small>{usageEntries.length} {usageEntries.length===1?'call':'calls'} · Chat + auto · Resets on refresh</small></section>
      {callTrace?<div className="api-call-meta"><span>{callTrace.provider==='openai'?'OpenAI Decisions':'Jev'} · {callTrace.automatic?'Automatic':'Chat'}</span><code>POST {callTrace.endpoint}</code><span>{callTrace.status===null?'No HTTP response':`HTTP ${callTrace.status}`} · {(callTrace.latency/1000).toFixed(2)}s</span></div>:<p className="api-empty">Send a direction or enable Auto decisions to see a real API call.</p>}
      {callTrace&&<p className="api-call-usage">This call: {callTrace.usage.inputEstimated?'~':''}{callTrace.usage.inputTokens.toLocaleString('en-US')} input tokens · {callTrace.usage.costEstimated?'~':''}${callTrace.usage.costUsd.toFixed(6)} USD{callTrace.usage.inputEstimated?' (estimated)':' · Provider-reported tokens'}</p>}
      <div className="api-panels">
        <section aria-label="API request"><div className="api-panel-heading"><h2>Request parameters</h2><div className="api-format-controls" role="group" aria-label="Request display format"><button type="button" aria-pressed={!rawRequest} onClick={()=>setRawRequest(false)}>Readable</button><button type="button" aria-pressed={rawRequest} onClick={()=>setRawRequest(true)}>Raw JSON</button></div></div>{callTrace&&!rawRequest?<JsonTree text={readableRequest(callTrace.request)} label="Actual request parameters"/>:<pre tabIndex={0} aria-label="Actual request parameters"><code>{callTrace?.request??'The exact model request will appear here after a call.'}</code></pre>}</section>
        <section aria-label="API response"><h2>Model response</h2>{callTrace?.response!==null&&callTrace?.response!==undefined?<JsonTree text={callTrace.response} label="Actual model response"/>:<pre tabIndex={0} aria-label="Actual model response"><code>{callTrace?'No response body received.':'The model’s unmodified response will appear here.'}</code></pre>}</section>
      </div>
      <p className="api-note">{rawRequest?'Raw JSON shows the request as sent.':'Click an object or list to expand its fields.'} Authentication headers are omitted. API keys are never shown.</p>
      <p className="api-note">Tokens use provider usage when available, otherwise request characters ÷ 4. Canceled or unanswered calls retain an estimate. Costs use reported charges or published rates, including OpenAI cache usage. <a href="https://developers.openai.com/api/docs/guides/decisions#pricing-and-availability" target="_blank" rel="noreferrer">OpenAI pricing</a> · <a href="https://openrouter.ai/typesafe/jev-1.13" target="_blank" rel="noreferrer">Jev pricing</a></p>
    </details>
    <footer><span>Built for a little curiosity.</span><span>{engineLabel} decides. The world moves.</span></footer>
  </main>;
}

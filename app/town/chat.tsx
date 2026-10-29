'use client';

import { useEffect, useImperativeHandle, useRef, useState, type FormEvent, type Ref } from 'react';
import { ArrowUpRight, MessageCircle, Send, X } from 'lucide-react';
import { describeTownChoice, townChatResult, type MessageKind, type TownChatRequest, type TownDecision } from '@/lib/town/decisions';
import { createResidents, residentProfile } from '@/lib/town/world';
import { weatherAnnouncement, type TownWeather, type WeatherReaction } from '@/lib/town/weather';
import styles from './chat.module.css';

type Reaction = { id: string; name: string; label: string; profile: string; confidence: number };
type Message = { id: number; prompt: string; status: 'pending' | 'done' | 'error'; source?: 'weather'; kind?: MessageKind; changes?: Reaction[]; unchanged?: Reaction[]; latency?: number };
export type TownChatControls = { reactToWeather: (next: TownWeather, previous: TownWeather) => boolean };
type Props = { open: boolean; paused: boolean; news: string[]; onClearNews: () => void; controllerRef: Ref<TownChatControls>; onBusyChange: (busy: boolean) => void; onWeatherReaction: (reaction: WeatherReaction) => void; readTown: () => Omit<TownChatRequest, 'prompt' | 'history' | 'trigger'>; onDecisions: (decisions: TownDecision[], announcement?: string) => void; onResident: (id: string) => void; onClose: () => void };
const examples = ['The bakery has a half-price sale', 'The library is hosting a book club', 'Sofia go to Arjun'];
const locals = createResidents();

export default function TownChat({ open, paused, news, onClearNews, controllerRef, onBusyChange, onWeatherReaction, readTown, onDecisions, onResident, onClose }: Props) {
  const [draft, setDraft] = useState(''), [messages, setMessages] = useState<Message[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null), transcriptRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null), openRef = useRef(open), nextId = useRef(0);
  useEffect(() => { openRef.current = open; if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { const box = transcriptRef.current; if (box) box.scrollTop = box.scrollHeight; }, [messages, open]);
  useEffect(() => () => { requestRef.current?.abort(); requestRef.current = null; }, []);

  useImperativeHandle(controllerRef, () => ({ reactToWeather(next, previous) {
    if (requestRef.current) return false;
    void send(weatherAnnouncement(previous, next), { next, previous });
    return true;
  } }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft.trim());
  }

  async function send(prompt: string, weatherChange?: { next: TownWeather; previous: TownWeather }) {
    if (!prompt || requestRef.current) return;
    const controller = new AbortController(), id = nextId.current++;
    requestRef.current = controller; setBusy(true); onBusyChange(true); setError('');
    if (weatherChange) onWeatherReaction({ status: 'pending' });
    setMessages(previous => [...previous, { id, prompt, status: 'pending', source: weatherChange ? 'weather' : undefined }]);
    const timeout = window.setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetch('/api/town/decide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...readTown(), ...(weatherChange ? { weather: weatherChange.next, previousWeather: weatherChange.previous, trigger: 'weather' } : { trigger: 'message' }), prompt, history: messages.filter(m => m.status === 'done' && m.source !== 'weather').slice(-6).map(m => m.prompt) }), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'The town could not receive that instruction. Try again.');
      const result = townChatResult.parse(data);
      if (controller.signal.aborted) return;
      onDecisions(result.decisions, result.messageKind === 'announcement' && !weatherChange ? prompt : undefined);
      const reaction = (d: TownDecision) => {
        const person = locals.find(p => p.id === d.residentId)!;
        return { id: person.id, name: person.name, label: d.choice === 'keep' ? 'Keep current plan' : describeTownChoice(person, d.choice), profile: residentProfile(person).description, confidence: d.confidence };
      };
      const changes = result.decisions.filter(d => d.choice !== 'keep').map(reaction), unchanged = result.decisions.filter(d => d.choice === 'keep').map(reaction);
      if (weatherChange) onWeatherReaction({ status: 'done', changed: changes.length });
      setMessages(previous => previous.map(m => m.id === id ? { ...m, status: 'done', kind: result.messageKind, changes, unchanged, latency: result.latency } : m));
      if (!weatherChange) setDraft('');
    } catch (failure) {
      if (requestRef.current !== controller) return;
      const message = controller.signal.aborted ? 'The request timed out. Try sending it again.' : failure instanceof Error ? failure.message : 'Could not reach the town. Try again.';
      setError(message);
      if (weatherChange) onWeatherReaction({ status: 'error', error: message });
      setMessages(previous => previous.map(m => m.id === id ? { ...m, status: 'error' } : m));
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); onBusyChange(false); if (openRef.current && !weatherChange) inputRef.current?.focus(); }
    }
  }

  return <section id="town-chat" className={styles.panel} hidden={!open} aria-label="Town chat" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <header className={styles.heading}><span className={styles.glyph}><MessageCircle size={16} /></span><h2>Town chat</h2><button onClick={onClose} aria-label="Close town chat"><X size={18} /></button></header>
    {news.length > 0 && <details className={styles.news}><summary>Town news · {news.length}</summary><ul>{news.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul><button onClick={onClearNews}>Clear town news</button><p>Remembered for this visit until cleared or reset. Newer news takes precedence.</p></details>}
    <div ref={transcriptRef} className={styles.transcript} role="log" aria-label="Town instructions and decisions" aria-live="polite" aria-relevant="additions text" aria-busy={busy}>
      {messages.length === 0 && <div className={styles.empty}><p>Share town news or tell a neighbor what to do.</p><div className={styles.examples}>{examples.map(example => <button key={example} onClick={() => { setDraft(example); inputRef.current?.focus(); }}>{example}<ArrowUpRight size={14} /></button>)}</div></div>}
      {messages.map(message => <article key={message.id} className={styles.exchange}>
        <div className={styles.userMessage}><span>{message.source === 'weather' ? 'WEATHER' : 'YOU'}</span><p>{message.prompt}</p></div>
        <div className={styles.result}>
          {message.status === 'pending' ? <p className={styles.pending}>Choosing the neighbors’ next moves…</p> : message.status === 'error' ? <p>Instruction wasn’t applied.</p> : <>
            <span className={styles.resultLabel}>{message.source === 'weather' ? 'REACTIONS TO WEATHER' : message.kind === 'announcement' ? 'REACTIONS TO TOWN NEWS' : 'TOWN DECISIONS'} <small>{((message.latency ?? 0) / 1000).toFixed(1)}s</small></span>
            {message.kind === 'announcement' && message.source !== 'weather' && <p className={styles.newsSaved}>Added to town news.</p>}
            {message.changes?.length ? <><p>{message.changes.length} {message.changes.length === 1 ? 'neighbor has' : 'neighbors have'} a new plan.{message.kind === 'announcement' && ` ${message.unchanged?.length ?? 0} keep their current plans.`}</p><details open={message.changes.length <= 3}><summary>See {message.changes.length === 1 ? 'decision' : 'decisions'}</summary><ul>{message.changes.map(change => <li key={change.id}><button onClick={() => onResident(change.id)} aria-label={`Find ${change.name}`}><span><strong>{change.name}</strong><span>{change.label}</span></span><ArrowUpRight size={14} /></button><small className={styles.profile}>{change.profile}</small><small>{Math.round(change.confidence * 100)}% confidence</small></li>)}</ul></details></> : <p>{message.source === 'weather' ? 'The neighbors are keeping their current plans for this weather.' : message.kind === 'announcement' ? 'The neighbors are keeping their current plans for now. The news is part of the world for future messages.' : 'No changes to the neighbors’ current plans.'}</p>}
            {message.kind === 'announcement' && !!message.unchanged?.length && <details><summary>{message.unchanged.length} keeping their plans</summary><ul>{message.unchanged.map(person => <li key={person.id}><button onClick={() => onResident(person.id)} aria-label={`Find ${person.name}`}><span><strong>{person.name}</strong><span>{person.label}</span></span><ArrowUpRight size={14} /></button><small className={styles.profile}>{person.profile}</small></li>)}</ul></details>}
          </>}
        </div>
      </article>)}
      {error && <p className={styles.error} role="alert">{error} Resident plans are unchanged.</p>}
    </div>
    <form className={styles.composer} onSubmit={submit} aria-label="Send a town instruction">
      {paused && <p className={styles.pauseNote}>Town paused. New plans will move when you resume.</p>}
      <label className={styles.inputLabel} htmlFor="town-message">Message the town</label>
      <div className={styles.inputRow}><textarea ref={inputRef} id="town-message" placeholder="What should the neighbors do?" rows={2} maxLength={1000} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" disabled={!draft.trim() || busy} aria-label="Send instruction"><Send size={17} /></button></div>
      <div className={styles.footer}><span>OpenAI Decisions</span><span>{busy ? 'Deciding…' : 'Enter to send'}</span></div>
    </form>
  </section>;
}

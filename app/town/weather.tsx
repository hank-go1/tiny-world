'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, CloudLightning, CloudRain, Sun, X } from 'lucide-react';
import { weatherKinds, weatherLabels, type TownWeather, type WeatherReaction } from '@/lib/town/weather';
import styles from './weather.module.css';

const icons = { clear: Sun, rain: CloudRain, storm: CloudLightning };
const descriptions = { clear: 'A little time outside', rain: 'A reason to find cover', storm: 'Time to seek shelter' };
type Props = { weather: TownWeather; busy: boolean; paused: boolean; reaction: WeatherReaction; onChange: (weather: TownWeather) => void; onRetry: () => void; onShowReactions: () => void };

export default function WeatherController({ weather, busy, paused, reaction, onChange, onRetry, onShowReactions }: Props) {
  const [open, setOpen] = useState(false), rootRef = useRef<HTMLDivElement>(null), buttonRef = useRef<HTMLButtonElement>(null);
  const Icon = icons[weather];
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div ref={rootRef} className={styles.control} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); buttonRef.current?.focus(); } }}>
    <button ref={buttonRef} className={styles.trigger} aria-label={`Weather: ${weatherLabels[weather]}`} aria-expanded={open} aria-controls="weather-controller" onClick={() => setOpen(!open)}><Icon size={18} /><span>{weatherLabels[weather]}</span><ChevronDown size={13} /></button>
    {open && <section id="weather-controller" className={styles.panel} aria-label="Weather controller">
      <div className={styles.heading}><div><span>SET THE SCENE</span><h2>Weather</h2></div><button aria-label="Close weather controller" onClick={() => { setOpen(false); buttonRef.current?.focus(); }}><X size={16} /></button></div>
      <div className={styles.options} role="group" aria-label="Choose town weather">{weatherKinds.map(kind => {
        const WeatherIcon = icons[kind];
        return <button key={kind} aria-label={`Set weather to ${weatherLabels[kind]}`} aria-pressed={weather === kind} disabled={busy || weather === kind} onClick={() => onChange(kind)}><WeatherIcon size={21} /><strong>{weatherLabels[kind]}</strong></button>;
      })}</div>
      <p className={styles.description}>{descriptions[weather]}</p>
      {paused && <p className={styles.pauseNote}>Town paused. Resume to watch the neighbors move.</p>}
      <div className={styles.feedback} role="status" aria-live="polite">
        {reaction.status === 'idle' && <p>Neighbors reconsider their plans each time you change the weather.</p>}
        {reaction.status === 'pending' && <p>Neighbors are deciding how to react…</p>}
        {reaction.status === 'done' && <><p>{reaction.changed ? `${reaction.changed} ${reaction.changed === 1 ? 'neighbor has' : 'neighbors have'} a new plan.` : 'The neighbors are keeping their current plans.'}</p><button className={styles.resultLink} onClick={() => { setOpen(false); onShowReactions(); }}>See resident reactions</button></>}
        {reaction.status === 'error' && <><p className={styles.error}>{reaction.error} The weather changed; resident plans are unchanged.</p><button className={styles.resultLink} disabled={busy} onClick={onRetry}>Retry resident reactions</button></>}
      </div>
    </section>}
  </div>;
}

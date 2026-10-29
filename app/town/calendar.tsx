'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { dayTitle, isCalendarDate, monthDays, monthTitle, moveMonth, occasionPresets, type Occasion, type OccasionInput, type OccasionKind } from '@/lib/town/calendar';
import type { useTownCalendar } from '@/lib/town/use-calendar';
import { places } from '@/lib/town/world';
import styles from './calendar.module.css';

type Props = { today: string; store: ReturnType<typeof useTownCalendar>; onClose: () => void };
type Editor = { id?: string; input: OccasionInput };
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TownCalendar({ today, store, onClose }: Props) {
  const [month, setMonth] = useState(today.slice(0, 7)), [selectedDate, setSelectedDate] = useState(today);
  const [editor, setEditor] = useState<Editor | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const byDate = useMemo(() => {
    const map = new Map<string, Occasion[]>();
    for (const event of store.events) map.set(event.date, [...(map.get(event.date) ?? []), event]);
    return map;
  }, [store.events]);
  const days = monthDays(month);
  const selectedEvents = [...(byDate.get(selectedDate) ?? [])].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title));

  function selectDay(date: string) { setSelectedDate(date); setMonth(date.slice(0, 7)); setEditor(null); }
  function openEditor(event?: Occasion) {
    setEditor(event ? { id: event.id, input: { title: event.title, kind: event.kind, date: event.date, time: event.time ?? '', placeId: event.placeId ?? '' } } : { input: { title: '', kind: 'custom', date: selectedDate, time: '', placeId: '' } });
  }
  function updateDraft<K extends keyof OccasionInput>(key: K, value: OccasionInput[K]) {
    setEditor(current => current && { ...current, input: { ...current.input, [key]: value } });
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor) return;
    const form = new FormData(e.currentTarget);
    const input = { ...editor.input, date: String(form.get('date')), time: String(form.get('time') || '') || undefined, placeId: editor.input.placeId || undefined };
    if (store.save(input, editor.id)) { setSelectedDate(input.date); setMonth(input.date.slice(0, 7)); setEditor(null); }
  }

  return <section id="town-calendar" className={styles.panel} role="dialog" aria-modal="false" aria-label="Town calendar" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
    <div className={styles.heading}><div><span className={styles.calendarIcon}><CalendarDays size={20} /></span><div><h2>Town calendar</h2><p>A date for the little things.</p></div></div><button ref={closeRef} type="button" onClick={onClose} aria-label="Close calendar"><X size={18} /></button></div>
    <div className={styles.body}>
      <div className={styles.monthNavigation}><div><button type="button" aria-label="Previous month" disabled={month === '0001-01'} onClick={() => { setMonth(moveMonth(month, -1)); setEditor(null); }}><ChevronLeft size={17} /></button><h3>{monthTitle(month)}</h3><button type="button" aria-label="Next month" disabled={month === '9999-12'} onClick={() => { setMonth(moveMonth(month, 1)); setEditor(null); }}><ChevronRight size={17} /></button></div><button type="button" className={styles.todayButton} onClick={() => selectDay(today)}>Today</button></div>
      <div className={styles.weekdays} aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className={styles.days} aria-label={monthTitle(month)}>
        {days.map(date => {
          const events = byDate.get(date) ?? [], current = date === today, selected = date === selectedDate;
          return <button type="button" key={date} disabled={!isCalendarDate(date)} className={`${styles.day} ${date.slice(0, 7) !== month ? styles.outside : ''} ${current ? styles.current : ''} ${selected ? styles.selected : ''}`} aria-label={`${dayTitle(date)}${events.length ? `, ${events.length} occasion${events.length === 1 ? '' : 's'}` : ''}`} aria-current={current ? 'date' : undefined} aria-pressed={selected} onClick={() => selectDay(date)}><span>{Number(date.slice(-2))}</span><span className={styles.dots} aria-hidden="true">{events.slice(0, 3).map(event => <i key={event.id} style={{ background: event.kind === 'custom' ? '#7f9fa2' : occasionPresets[event.kind].color }} />)}{events.length > 3 && <small>+</small>}</span></button>;
        })}
      </div>

      {store.error && <p className={styles.error} role="alert">{store.error}</p>}
      <div className={styles.agendaHeading}><div><span>OCCASIONS</span><h3>{dayTitle(selectedDate)}</h3></div><button type="button" className={styles.addButton} disabled={!store.ready || Boolean(editor)} onClick={() => openEditor()} aria-label="Add occasion"><Plus size={17} /></button></div>

      {editor ? <form className={styles.editor} onSubmit={submit} aria-label={editor.id ? 'Edit occasion' : 'New occasion'}>
        <h4>{editor.id ? 'Edit occasion' : 'Make a little plan'}</h4>
        <label>Occasion type<select value={editor.input.kind} onChange={e => { const kind = e.target.value as OccasionKind; setEditor(current => current && { ...current, input: { ...current.input, kind, title: kind === 'custom' ? '' : occasionPresets[kind].title } }); }}><option value="custom">Custom occasion</option>{Object.entries(occasionPresets).map(([kind, preset]) => <option key={kind} value={kind}>{preset.title}</option>)}</select></label>
        <label>Name<input autoFocus required maxLength={80} value={editor.input.title} placeholder="e.g. Maya’s birthday" onChange={e => updateDraft('title', e.target.value)} /></label>
        <div className={styles.formRow}><label>Date<input required name="date" type="date" min="0001-01-01" max="9999-12-31" defaultValue={editor.input.date} /></label><label>Time <span>(optional)</span><input name="time" type="time" defaultValue={editor.input.time ?? ''} /></label></div>
        <label>Place <span>(optional)</span><select value={editor.input.placeId ?? ''} onChange={e => updateDraft('placeId', e.target.value)}><option value="">Anywhere in town</option>{places.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
        <div className={styles.formActions}><button type="submit" className={styles.saveButton} disabled={!store.ready}>{editor.id ? 'Save changes' : 'Mark occasion'}</button><button type="button" onClick={() => setEditor(null)}>Cancel</button></div>
      </form> : !store.ready && !store.error ? <p className={styles.empty}>Opening your calendar…</p> : selectedEvents.length ? <div className={styles.events}>{selectedEvents.map(event => <div className={styles.event} key={event.id}>
        <span className={styles.eventDot} style={{ background: event.kind === 'custom' ? '#7f9fa2' : occasionPresets[event.kind].color }} />
        <div className={styles.eventDetails}><strong>{event.title}</strong><span><time dateTime={event.time ? `${event.date}T${event.time}:00+07:00` : event.date}>{event.time || 'All day'}</time>{event.placeId && <><i /> <MapPin size={10} />{places.find(place => place.id === event.placeId)?.name}</>}</span>{event.createdBy === 'jev' && <small>Marked by Jev</small>}</div>
        <button type="button" onClick={() => openEditor(event)} aria-label={`Edit ${event.title}`} title="Edit occasion"><Pencil size={14} /></button><button type="button" onClick={() => store.remove(event.id)} aria-label={`Remove ${event.title}`} title="Remove occasion"><Trash2 size={14} /></button>
      </div>)}</div> : <div className={styles.empty}><CalendarDays size={23} /><p>Nothing planned for this day.</p><button type="button" disabled={!store.ready} onClick={() => openEditor()}>Mark an occasion <Plus size={13} /></button></div>}
    </div>
    <div className={styles.footer}>Saved in this browser · Town time, GMT+7</div>
  </section>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { CALENDAR_STORAGE_KEY, applyCalendarCommand, calendarEventsSchema, removeOccasion, saveOccasion, type CalendarCommand, type Occasion, type OccasionInput } from './calendar';

export function useTownCalendar() {
  const [events, setEvents] = useState<Occasion[]>([]), [ready, setReady] = useState(false), [error, setError] = useState('');
  const eventsRef = useRef<Occasion[]>([]);
  useEffect(() => {
    function load() {
      try {
        const stored = localStorage.getItem(CALENDAR_STORAGE_KEY);
        const next = stored ? calendarEventsSchema.parse(JSON.parse(stored)) : [];
        eventsRef.current = next; setEvents(next); setError('');
      } catch { setError('Your saved calendar could not be read. Check browser storage and try refreshing.'); }
      setReady(true);
    }
    load();
    const onStorage = (event: StorageEvent) => { if (event.key === CALENDAR_STORAGE_KEY || event.key === null) load(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function commit(change: (previous: Occasion[]) => Occasion[]) {
    if (!ready) return false;
    try {
      const next = change(eventsRef.current);
      localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(next));
      eventsRef.current = next; setEvents(next); setError(''); return true;
    } catch (error) {
      setError(error instanceof Error && error.name === 'ZodError' ? 'Check the occasion name, date, time, and place.' : 'This change could not be saved. Check browser storage and try again.');
      return false;
    }
  }
  return {
    events, ready, error,
    save: (input: OccasionInput, id?: string) => commit(previous => saveOccasion(previous, input, id)),
    remove: (id: string) => commit(previous => removeOccasion(previous, id)),
    applyCommand: (command: CalendarCommand) => commit(previous => applyCalendarCommand(previous, command)),
  };
}

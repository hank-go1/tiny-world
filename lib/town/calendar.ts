import { z } from 'zod';
import { places } from './world';

export const CALENDAR_STORAGE_KEY = 'tiny-block.occasions.v1';
export const occasionPresets = {
  birthday: { title: 'Birthday', color: '#c67b95' },
  festival: { title: 'Town festival', color: '#b18a48' },
  market: { title: 'Market day', color: '#62956e' },
  picnic: { title: 'Community picnic', color: '#729c67' },
  'game-night': { title: 'Game night', color: '#9381b5' },
};
export type PresetKind = keyof typeof occasionPresets;
export type OccasionKind = PresetKind | 'custom';

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const dateSchema = z.string().refine(isCalendarDate, 'Choose a valid calendar date.');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid time.').optional();
const placeSchema = z.string().refine(id => places.some(p => p.id === id), 'Choose a place in town.').optional();
const presetSchema = z.enum(['birthday', 'festival', 'market', 'picnic', 'game-night']);
export const occasionInputSchema = z.object({
  title: z.string().trim().min(1, 'Give this occasion a name.').max(80, 'Keep the name under 80 characters.'),
  kind: z.enum(['birthday', 'festival', 'market', 'picnic', 'game-night', 'custom']),
  date: dateSchema, time: timeSchema, placeId: placeSchema,
});
export const occasionSchema = occasionInputSchema.extend({ id: z.string().min(1).max(80), createdBy: z.enum(['you', 'jev']) });
export const calendarEventsSchema = z.array(occasionSchema);
export type OccasionInput = z.infer<typeof occasionInputSchema>;
export type Occasion = z.infer<typeof occasionSchema>;

export const calendarCommandSchema = z.object({
  type: z.literal('mark_occasion'), kind: presetSchema, date: dateSchema, time: timeSchema, placeId: placeSchema,
}).strict();
export type CalendarCommand = z.infer<typeof calendarCommandSchema>;

export function saveOccasion(events: Occasion[], input: OccasionInput, id: string = crypto.randomUUID()): Occasion[] {
  const previous = events.find(event => event.id === id);
  const event = occasionSchema.parse({ ...input, id, createdBy: previous?.createdBy ?? 'you' });
  return [...events.filter(event => event.id !== id), event];
}

// Jev chooses typed values; the application supplies the occasion's wording.
export function applyCalendarCommand(events: Occasion[], command: CalendarCommand): Occasion[] {
  const parsed = calendarCommandSchema.parse(command);
  const event = occasionSchema.parse({ ...parsed, id: crypto.randomUUID(), title: occasionPresets[parsed.kind].title, createdBy: 'jev' });
  return [...events, event];
}

export function removeOccasion(events: Occasion[], id: string) {
  return events.filter(event => event.id !== id);
}

const localDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
const monthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function townDateKey(timestamp: number) {
  const parts = localDateFormat.formatToParts(timestamp);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function monthTitle(month: string) { return monthFormat.format(new Date(`${month}-01T12:00:00Z`)); }
export function dayTitle(date: string) { return dayFormat.format(new Date(`${date}T12:00:00Z`)); }
export function moveMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
export function monthDays(month: string): string[] {
  const first = new Date(`${month}-01T12:00:00Z`);
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first.getTime()); date.setUTCDate(first.getUTCDate() + index);
    return date.toISOString().split('T')[0];
  });
}

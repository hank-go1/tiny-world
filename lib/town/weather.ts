export const weatherKinds = ['clear', 'rain', 'storm'] as const;
export type TownWeather = typeof weatherKinds[number];
export const weatherLabels: Record<TownWeather, string> = { clear: 'Clear', rain: 'Rain', storm: 'Storm' };
export type WeatherReaction = { status: 'idle' | 'pending' | 'done' | 'error'; changed?: number; error?: string };

export function weatherAnnouncement(previous: TownWeather, next: TownWeather) {
  return previous === next
    ? `The current weather is ${next}. Neighbors reconsider their plans for these conditions.`
    : `The weather has changed from ${previous} to ${next}. Neighbors react to the new conditions.`;
}

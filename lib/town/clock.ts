const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});

export function advanceTownTime(timestamp: number, elapsedMs: number, speed: number, paused: boolean) {
  return paused ? timestamp : timestamp + Math.max(0, elapsedMs) * speed;
}

export function formatTownTime(timestamp: number) {
  return { time: timeFormat.format(timestamp), date: dateFormat.format(timestamp), iso: new Date(timestamp).toISOString() };
}

export function minutesSince(iso: string, now = Date.now()) {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

export function relativeTime(iso: string, now = Date.now()) {
  const m = minutesSince(iso, now);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min ago`;
}

export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

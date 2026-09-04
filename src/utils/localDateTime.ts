const BUYALA_TIME_ZONE = "Africa/Kampala";

function parts(date: Date) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUYALA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(values.map((part) => [part.type, part.value]));
}

export function buyalaDate(date = new Date()) {
  const value = parts(date);
  return `${value.year}-${value.month}-${value.day}`;
}

export function buyalaTime(date = new Date()) {
  const value = parts(date);
  return `${value.hour}:${value.minute}`;
}

export function shiftDateKey(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

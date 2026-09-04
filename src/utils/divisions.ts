export function normalizeDivision(value: string): string {
  return /^out\s*side$/i.test(value.trim()) ? "Outside" : value;
}

export function normalizeDivisionRecord<T extends { division?: string }>(record: T): T {
  return typeof record.division === "string" ? { ...record, division: normalizeDivision(record.division) } : record;
}

export function divisionLabel(value?: string): string {
  const name = normalizeDivision(value?.trim() ?? "");
  if (/^(lubaga|rubaga|rubaga\s*\/\s*lubaga|lubaga\s*\/\s*rubaga)$/i.test(name)) return "Lubaga";
  return name || "Other / unconfirmed";
}

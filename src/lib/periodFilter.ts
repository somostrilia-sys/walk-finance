/** Period filter options and date range calculator */

export const PERIOD_OPTIONS = [
  { value: "atrasados", label: "Atrasados" },
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "ultimos-3", label: "Últimos 03 dias" },
  { value: "ultimos-5", label: "Últimos 05 dias" },
  { value: "ultimos-7", label: "Últimos 07 dias" },
  { value: "ultimos-15", label: "Últimos 15 dias" },
  { value: "ultimos-30", label: "Últimos 30 dias" },
  { value: "ultimos-60", label: "Últimos 60 dias" },
  { value: "ultimos-90", label: "Últimos 90 dias" },
  { value: "proximos-30", label: "Próximos 30 dias" },
  { value: "proximos-60", label: "Próximos 60 dias" },
  { value: "todos", label: "Todos" },
] as const;

export type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Returns [startDate, endDate] strings (YYYY-MM-DD) or null for "todos" */
export function getDateRange(period: PeriodValue): { start: string; end: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (period) {
    case "todos":
      return null;
    case "atrasados":
      return { start: "2000-01-01", end: fmt(addDays(today, -1)) };
    case "hoje":
      return { start: fmt(today), end: fmt(today) };
    case "ontem": {
      const y = addDays(today, -1);
      return { start: fmt(y), end: fmt(y) };
    }
    case "ultimos-3":
      return { start: fmt(addDays(today, -3)), end: fmt(today) };
    case "ultimos-5":
      return { start: fmt(addDays(today, -5)), end: fmt(today) };
    case "ultimos-7":
      return { start: fmt(addDays(today, -7)), end: fmt(today) };
    case "ultimos-15":
      return { start: fmt(addDays(today, -15)), end: fmt(today) };
    case "ultimos-30":
      return { start: fmt(addDays(today, -30)), end: fmt(today) };
    case "ultimos-60":
      return { start: fmt(addDays(today, -60)), end: fmt(today) };
    case "ultimos-90":
      return { start: fmt(addDays(today, -90)), end: fmt(today) };
    case "proximos-30":
      return { start: fmt(today), end: fmt(addDays(today, 30)) };
    case "proximos-60":
      return { start: fmt(today), end: fmt(addDays(today, 60)) };
    default:
      return null;
  }
}

/** Filter an array of items by date field using period */
export function filterByPeriod<T>(items: T[], period: PeriodValue, dateField: keyof T): T[] {
  const range = getDateRange(period);
  if (!range) return items;
  return items.filter((item) => {
    const d = item[dateField] as string;
    if (!d) return false;
    return d >= range.start && d <= range.end;
  });
}

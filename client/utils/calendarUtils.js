export function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(isoStr) {
  const [y, m, d] = String(isoStr || '').split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function addDays(isoStr, offset) {
  const dt = parseIsoDate(isoStr);
  dt.setDate(dt.getDate() + offset);
  return toIsoDate(dt);
}

export function addMonths(isoStr, offset) {
  const dt = parseIsoDate(isoStr);
  const targetMonth = dt.getMonth() + offset;
  const result = new Date(dt.getFullYear(), targetMonth, 1);
  return toIsoDate(result);
}

export function getStartOfWeek(isoStr) {
  const dt = parseIsoDate(isoStr);
  const day = dt.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diffToMonday);
  return toIsoDate(dt);
}

export function getWeekDays(isoStr) {
  const start = getStartOfWeek(isoStr);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function getMonthGridDays(isoStr) {
  const dt = parseIsoDate(isoStr);
  const firstOfMonth = new Date(dt.getFullYear(), dt.getMonth(), 1);
  const lastOfMonth = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);

  const gridStart = getStartOfWeek(toIsoDate(firstOfMonth));
  const totalDays = [];
  let cursor = gridStart;

  // Render 5 or 6 full Monday-Sunday weeks covering the entire month
  for (let i = 0; i < 42; i += 1) {
    totalDays.push({
      iso: cursor,
      dayNumber: parseIsoDate(cursor).getDate(),
      inCurrentMonth: parseIsoDate(cursor).getMonth() === dt.getMonth(),
    });
    cursor = addDays(cursor, 1);
    if (i >= 27 && (i + 1) % 7 === 0 && cursor > toIsoDate(lastOfMonth)) {
      break;
    }
  }

  return totalDays;
}

export function getPeriodRange(view, anchorIso) {
  if (view === 'day') {
    return { startDate: anchorIso, endDate: anchorIso };
  }
  if (view === 'week') {
    const days = getWeekDays(anchorIso);
    return { startDate: days[0], endDate: days[6] };
  }
  const grid = getMonthGridDays(anchorIso);
  return {
    startDate: grid[0].iso,
    endDate: grid[grid.length - 1].iso,
  };
}

export function formatPeriodTitle(view, anchorIso) {
  const dt = parseIsoDate(anchorIso);
  if (view === 'day') {
    return dt.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (view === 'week') {
    const days = getWeekDays(anchorIso);
    const startDt = parseIsoDate(days[0]);
    const endDt = parseIsoDate(days[6]);
    const startLabel = startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = endDt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startLabel} – ${endLabel}`;
  }
  return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatShortDayHeader(isoStr) {
  const dt = parseIsoDate(isoStr);
  return {
    weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    day: dt.getDate(),
  };
}

export function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function formatHourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

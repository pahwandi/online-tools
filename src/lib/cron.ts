export type FieldKey = 'second' | 'minute' | 'hour' | 'dom' | 'month' | 'dow';

export interface FieldDef {
  key: FieldKey;
  label: string;
  min: number;
  max: number;
  names?: string[];
  hint: string;
}

export const MONTH_NAMES = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];
export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const DOW_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DOW_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export const MINUTE_DEF: FieldDef = { key: 'minute', label: 'Minute', min: 0, max: 59, hint: '0–59' };
export const HOUR_DEF: FieldDef = { key: 'hour', label: 'Hour', min: 0, max: 23, hint: '0–23' };
export const DOM_DEF: FieldDef = { key: 'dom', label: 'Day of month', min: 1, max: 31, hint: '1–31' };
export const MONTH_DEF: FieldDef = { key: 'month', label: 'Month', min: 1, max: 12, names: MONTH_NAMES, hint: '1–12 or JAN–DEC' };
export const DOW_DEF: FieldDef = { key: 'dow', label: 'Day of week', min: 0, max: 7, names: DOW_NAMES, hint: '0–7 or SUN–SAT (0 and 7 = Sunday)' };
export const SECOND_DEF: FieldDef = { key: 'second', label: 'Second', min: 0, max: 59, hint: '0–59' };

export const FIELD_DEFS: FieldDef[] = [MINUTE_DEF, HOUR_DEF, DOM_DEF, MONTH_DEF, DOW_DEF];

const UNIT_SINGULAR: Record<FieldKey, string> = {
  second: 'second',
  minute: 'minute',
  hour: 'hour',
  dom: 'day of the month',
  month: 'month',
  dow: 'day of the week',
};

const UNIT_PLURAL: Record<FieldKey, string> = {
  second: 'seconds',
  minute: 'minutes',
  hour: 'hours',
  dom: 'days',
  month: 'months',
  dow: 'days',
};

export interface ParsedField {
  raw: string;
  values: number[];
  isWildcard: boolean;
}

export interface CronFieldRow {
  def: FieldDef;
  raw: string;
  parsed: ParsedField;
  meaning: string;
}

export interface CronInfo {
  error: string;
  empty: boolean;
  hasSeconds: boolean;
  rows: CronFieldRow[];
  description: string;
  runs: Date[];
}

const pad = (n: number): string => String(n).padStart(2, '0');

function toNumber(tok: string, def: FieldDef): number {
  const lower = tok.trim().toLowerCase();
  if (def.names) {
    const idx = def.names.indexOf(lower);
    if (idx !== -1) return def.key === 'dow' ? idx : idx + 1;
  }
  if (!/^\d+$/.test(lower)) {
    throw new Error(`"${tok.trim()}" is not a valid number or name.`);
  }
  return Number(lower);
}

/** Parse one cron field: wildcards, lists, ranges (a-b) and steps (star/n, a-b/n). */
export function parseField(raw: string, def: FieldDef): ParsedField {
  const src = raw.trim();
  if (!src) throw new Error('field is empty.');

  const isDayField = def.key === 'dom' || def.key === 'dow';
  if (src === '*' || (src === '?' && isDayField)) {
    return { raw: src, values: [], isWildcard: true };
  }
  if (src === '?') {
    throw new Error('"?" is only allowed for day-of-month and day-of-week.');
  }

  const max = def.key === 'dow' ? 6 : def.max;
  const values = new Set<number>();

  for (const part of src.split(',')) {
    const pieces = part.split('/');
    if (pieces.length > 2) throw new Error(`"${part}" has too many "/" separators.`);
    const rangePart = pieces[0].trim();
    let step = 1;
    if (pieces.length === 2) {
      if (!/^\d+$/.test(pieces[1]) || Number(pieces[1]) === 0) {
        throw new Error(`invalid step "/${pieces[1]}" in "${part}".`);
      }
      step = Number(pieces[1]);
    }

    let start: number;
    let end: number;
    let wrapsSunday = false;

    if (rangePart === '*') {
      start = def.min;
      end = max;
    } else if (rangePart.includes('-')) {
      const bounds = rangePart.split('-');
      if (bounds.length !== 2) throw new Error(`invalid range "${rangePart}".`);
      start = toNumber(bounds[0], def);
      end = toNumber(bounds[1], def);
      if (def.key === 'dow' && end === 7) {
        end = 6;
        wrapsSunday = true;
      }
    } else {
      start = toNumber(rangePart, def);
      end = pieces.length === 2 ? max : start;
    }

    if (def.key === 'dow') {
      if (start === 7) start = 0;
      if (end === 7) end = 0;
    }
    if (start < def.min || start > max || end < def.min || end > max || start > end) {
      throw new Error(`"${part}" is out of range (${def.hint}).`);
    }
    for (let v = start; v <= end; v += step) values.add(v);
    if (wrapsSunday) values.add(0);
  }

  return { raw: src, values: [...values].sort((a, b) => a - b), isWildcard: false };
}

/** All matching numbers for a field (wildcards expanded). */
export function fieldValues(p: ParsedField, def: FieldDef): number[] {
  if (!p.isWildcard) return p.values;
  const max = def.key === 'dow' ? 6 : def.max;
  const all: number[] = [];
  for (let v = def.min; v <= max; v++) all.push(v);
  return all;
}

function formatValue(v: number, def: FieldDef): string {
  if (def.key === 'month') return MONTH_LONG[v - 1];
  if (def.key === 'dow') return DOW_LONG[v % 7];
  if (def.key === 'hour') return `${pad(v)}:00`;
  return String(v);
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Human-readable meaning of a single field, e.g. "Monday through Friday". */
export function describeField(p: ParsedField, def: FieldDef): string {
  if (p.isWildcard) return `every ${UNIT_SINGULAR[def.key]}`;
  const vals = p.values;
  const fmt = (v: number) => formatValue(v, def);
  if (vals.length === 1) return fmt(vals[0]);

  let contiguous = true;
  let uniform = vals[1] - vals[0];
  for (let i = 1; i < vals.length; i++) {
    const d = vals[i] - vals[i - 1];
    if (d !== 1) contiguous = false;
    if (d !== uniform) uniform = 0;
  }
  if (contiguous) return `${fmt(vals[0])} through ${fmt(vals[vals.length - 1])}`;
  if (uniform > 1) return `every ${uniform} ${UNIT_PLURAL[def.key]}`;
  return joinList(vals.map(fmt));
}

type FieldMap = Record<string, ParsedField>;

const capitalize = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Plain-English sentence for a parsed cron expression. */
export function describeCron(f: FieldMap, hasSeconds: boolean): string {
  const { minute, hour, dom, month, dow } = f;
  const parts: string[] = [];

  if (minute.isWildcard && hour.isWildcard) {
    parts.push('every minute');
  } else if (
    !minute.isWildcard &&
    !hour.isWildcard &&
    hour.values.length <= 4 &&
    minute.values.length <= 4
  ) {
    const combos: string[] = [];
    for (const h of hour.values) {
      for (const m of minute.values) combos.push(`${pad(h)}:${pad(m)}`);
    }
    parts.push(`at ${joinList(combos)}`);
  } else if (hour.isWildcard) {
    parts.push(`at minute ${joinList(minute.values.map(String))} of every hour`);
  } else if (minute.isWildcard) {
    parts.push(`every minute of ${joinList(hour.values.map((h) => `${pad(h)}:00`))}`);
  } else {
    parts.push(
      `at minute ${joinList(minute.values.map(String))} past hour ${joinList(
        hour.values.map((h) => pad(h)),
      )}`,
    );
  }

  const domRestricted = !dom.isWildcard;
  const dowRestricted = !dow.isWildcard;
  if (domRestricted && dowRestricted) {
    parts.push(
      `on ${describeField(dow, DOW_DEF)} or on day ${joinList(
        dom.values.map(String),
      )} of the month`,
    );
  } else if (dowRestricted) {
    parts.push(`on ${describeField(dow, DOW_DEF)}`);
  } else if (domRestricted) {
    parts.push(`on day ${joinList(dom.values.map(String))} of the month`);
  }

  if (!month.isWildcard) parts.push(`in ${describeField(month, MONTH_DEF)}`);

  let sentence = parts.join(', ');
  if (hasSeconds && !f.second.isWildcard) {
    sentence += ` (second: ${describeField(f.second, SECOND_DEF)})`;
  }
  return `${capitalize(sentence)}.`;
}

/** Next `count` fire times after `from`, in local time. */
export function nextRuns(
  f: FieldMap,
  hasSeconds: boolean,
  count = 5,
  from = new Date(),
): Date[] {
  const seconds = hasSeconds ? new Set(fieldValues(f.second, SECOND_DEF)) : null;
  const minutes = new Set(fieldValues(f.minute, MINUTE_DEF));
  const hours = new Set(fieldValues(f.hour, HOUR_DEF));
  const doms = new Set(fieldValues(f.dom, DOM_DEF));
  const months = new Set(fieldValues(f.month, MONTH_DEF));
  const dows = new Set(fieldValues(f.dow, DOW_DEF).map((v) => v % 7));
  const bothDays = !f.dom.isWildcard && !f.dow.isWildcard;

  const t = new Date(from.getTime());
  t.setMilliseconds(0);
  if (seconds) {
    t.setSeconds(t.getSeconds() + 1);
  } else {
    t.setSeconds(0);
    t.setMinutes(t.getMinutes() + 1);
  }

  const results: Date[] = [];
  let guard = 0;
  while (results.length < count && guard < 1000000) {
    guard++;
    if (!months.has(t.getMonth() + 1)) {
      t.setMonth(t.getMonth() + 1, 1);
      t.setHours(0, 0, 0, 0);
      continue;
    }
    const domOk = doms.has(t.getDate());
    const dowOk = dows.has(t.getDay());
    const dayOk = bothDays ? domOk || dowOk : domOk && dowOk;
    if (!dayOk) {
      t.setDate(t.getDate() + 1);
      t.setHours(0, 0, 0, 0);
      continue;
    }
    if (!hours.has(t.getHours())) {
      t.setHours(t.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!minutes.has(t.getMinutes())) {
      t.setMinutes(t.getMinutes() + 1, 0, 0);
      continue;
    }
    if (seconds && !seconds.has(t.getSeconds())) {
      t.setSeconds(t.getSeconds() + 1, 0);
      continue;
    }
    results.push(new Date(t.getTime()));
    if (seconds) t.setSeconds(t.getSeconds() + 1, 0);
    else t.setMinutes(t.getMinutes() + 1, 0, 0);
  }
  return results;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format a fire time for display, e.g. "Mon 5 Jan 2026, 09:00:00". */
export function formatRunDate(d: Date): string {
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Coarse "in X minutes/hours/days" relative label for a future date. */
export function relativeFromNow(d: Date, now = Date.now()): string {
  const diff = d.getTime() - now;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'in less than a minute';
  if (mins < 60) return `in ${mins} minute${mins > 1 ? 's' : ''}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days > 1 ? 's' : ''}`;
}

/** Parse a 5-field (minute-first) or 6-field (second-first) cron expression. */
export function parseCron(expr: string, from = new Date()): CronInfo {
  const trimmed = expr.trim();
  if (!trimmed) {
    return { error: '', empty: true, hasSeconds: false, rows: [], description: '', runs: [] };
  }

  const tokens = trimmed.split(/\s+/);
  const hasSeconds = tokens.length === 6;
  if (tokens.length !== 5 && tokens.length !== 6) {
    return {
      error: `Expected 5 fields (minute … day-of-week) or 6 fields (second first), got ${tokens.length}.`,
      empty: false,
      hasSeconds: false,
      rows: [],
      description: '',
      runs: [],
    };
  }

  const defs = hasSeconds ? [SECOND_DEF, ...FIELD_DEFS] : FIELD_DEFS;
  const fields: FieldMap = {};
  const rows: CronFieldRow[] = [];

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    try {
      const parsed = parseField(tokens[i], def);
      fields[def.key] = parsed;
      rows.push({ def, raw: tokens[i], parsed, meaning: describeField(parsed, def) });
    } catch (err) {
      return {
        error: `${def.label}: ${err instanceof Error ? err.message : String(err)}`,
        empty: false,
        hasSeconds,
        rows,
        description: '',
        runs: [],
      };
    }
  }

  return {
    error: '',
    empty: false,
    hasSeconds,
    rows,
    description: describeCron(fields, hasSeconds),
    runs: nextRuns(fields, hasSeconds, 5, from),
  };
}

import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import Section from '../components/Section';
import { actionBtnClass, btnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';

const UNITS: [string, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1_000],
];

const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number): string => String(n).padStart(2, '0');

function relativeTo(target: number, now: number): string {
  const diff = now - target;
  const abs = Math.abs(diff);
  if (abs < 1000) return 'just now';
  for (const [name, ms] of UNITS) {
    const value = Math.floor(abs / ms);
    if (value >= 1) {
      const label = `${value} ${name}${value > 1 ? 's' : ''}`;
      return diff > 0 ? `${label} ago` : `in ${label}`;
    }
  }
  return 'just now';
}

function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function localIso(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(
    Math.floor(abs / 60),
  )}:${pad(abs % 60)}`;
}

function humanLocal(d: Date): string {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface ResultRow {
  key: string;
  label: string;
  value: string;
}

export default function TimestampConverter() {
  const [now, setNow] = createSignal(Date.now());
  const [tsInput, setTsInput] = createSignal(String(Math.floor(Date.now() / 1000)));
  const [dtInput, setDtInput] = createSignal(toLocalInputValue(new Date()));
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | Unix Timestamp Converter';
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  });

  const nowDate = createMemo(() => new Date(now()));

  const nowRows = createMemo<ResultRow[]>(() => {
    const ms = now();
    const d = nowDate();
    return [
      { key: 'now-s', label: 'Unix (s)', value: String(Math.floor(ms / 1000)) },
      { key: 'now-ms', label: 'Unix (ms)', value: String(ms) },
      { key: 'now-iso', label: 'ISO 8601', value: d.toISOString() },
      { key: 'now-local', label: 'Local time', value: humanLocal(d) },
    ];
  });

  const decoded = createMemo(() => {
    const src = tsInput().trim();
    if (!src) {
      return { error: '', detected: '', rows: [] as ResultRow[] };
    }
    let ms: number;
    let detected: string;
    if (/^[+-]?\d+$/.test(src)) {
      const n = Number(src);
      if (Math.abs(n) >= 1e11) {
        ms = n;
        detected = 'milliseconds';
      } else {
        ms = n * 1000;
        detected = 'seconds';
      }
    } else {
      const t = Date.parse(src);
      if (Number.isNaN(t)) {
        return {
          error: `Could not parse "${src}" — enter a Unix timestamp or a date string like 2026-09-28T12:00:00Z.`,
          detected: '',
          rows: [] as ResultRow[],
        };
      }
      ms = t;
      detected = 'date string';
    }
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) {
      return { error: 'Timestamp is out of range.', detected: '', rows: [] as ResultRow[] };
    }
    return {
      error: '',
      detected,
      rows: [
        { key: 'dec-iso', label: 'ISO 8601 (UTC)', value: d.toISOString() },
        { key: 'dec-iso-local', label: 'ISO 8601 (local)', value: localIso(d) },
        { key: 'dec-local', label: 'Local date & time', value: humanLocal(d) },
        { key: 'dec-utc', label: 'UTC date & time', value: d.toUTCString() },
        { key: 'dec-rel', label: 'Relative', value: relativeTo(ms, now()) },
        { key: 'dec-day', label: 'Day of year', value: String(dayOfYear(d)) },
      ] as ResultRow[],
    };
  });

  const encoded = createMemo(() => {
    const src = dtInput();
    if (!src) return { error: '', rows: [] as ResultRow[] };
    const d = new Date(src);
    if (Number.isNaN(d.getTime())) {
      return { error: 'Pick a valid date and time.', rows: [] as ResultRow[] };
    }
    const ms = d.getTime();
    return {
      error: '',
      rows: [
        { key: 'enc-s', label: 'Unix (seconds)', value: String(Math.floor(ms / 1000)) },
        { key: 'enc-ms', label: 'Unix (milliseconds)', value: String(ms) },
        { key: 'enc-iso', label: 'ISO 8601 (UTC)', value: d.toISOString() },
      ] as ResultRow[],
    };
  });

  const setNowToInput = () => setDtInput(toLocalInputValue(new Date()));

  const rowClass =
    'flex items-center justify-between gap-3 py-1.5 border-b border-stone-950/10 dark:border-stone-50/10 last:border-0';
  const labelClass = 'text-sm text-stone-500 dark:text-stone-400 shrink-0';
  const valueClass =
    'font-mono text-sm text-stone-900 dark:text-stone-100 truncate text-right';
  const copyBtnClass =
    'px-2 py-0.5 text-xs rounded border border-stone-950/20 dark:border-stone-50/16 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer shrink-0';

  const Row = (props: { row: ResultRow }) => (
    <div class={rowClass}>
      <span class={labelClass}>{props.row.label}</span>
      <span class="flex items-center gap-2 min-w-0">
        <span class={valueClass}>{props.row.value}</span>
        <button
          type="button"
          class={copyBtnClass}
          onClick={() => copy(props.row.key, props.row.value)}
        >
          {copiedKey() === props.row.key ? 'Copied!' : 'Copy'}
        </button>
      </span>
    </div>
  );

  return (
    <Section
      title="Unix Timestamp Converter"
      description="Convert Unix timestamps to human-readable dates and back. Seconds and milliseconds auto-detected, with a live clock. Everything runs locally in your browser."
    >
      <div class="rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 p-4">
        <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-4">
          <For each={nowRows()}>
            {(row) => (
              <button
                type="button"
                class="flex flex-col items-start gap-0.5 text-left bg-transparent border-none cursor-pointer p-0 hover:opacity-70 transition-opacity"
                title="Click to copy"
                onClick={() => copy(row.key, row.value)}
              >
                <span class="text-xs text-stone-500 dark:text-stone-400">
                  {copiedKey() === row.key ? 'Copied!' : row.label}
                </span>
                <span class="font-mono text-sm text-stone-900 dark:text-stone-100 break-all">
                  {row.value}
                </span>
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
        <div class="flex flex-col gap-3">
          <span class="text-sm text-stone-500 dark:text-stone-400">
            Timestamp → date
          </span>
          <div class="flex gap-2">
            <input
              type="text"
              value={tsInput()}
              onInput={(e) => setTsInput(e.currentTarget.value)}
              placeholder="e.g. 1758974400"
              spellcheck="false"
              class="flex-1 min-w-0 font-mono text-sm p-3 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
            />
            <button
              type="button"
              class={actionBtnClass()}
              onClick={() => setTsInput(String(Math.floor(Date.now() / 1000)))}
            >
              Now
            </button>
          </div>
          <Show when={decoded().detected}>
            <p class="text-xs text-stone-500 dark:text-stone-400">
              Detected: {decoded().detected}
            </p>
          </Show>
          <Show when={decoded().error}>
            <p class="text-sm text-red-600 dark:text-red-400">{decoded().error}</p>
          </Show>
          <div>
            <For each={decoded().rows}>{(row) => <Row row={row} />}</For>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <span class="text-sm text-stone-500 dark:text-stone-400">
            Date → timestamp
          </span>
          <div class="flex gap-2">
            <input
              type="datetime-local"
              step="1"
              value={dtInput()}
              onInput={(e) => setDtInput(e.currentTarget.value)}
              class="flex-1 min-w-0 font-mono text-sm p-3 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
            />
            <button type="button" class={actionBtnClass()} onClick={setNowToInput}>
              Now
            </button>
          </div>
          <p class="text-xs text-stone-500 dark:text-stone-400">
            Interpreted in your local timezone (
            {Intl.DateTimeFormat().resolvedOptions().timeZone}).
          </p>
          <Show when={encoded().error}>
            <p class="text-sm text-red-600 dark:text-red-400">{encoded().error}</p>
          </Show>
          <div>
            <For each={encoded().rows}>{(row) => <Row row={row} />}</For>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 text-sm flex-wrap">
        <span class="text-stone-500 dark:text-stone-400">Quick units</span>
        <For
          each={[
            ['1 minute', 60],
            ['1 hour', 3600],
            ['1 day', 86400],
            ['1 week', 604800],
            ['1 year', 31536000],
          ]}
        >
          {([label, seconds]) => (
            <button
              type="button"
              class={btnClass(false)}
              title={`${seconds} seconds`}
              onClick={() => setTsInput(String(seconds))}
            >
              {label} = {seconds}s
            </button>
          )}
        </For>
      </div>
    </Section>
  );
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

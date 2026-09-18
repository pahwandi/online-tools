import { createMemo, createSignal, onSettled } from 'solid-js';
import { For } from 'solid-js';
import Section from '../components/Section';

const DELIMITERS = [
  { label: 'Comma', value: ',' },
  { label: 'Semicolon', value: ';' },
  { label: 'Tab', value: '\t' },
];

type Row = Record<string, unknown>;

function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
  out: Record<string, unknown> = {},
): Record<string, unknown> {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      flattenObject(value as Record<string, unknown>, path, out);
    } else {
      out[path] = value;
    }
  }
  return out;
}

function csvCell(value: unknown, delimiter: string): string {
  if (value === null || value === undefined) return '';
  let s: string;
  if (typeof value === 'string') {
    s = value;
  } else if (Array.isArray(value) || typeof value === 'object') {
    s = JSON.stringify(value);
  } else {
    s = String(value);
  }
  if (s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function jsonToCsv(
  data: unknown,
  delimiter: string,
  flatten: boolean,
): string {
  const rows: Row[] = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error('JSON array items must be objects.');
      }
      rows.push(item as Row);
    }
  } else if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    rows.push(data as Row);
  } else {
    throw new Error('JSON must be an object or an array of objects.');
  }

  if (rows.length === 0) return '';

  const normalized = flatten
    ? rows.map((row) => flattenObject(row))
    : rows.map((row) => ({ ...row }));

  const columns: string[] = [];
  for (const row of normalized) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }

  const lines = [columns.join(delimiter)];
  for (const row of normalized) {
    lines.push(columns.map((col) => csvCell(row[col], delimiter)).join(delimiter));
  }
  return lines.join('\n');
}

const SAMPLE = `[
  { "name": "Hari Pahwandi", "age": 30, "active": true, "meta": { "city": "Bandung" }, "tags": ["js", "vue"] },
  { "name": "Jane Doe", "age": 25, "active": false, "meta": { "city": "Jakarta" }, "tags": ["css"] }
]`;

export default function JsonToCsv() {
  const [input, setInput] = createSignal(SAMPLE);
  const [delimiter, setDelimiter] = createSignal(',');
  const [flatten, setFlatten] = createSignal(true);
  const [copied, setCopied] = createSignal(false);
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;

  onSettled(() => {
    document.title = 'Hari Pahwandi | JSON to CSV';
    return () => {
      if (copyTimeout) clearTimeout(copyTimeout);
    };
  });

  const result = createMemo(() => {
    const src = input();
    if (!src.trim()) return { csv: '', error: '' };
    try {
      const data = JSON.parse(src);
      return { csv: jsonToCsv(data, delimiter(), flatten()), error: '' };
    } catch (err) {
      return {
        csv: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const copy = async () => {
    const text = result().csv;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  const download = () => {
    const text = result().csv;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const buttonClass = (active: boolean) =>
    [
      'px-3 py-1 text-sm rounded-md border transition-colors cursor-pointer',
      active
        ? 'border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100 font-medium'
        : 'border-stone-950/20 dark:border-stone-50/16 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100',
    ].join(' ');

  return (
    <Section
      title="JSON to CSV"
      description="Convert an array of JSON objects to CSV. Flatten nested objects, pick a delimiter, and download the result."
    >
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <span class="text-stone-500 dark:text-stone-400">Delimiter</span>
          <For each={DELIMITERS}>
            {(d) => (
              <button
                type="button"
                class={buttonClass(delimiter() === d.value)}
                onClick={() => setDelimiter(d.value)}
              >
                {d.label}
              </button>
            )}
          </For>
          <button
            type="button"
            class={buttonClass(flatten())}
            onClick={() => setFlatten((v) => !v)}
          >
            Flatten nested
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={download}
            class="px-3 py-1 text-sm rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors cursor-pointer"
          >
            Download
          </button>
          <button
            type="button"
            onClick={copy}
            class="px-3 py-1 text-sm rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors cursor-pointer"
          >
            {copied() ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
        <label class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">Input (JSON)</span>
          <textarea
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            spellcheck="false"
            class="w-full h-150 font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 resize-y"
          />
        </label>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">Output (CSV)</span>
          <pre class="w-full h-150 overflow-auto font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 whitespace-pre">
            {result().csv}
          </pre>
        </div>
      </div>

      {result().error && (
        <p class="text-sm text-red-600 dark:text-red-400">{result().error}</p>
      )}
    </Section>
  );
}

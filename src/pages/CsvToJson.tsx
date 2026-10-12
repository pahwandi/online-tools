import { createMemo, createSignal, onSettled } from 'solid-js';
import { For } from 'solid-js';
import Section from '../components/Section';
import { actionBtnClass, btnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';

const DELIMITERS = [
  { label: 'Comma', value: ',' },
  { label: 'Semicolon', value: ';' },
  { label: 'Tab', value: '\t' },
  { label: 'Pipe', value: '|' },
];

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
      i += 1;
    } else if (ch === '\r') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += text[i + 1] === '\n' ? 2 : 1;
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (inQuotes) throw new Error('Unclosed quote in CSV input.');
  row.push(field);
  // Drop single trailing empty row from final newline
  const isSingleEmpty = row.length === 1 && row[0] === '';
  if (!(rows.length > 0 && isSingleEmpty && field === '')) {
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function inferValue(raw: string): unknown {
  const s = raw.trim();
  if (s === '') return '';
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

function csvToJson(
  rows: string[][],
  hasHeader: boolean,
  inferTypes: boolean,
  trim: boolean,
): Record<string, unknown>[] {
  if (rows.length === 0) return [];
  const norm = trim
    ? rows.map((r) => r.map((c) => c.trim()))
    : rows.map((r) => r.slice());
  const width = Math.max(...norm.map((r) => r.length));
  const headers: string[] = hasHeader
    ? norm[0].map((h, i) => h === '' ? `field_${i + 1}` : h)
    : Array.from({ length: width }, (_, i) => `column${i + 1}`);
  const body = hasHeader ? norm.slice(1) : norm;
  return body.map((r) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < headers.length; i++) {
      const raw = i < r.length ? r[i] : '';
      obj[headers[i]] = inferTypes ? inferValue(raw) : raw;
    }
    return obj;
  });
}

const SAMPLE = `name,age,active,city
Hari Pahwandi,30,true,Bandung
Jane Doe,25,false,Jakarta`;

export default function CsvToJson() {
  const [input, setInput] = createSignal(SAMPLE);
  const [delimiter, setDelimiter] = createSignal(',');
  const [hasHeader, setHasHeader] = createSignal(true);
  const [inferTypes, setInferTypes] = createSignal(true);
  const [trim, setTrim] = createSignal(true);
  const [indent, setIndent] = createSignal(2);
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | CSV to JSON';
  });

  const result = createMemo(() => {
    const src = input();
    if (!src.trim()) return { text: '', error: '', count: 0 };
    try {
      const rows = parseCsv(src, delimiter());
      const data = csvToJson(rows, hasHeader(), inferTypes(), trim());
      return {
        text: JSON.stringify(data, null, indent()),
        error: '',
        count: data.length,
      };
    } catch (err) {
      return {
        text: '',
        error: err instanceof Error ? err.message : String(err),
        count: 0,
      };
    }
  });

  const download = () => {
    const text = result().text;
    if (!text) return;
    const blob = new Blob([text], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section
      title="CSV to JSON"
      description="Convert CSV to a JSON array. Handles quoted fields, picks delimiter, uses the first row as headers, and infers numbers and booleans."
    >
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <span class="text-stone-500 dark:text-stone-400">Delimiter</span>
          <For each={DELIMITERS}>
            {(d) => (
              <button
                type="button"
                class={btnClass(delimiter() === d.value)}
                onClick={() => setDelimiter(d.value)}
              >
                {d.label}
              </button>
            )}
          </For>
          <button
            type="button"
            class={btnClass(hasHeader())}
            onClick={() => setHasHeader((v) => !v)}
          >
            Header row
          </button>
          <button
            type="button"
            class={btnClass(inferTypes())}
            onClick={() => setInferTypes((v) => !v)}
          >
            Infer types
          </button>
          <button
            type="button"
            class={btnClass(trim())}
            onClick={() => setTrim((v) => !v)}
          >
            Trim
          </button>
          <button
            type="button"
            class={btnClass(indent() === 2)}
            onClick={() => setIndent(2)}
          >
            2
          </button>
          <button
            type="button"
            class={btnClass(indent() === 4)}
            onClick={() => setIndent(4)}
          >
            4
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onClick={download} class={actionBtnClass()}>
            Download
          </button>
          <button
            type="button"
            onClick={() => copy('json', result().text)}
            class={actionBtnClass()}
          >
            {copiedKey() === 'json' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
        <label class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">
            Input (CSV)
            {result().count > 0 && ` — ${result().count} rows`}
          </span>
          <textarea
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            spellcheck="false"
            class="w-full h-150 font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 resize-y"
          />
        </label>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">Output (JSON)</span>
          <pre class="w-full h-150 overflow-auto font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 whitespace-pre">
            {result().text}
          </pre>
        </div>
      </div>

      {result().error && (
        <p class="text-sm text-red-600 dark:text-red-400">{result().error}</p>
      )}
    </Section>
  );
}

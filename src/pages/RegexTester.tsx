import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import Section from '../components/Section';
import { actionBtnClass, btnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';

const SAMPLE_PATTERN = 'user=(\\d+)';
const SAMPLE_TEXT = `2026-09-30 08:12:01 INFO  api - user=42 action=login ip=10.0.0.7
2026-09-30 08:12:44 WARN  api - user=7 action=upload ip=10.0.3.19 size=2048
2026-09-30 08:13:02 ERROR db  - user=42 action=query ip=10.0.0.7 code=500`;

const FLAGS = [
  { flag: 'g', name: 'global', desc: 'find all matches, not just the first' },
  { flag: 'i', name: 'ignoreCase', desc: 'match regardless of case' },
  { flag: 'm', name: 'multiline', desc: '^ and $ match every line' },
  { flag: 's', name: 'dotAll', desc: '. matches newlines too' },
  { flag: 'u', name: 'unicode', desc: 'treat pattern as Unicode code points' },
  { flag: 'y', name: 'sticky', desc: 'match only at lastIndex' },
];

const CHEATS = [
  { pattern: '\\d+', label: 'digits' },
  { pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.]+', label: 'email' },
  { pattern: 'https?:\\/\\/[^\\s]+', label: 'URL' },
  { pattern: '\\b(\\d{1,3}\\.){3}\\d{1,3}\\b', label: 'IPv4' },
  { pattern: '\\d{4}-\\d{2}-\\d{2}', label: 'date' },
  { pattern: '^\\s*(\\w+):\\s*(.*)$', label: 'key: value' },
];

const MAX_MATCHES = 500;

interface MatchInfo {
  index: number;
  text: string;
  groups: { label: string; value: string }[];
}

interface Segment {
  text: string;
  match: boolean;
}

export default function RegexTester() {
  const [pattern, setPattern] = createSignal(SAMPLE_PATTERN);
  const [flags, setFlags] = createSignal('g');
  const [text, setText] = createSignal(SAMPLE_TEXT);
  const [replacement, setReplacement] = createSignal('uid:$1');
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | Regex Tester';
  });

  const toggleFlag = (f: string) =>
    setFlags((s) => (s.includes(f) ? s.replace(f, '') : s + f));

  const parsed = createMemo(() => {
    const p = pattern();
    if (!p) return { error: '', matches: [] as MatchInfo[], segments: [] as Segment[] };
    let scan: RegExp;
    try {
      // always scan globally to enumerate matches, even without the g flag
      scan = new RegExp(p, flags().includes('g') ? flags() : flags() + 'g');
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        matches: [],
        segments: [],
      };
    }

    const src = text();
    const matches: MatchInfo[] = [];
    const segments: Segment[] = [];
    let last = 0;
    let guard = 0;
    let m: RegExpExecArray | null;
    while ((m = scan.exec(src)) !== null && matches.length < MAX_MATCHES) {
      guard++;
      if (guard > 100000) break;
      if (m[0].length === 0) {
        scan.lastIndex++;
        continue; // skip zero-length matches
      }
      const groups: { label: string; value: string }[] = [];
      for (let i = 1; i < m.length; i++) {
        groups.push({ label: `$${i}`, value: m[i] ?? '(unset)' });
      }
      if (m.groups) {
        for (const [name, value] of Object.entries(m.groups)) {
          groups.push({ label: name, value: value ?? '(unset)' });
        }
      }
      matches.push({ index: m.index, text: m[0], groups });
      if (m.index > last) segments.push({ text: src.slice(last, m.index), match: false });
      segments.push({ text: m[0], match: true });
      last = m.index + m[0].length;
    }
    if (last < src.length) segments.push({ text: src.slice(last), match: false });
    return { error: '', matches, segments };
  });

  const replaced = createMemo(() => {
    const p = pattern();
    if (!p || parsed().error) return { text: '', note: '' };
    try {
      const rx = new RegExp(p, flags());
      const out = text().replace(rx, replacement());
      const note = flags().includes('g') ? '' : 'no "g" flag — only the first match is replaced';
      return { text: out, note };
    } catch {
      return { text: '', note: '' };
    }
  });

  return (
    <Section
      title="Regex Tester"
      description="Test a JavaScript regular expression against text — live match highlighting, capture groups, replace preview, and a quick cheatsheet. Everything runs locally."
    >
      <div class="flex gap-2 items-start flex-wrap">
        <span class="font-mono text-sm p-3 text-stone-500 dark:text-stone-400">/</span>
        <input
          type="text"
          value={pattern()}
          onInput={(e) => setPattern(e.currentTarget.value)}
          placeholder="pattern"
          spellcheck="false"
          aria-label="Regular expression"
          class="flex-1 min-w-50 font-mono text-sm p-3 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
        />
        <span class="font-mono text-sm p-3 text-stone-500 dark:text-stone-400">/</span>
        <input
          type="text"
          value={flags()}
          onInput={(e) =>
            setFlags(e.currentTarget.value.replace(/[^gimsuy]/g, ''))
          }
          placeholder="flags"
          spellcheck="false"
          aria-label="Flags"
          class="w-24 font-mono text-sm p-3 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
        />
      </div>

      <div class="flex items-center gap-2 text-sm flex-wrap">
        <span class="text-stone-500 dark:text-stone-400">Flags</span>
        <For each={FLAGS}>
          {(f) => (
            <button
              type="button"
              title={`${f.name} — ${f.desc}`}
              class={['font-mono', btnClass(flags().includes(f.flag))]}
              onClick={() => toggleFlag(f.flag)}
            >
              {f.flag}
            </button>
          )}
        </For>
      </div>

      <Show when={parsed().error}>
        <p class="text-sm text-red-600 dark:text-red-400 break-all">
          {parsed().error}
        </p>
      </Show>

      <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
        <label class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">Test string</span>
          <textarea
            value={text()}
            onInput={(e) => setText(e.currentTarget.value)}
            spellcheck="false"
            class="w-full h-100 font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 resize-y"
          />
        </label>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">
            Highlighted —{' '}
            <Show
              when={!parsed().error}
              fallback={<span class="text-red-600 dark:text-red-400">invalid pattern</span>}
            >
              {parsed().matches.length === 0 ? (
                'no matches'
              ) : (
                <>
                  {parsed().matches.length} match
                  {parsed().matches.length > 1 ? 'es' : ''}
                  <Show when={parsed().matches.length >= MAX_MATCHES}>
                    {' '}(capped at {MAX_MATCHES})
                  </Show>
                </>
              )}
            </Show>
          </span>
          <pre class="w-full h-100 overflow-auto font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 whitespace-pre-wrap break-all">
            <For each={parsed().segments}>
              {(seg) =>
                seg.match ? (
                  <mark class="bg-lime-200 dark:bg-lime-900 text-stone-900 dark:text-stone-100 rounded-sm">
                    {seg.text}
                  </mark>
                ) : (
                  <>{seg.text}</>
                )
              }
            </For>
          </pre>
        </div>
      </div>

      <Show when={parsed().matches.length > 0}>
        <div class="overflow-x-auto rounded-lg border border-stone-950/20 dark:border-stone-50/16">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-stone-100 dark:bg-stone-900 text-left">
                <th class="p-3 font-medium text-stone-500 dark:text-stone-400">#</th>
                <th class="p-3 font-medium text-stone-500 dark:text-stone-400">Index</th>
                <th class="p-3 font-medium text-stone-500 dark:text-stone-400">Match</th>
                <th class="p-3 font-medium text-stone-500 dark:text-stone-400">Groups</th>
              </tr>
            </thead>
            <tbody>
              <For each={parsed().matches.slice(0, 100)}>
                {(m, i) => (
                  <tr class="border-t border-stone-950/10 dark:border-stone-50/10">
                    <td class="p-3 text-stone-500 dark:text-stone-400">{i() + 1}</td>
                    <td class="p-3 text-stone-500 dark:text-stone-400 font-mono">{m.index}</td>
                    <td class="p-3 font-mono text-stone-900 dark:text-stone-100 break-all">{m.text}</td>
                    <td class="p-3 font-mono text-xs text-stone-600 dark:text-stone-400 break-all">
                      <For each={m.groups}>
                        {(g) => (
                          <span class="mr-3">
                            {g.label}: "{g.value}"
                          </span>
                        )}
                      </For>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm text-stone-500 dark:text-stone-400">Replace with</span>
          <input
            type="text"
            value={replacement()}
            onInput={(e) => setReplacement(e.currentTarget.value)}
            placeholder="$1, $2, $&…"
            spellcheck="false"
            aria-label="Replacement"
            class="flex-1 min-w-50 font-mono text-sm p-2 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
          />
          <button
            type="button"
            class={actionBtnClass()}
            onClick={() => copy('replaced', replaced().text)}
          >
            {copiedKey() === 'replaced' ? 'Copied!' : 'Copy result'}
          </button>
        </div>
        <Show when={replaced().text && !parsed().error}>
          <pre class="w-full max-h-60 overflow-auto font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 whitespace-pre-wrap break-all">
            {replaced().text}
          </pre>
        </Show>
        <Show when={replaced().note}>
          <p class="text-xs text-stone-500 dark:text-stone-400 m-0">{replaced().note}</p>
        </Show>
      </div>

      <div class="flex items-center gap-2 text-sm flex-wrap">
        <span class="text-stone-500 dark:text-stone-400">Cheatsheet</span>
        <For each={CHEATS}>
          {(c) => (
            <button
              type="button"
              class={btnClass(pattern() === c.pattern)}
              title={c.pattern}
              onClick={() => {
                setPattern(c.pattern);
                if (!flags().includes('g')) toggleFlag('g');
              }}
            >
              {c.label}
            </button>
          )}
        </For>
      </div>

      <p class="text-xs text-stone-500 dark:text-stone-400">
        Uses the JavaScript <span class="font-mono">RegExp</span> engine. Pathological patterns
        (nested quantifiers like <span class="font-mono">(a+)+</span>) can freeze the tab — the
        same risk exists in production code.
      </p>
    </Section>
  );
}

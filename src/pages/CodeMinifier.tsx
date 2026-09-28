import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import Section from '../components/Section';
import { actionBtnClass, btnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';
import { transformCode, type CodeLanguage, type CodeMode } from '../lib/code';

const SAMPLES: Record<CodeLanguage, string> = {
  html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Demo</title>
    <style>
      body { margin: 0; font-family: sans-serif; }
      h1 { color: teal; }
    </style>
  </head>
  <body>
    <h1>Hello, world</h1>
    <p>This page is a <strong>demo</strong> for the minifier.</p>
    <script>
      const greet = (name) => { console.log('Hello, ' + name + '!'); };
      greet('Hari');
    </script>
  </body>
</html>`,
  css: `/* Page styles */
body {
  margin: 0;
  font-family: sans-serif;
  background: #fafafa;
}

.card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  width: calc(100% - 2rem);
}

.card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}`,
  js: `// Greet the user, with a fallback name.
const greet = (name = 'world') => {
  const message = \`Hello, \${name}!\`;
  console.log(message);
  return message;
};

function sum(numbers) {
  let total = 0;
  for (let i = 0; i < numbers.length; i++) { total += numbers[i]; }
  return total;
}

greet('Hari');
console.log(sum([1, 2, 3]) === 6 ? 'ok' : 'fail');`,
};

const LANGS: { value: CodeLanguage; label: string; ext: string }[] = [
  { value: 'html', label: 'HTML', ext: 'html' },
  { value: 'css', label: 'CSS', ext: 'css' },
  { value: 'js', label: 'JavaScript', ext: 'js' },
];

const formatBytes = (n: number): string => n.toLocaleString('en-US');

export default function CodeMinifier() {
  const [lang, setLang] = createSignal<CodeLanguage>('js');
  const [mode, setMode] = createSignal<CodeMode>('minify');
  const [input, setInput] = createSignal(SAMPLES.js);
  const [indent, setIndent] = createSignal(2);
  const [keepComments, setKeepComments] = createSignal(false);
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | Code Minifier & Formatter';
  });

  const switchLang = (next: CodeLanguage) => {
    setLang(next);
    setInput(SAMPLES[next]);
  };

  const result = createMemo(() => {
    const src = input();
    if (!src.trim()) return { text: '', error: '' };
    try {
      return {
        text: transformCode(src, lang(), mode(), {
          indentSize: indent(),
          keepComments: keepComments(),
        }),
        error: '',
      };
    } catch (err) {
      return { text: '', error: err instanceof Error ? err.message : String(err) };
    }
  });

  const stats = createMemo(() => {
    const before = new TextEncoder().encode(input()).length;
    const after = new TextEncoder().encode(result().text).length;
    const pct = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
    return { before, after, pct };
  });

  const download = () => {
    const text = result().text;
    if (!text) return;
    const ext = LANGS.find((l) => l.value === lang())?.ext ?? 'txt';
    const name = mode() === 'minify' ? `code.min.${ext}` : `code.formatted.${ext}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section
      title="Code Minifier & Formatter"
      description="Minify or beautify HTML, CSS, and JavaScript — with size stats, copy, and download. A lightweight in-browser transformer; everything runs locally."
    >
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <For each={LANGS}>
            {(l) => (
              <button
                type="button"
                class={btnClass(lang() === l.value)}
                onClick={() => switchLang(l.value)}
              >
                {l.label}
              </button>
            )}
          </For>
          <span class="w-px h-5 bg-stone-950/20 dark:bg-stone-50/16 mx-1" />
          <button
            type="button"
            class={btnClass(mode() === 'minify')}
            onClick={() => setMode('minify')}
          >
            Minify
          </button>
          <button
            type="button"
            class={btnClass(mode() === 'format')}
            onClick={() => setMode('format')}
          >
            Format
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onClick={download} class={actionBtnClass()}>
            Download
          </button>
          <button
            type="button"
            onClick={() => copy('out', result().text)}
            class={actionBtnClass()}
          >
            {copiedKey() === 'out' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <Show when={mode() === 'format'}>
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <span class="text-stone-500 dark:text-stone-400">Indent</span>
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
      </Show>

      <Show when={mode() === 'minify' && lang() === 'html'}>
        <div class="flex items-center gap-2 text-sm">
          <button
            type="button"
            class={btnClass(keepComments())}
            onClick={() => setKeepComments((v) => !v)}
          >
            Keep comments
          </button>
        </div>
      </Show>

      <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
        <label class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">Input</span>
          <textarea
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            spellcheck="false"
            class="w-full h-150 font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 resize-y"
          />
        </label>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">Output</span>
          <pre class="w-full h-150 overflow-auto font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 whitespace-pre-wrap break-all">
            {result().text}
          </pre>
        </div>
      </div>

      <Show when={result().error}>
        <p class="text-sm text-red-600 dark:text-red-400">{result().error}</p>
      </Show>

      <p class="text-sm text-stone-500 dark:text-stone-400">
        {formatBytes(stats().before)} bytes → {formatBytes(stats().after)} bytes
        <Show when={stats().pct !== 0}>
          {' '}
          ({stats().pct > 0 ? '−' : '+'}
          {Math.abs(stats().pct)}%)
        </Show>
      </p>
    </Section>
  );
}

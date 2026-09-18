import { createMemo, createSignal, onSettled } from 'solid-js';
import JSON5 from 'json5';
import Section from '../components/Section';

const SAMPLE = `{
  name: 'Hari Pahwandi',
  age: 30,
  roles: ['software engineer', 'writer'],
  isActive: true,
  website: 'https://pahwandi.com',
  socials: { github: 'pahwandi', linkedin: 'pahwandi' },
  tags: ['javascript', 'vue', 'css',],
}`;

export default function JsObjectToJson() {
  const [input, setInput] = createSignal(SAMPLE);
  const [indent, setIndent] = createSignal(2);
  const [copied, setCopied] = createSignal(false);
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;

  onSettled(() => {
    document.title = 'Hari Pahwandi | JS Object to JSON';
    return () => {
      if (copyTimeout) clearTimeout(copyTimeout);
    };
  });

  const result = createMemo(() => {
    const src = input();
    if (!src.trim()) return { text: '', error: '' };
    try {
      const parsed = JSON5.parse(src);
      return { text: JSON.stringify(parsed, null, indent()), error: '' };
    } catch (err) {
      return {
        text: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const copy = async () => {
    const text = result().text;
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

  const buttonClass = (active: boolean) =>
    [
      'px-3 py-1 text-sm rounded-md border transition-colors cursor-pointer',
      active
        ? 'border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100 font-medium'
        : 'border-stone-950/20 dark:border-stone-50/16 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100',
    ].join(' ');

  return (
    <Section
      title="JS Object to JSON"
      description="Paste a JavaScript object literal and get valid, formatted JSON. Unquoted keys, single quotes, comments, and trailing commas are all handled."
    >
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-stone-500 dark:text-stone-400">Indent</span>
          <button
            type="button"
            class={buttonClass(indent() === 2)}
            onClick={() => setIndent(2)}
          >
            2
          </button>
          <button
            type="button"
            class={buttonClass(indent() === 4)}
            onClick={() => setIndent(4)}
          >
            4
          </button>
        </div>
        <button
          type="button"
          onClick={copy}
          class="px-3 py-1 text-sm rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors cursor-pointer"
        >
          {copied() ? 'Copied!' : 'Copy JSON'}
        </button>
      </div>

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
          <pre class="w-full h-150 overflow-auto font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100">
            {result().text}
          </pre>
        </div>
      </div>

      {result().error && (
        <p class="text-sm text-red-600 dark:text-red-400">
          {result().error}
        </p>
      )}
    </Section>
  );
}

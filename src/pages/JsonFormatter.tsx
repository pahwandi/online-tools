import { createMemo, createSignal, onSettled } from 'solid-js';
import { For } from 'solid-js';
import Section from '../components/Section';

type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punct';

interface Token {
  type: TokenType;
  text: string;
}

const TOKEN_RE =
  /"(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;

const tokenClass: Record<TokenType, string> = {
  key: 'text-stone-900 dark:text-stone-100',
  string: 'text-lime-700 dark:text-lime-400',
  number: 'text-amber-700 dark:text-amber-400',
  boolean: 'text-purple-700 dark:text-purple-400',
  null: 'text-stone-500 dark:text-stone-500',
  punct: 'text-stone-600 dark:text-stone-400',
};

function highlight(json: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;

  for (const match of json.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ type: 'punct', text: json.slice(lastIndex, index) });
    }

    const text = match[0];
    let type: TokenType;
    if (text[0] === '"') {
      const rest = json.slice(index + text.length);
      type = /^\s*:/.test(rest) ? 'key' : 'string';
    } else if (text === 'true' || text === 'false') {
      type = 'boolean';
    } else if (text === 'null') {
      type = 'null';
    } else {
      type = 'number';
    }

    tokens.push({ type, text });
    lastIndex = index + text.length;
  }

  if (lastIndex < json.length) {
    tokens.push({ type: 'punct', text: json.slice(lastIndex) });
  }

  return tokens;
}

const SAMPLE =
  '{"name":"Hari Pahwandi","age":30,"roles":["engineer","writer"],"active":true,"meta":{"website":"https://pahwandi.com","tags":["javascript","vue"]},"score":null}';

export default function JsonFormatter() {
  const [input, setInput] = createSignal(SAMPLE);
  const [indent, setIndent] = createSignal(2);
  const [minify, setMinify] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;

  onSettled(() => {
    document.title = 'Hari Pahwandi | JSON Formatter';
    return () => {
      if (copyTimeout) clearTimeout(copyTimeout);
    };
  });

  const result = createMemo(() => {
    const src = input();
    if (!src.trim()) return { ok: true, text: '', error: '' };
    try {
      const parsed = JSON.parse(src);
      const space = minify() ? undefined : indent();
      return { ok: true, text: JSON.stringify(parsed, null, space), error: '' };
    } catch (err) {
      return {
        ok: false,
        text: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const tokens = createMemo(() =>
    result().ok ? highlight(result().text) : [],
  );

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
      title="JSON Formatter"
      description="Prettify, minify, and validate JSON with syntax highlighting. Everything runs locally in your browser."
    >
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <span class="text-stone-500 dark:text-stone-400">Indent</span>
          <button
            type="button"
            class={buttonClass(!minify() && indent() === 2)}
            onClick={() => {
              setIndent(2);
              setMinify(false);
            }}
          >
            2
          </button>
          <button
            type="button"
            class={buttonClass(!minify() && indent() === 4)}
            onClick={() => {
              setIndent(4);
              setMinify(false);
            }}
          >
            4
          </button>
          <button
            type="button"
            class={buttonClass(minify())}
            onClick={() => setMinify(true)}
          >
            Minify
          </button>
        </div>
        <button
          type="button"
          onClick={copy}
          class="px-3 py-1 text-sm rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors cursor-pointer"
        >
          {copied() ? 'Copied!' : 'Copy'}
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
          <pre class="w-full h-150 overflow-auto font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 whitespace-pre">
            <For each={tokens()}>
              {(token) => <span class={tokenClass[token.type]}>{token.text}</span>}
            </For>
          </pre>
        </div>
      </div>

      {result().error && (
        <p class="text-sm text-red-600 dark:text-red-400">{result().error}</p>
      )}
    </Section>
  );
}

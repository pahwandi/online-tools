import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import Section from '../components/Section';
import { actionBtnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';
import {
  BLACK,
  WHITE,
  compositeOver,
  contrastRatio,
  parseColor,
  readableText,
  toHex,
  toHex6,
  toHslString,
  toRgbString,
  type Rgba,
} from '../lib/color';

const PRESETS = [
  '#0ea5e9', '#6366f1', '#22c55e', '#facc15', '#f97316',
  '#ef4444', '#ec4899', '#111111', '#ffffff', 'steelblue',
];

interface CheckResult {
  key: string;
  label: string;
  ratio: number;
  color: Rgba;
}

function grade(ratio: number, threshold: number): boolean {
  return ratio >= threshold;
}

export default function ColorConverter() {
  const [input, setInput] = createSignal('#6366f1');
  const [customBg, setCustomBg] = createSignal('#ffffff');
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | Color Converter';
  });

  const parsed = createMemo(() => parseColor(input()));
  const customParsed = createMemo(() => parseColor(customBg()) ?? WHITE);

  const opaque = createMemo(() => {
    const c = parsed();
    return c ? compositeOver(c, WHITE) : null;
  });

  const formats = createMemo(() => {
    const c = parsed();
    if (!c) return [];
    return [
      { key: 'hex', label: 'HEX', value: toHex(c) },
      { key: 'rgb', label: 'RGB', value: toRgbString(c) },
      { key: 'hsl', label: 'HSL', value: toHslString(c) },
    ];
  });

  const checks = createMemo<CheckResult[]>(() => {
    const c = opaque();
    if (!c) return [];
    const custom = compositeOver(customParsed(), WHITE);
    return [
      { key: 'white', label: 'vs white', ratio: contrastRatio(c, WHITE), color: WHITE },
      { key: 'black', label: 'vs black', ratio: contrastRatio(c, BLACK), color: BLACK },
      { key: 'custom', label: `vs ${toHex6(custom)}`, ratio: contrastRatio(c, custom), color: custom },
    ];
  });

  const pickerValue = createMemo(() => {
    const c = parsed();
    return c ? toHex6(c) : '#000000';
  });

  const errorText = createMemo(() => {
    if (!input().trim()) return '';
    if (parsed()) return '';
    return 'Unrecognized color. Try #6366f1, rgb(99, 102, 241), hsl(239, 84%, 67%), or a name like steelblue.';
  });

  const swatchStyle = createMemo(() => {
    const c = parsed();
    return c ? { background: toRgbString(c) } : { background: 'transparent' };
  });

  const swatchText = createMemo(() => {
    const c = opaque();
    return c ? readableText(c) : '#111111';
  });

  return (
    <Section
      title="Color Converter"
      description="Convert between HEX, RGB, HSL, and named colors, and check WCAG contrast ratios for accessible color pairs. Runs locally in your browser."
    >
      <div class="flex gap-2 flex-wrap items-center">
        <input
          type="text"
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          placeholder="#6366f1, rgb(99 102 241), hsl(239, 84%, 67%), steelblue"
          spellcheck="false"
          aria-label="Color value"
          class="flex-1 min-w-60 font-mono text-sm p-3 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
        />
        <input
          type="color"
          value={pickerValue()}
          onInput={(e) => setInput(e.currentTarget.value)}
          aria-label="Color picker"
          class="h-11 w-14 p-0.5 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 cursor-pointer"
        />
      </div>

      <div class="flex gap-2 flex-wrap items-center text-sm">
        <span class="text-stone-500 dark:text-stone-400">Presets</span>
        <For each={PRESETS}>
          {(preset) => (
            <button
              type="button"
              title={preset}
              aria-label={preset}
              class="h-6 w-6 rounded-md border border-stone-950/20 dark:border-stone-50/16 cursor-pointer p-0"
              style={{ background: preset }}
              onClick={() => setInput(preset)}
            />
          )}
        </For>
      </div>

      <Show when={errorText()}>
        <p class="text-sm text-red-600 dark:text-red-400">{errorText()}</p>
      </Show>

      <Show when={parsed()}>
        <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
          <div class="flex flex-col gap-3">
            <span class="text-sm text-stone-500 dark:text-stone-400">Formats</span>
            <div
              class="h-28 rounded-lg border border-stone-950/20 dark:border-stone-50/16 flex items-center justify-center"
              style={{
                'background-image':
                  'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)',
                'background-size': '16px 16px',
                'background-position': '0 0, 8px 8px',
              }}
            >
              <div
                class="w-full h-full rounded-lg flex items-center justify-center"
                style={swatchStyle()}
              >
                <span class="font-mono text-sm" style={{ color: swatchText() }}>
                  {toHex(parsed()!)}
                </span>
              </div>
            </div>
            <For each={formats()}>
              {(row) => (
                <div class="flex items-center justify-between gap-3 py-1.5 border-b border-stone-950/10 dark:border-stone-50/10 last:border-0">
                  <span class="text-sm text-stone-500 dark:text-stone-400 shrink-0">
                    {row.label}
                  </span>
                  <span class="flex items-center gap-2 min-w-0">
                    <span class="font-mono text-sm text-stone-900 dark:text-stone-100 truncate">
                      {row.value}
                    </span>
                    <button
                      type="button"
                      class="px-2 py-0.5 text-xs rounded border border-stone-950/20 dark:border-stone-50/16 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer shrink-0"
                      onClick={() => copy(row.key, row.value)}
                    >
                      {copiedKey() === row.key ? 'Copied!' : 'Copy'}
                    </button>
                  </span>
                </div>
              )}
            </For>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-sm text-stone-500 dark:text-stone-400">
                WCAG contrast
              </span>
              <span class="flex items-center gap-2">
                <input
                  type="color"
                  value={toHex6(customParsed())}
                  onInput={(e) => setCustomBg(e.currentTarget.value)}
                  aria-label="Custom compare color"
                  class="h-8 w-10 p-0.5 rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 cursor-pointer"
                />
                <button
                  type="button"
                  class={actionBtnClass()}
                  onClick={() => setCustomBg('#ffffff')}
                >
                  White
                </button>
                <button
                  type="button"
                  class={actionBtnClass()}
                  onClick={() => setCustomBg('#000000')}
                >
                  Black
                </button>
              </span>
            </div>

            <For each={checks()}>
              {(check) => (
                <div class="rounded-lg border border-stone-950/20 dark:border-stone-50/16 p-3 flex flex-col gap-2">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-stone-500 dark:text-stone-400">
                      {check.label}
                    </span>
                    <span class="font-mono text-sm text-stone-900 dark:text-stone-100">
                      {check.ratio.toFixed(2)}:1
                    </span>
                  </div>
                  <div class="flex gap-1.5 flex-wrap">
                    <For
                      each={[
                        { name: 'AA', threshold: 4.5 },
                        { name: 'AAA', threshold: 7 },
                        { name: 'AA large', threshold: 3 },
                        { name: 'AAA large', threshold: 4.5 },
                      ]}
                    >
                      {(level) => (
                        <span
                          class={
                            grade(check.ratio, level.threshold)
                              ? 'px-2 py-0.5 text-xs rounded border border-lime-700/40 dark:border-lime-400/40 text-lime-700 dark:text-lime-400'
                              : 'px-2 py-0.5 text-xs rounded border border-red-600/30 dark:border-red-400/30 text-red-600 dark:text-red-400'
                          }
                        >
                          {level.name} {grade(check.ratio, level.threshold) ? 'pass' : 'fail'}
                        </span>
                      )}
                    </For>
                  </div>
                  <div
                    class="rounded-md p-2 text-sm font-medium"
                    style={{
                      background: toRgbString(check.color),
                      color: toRgbString(opaque()!),
                    }}
                  >
                    The quick brown fox jumps over the lazy dog
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </Section>
  );
}

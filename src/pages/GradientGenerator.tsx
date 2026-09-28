import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import Section from '../components/Section';
import { actionBtnClass, btnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';
import { parseColor, toHex6, type Rgba } from '../lib/color';

interface Stop {
  id: number;
  color: string;
  pos: number;
}

interface Preset {
  name: string;
  type: 'linear' | 'radial';
  angle: number;
  stops: { color: string; pos: number }[];
}

const PRESETS: Preset[] = [
  { name: 'Sunset', type: 'linear', angle: 45, stops: [{ color: '#f97316', pos: 0 }, { color: '#ec4899', pos: 100 }] },
  { name: 'Ocean', type: 'linear', angle: 135, stops: [{ color: '#06b6d4', pos: 0 }, { color: '#3b82f6', pos: 100 }] },
  { name: 'Forest', type: 'linear', angle: 90, stops: [{ color: '#22c55e', pos: 0 }, { color: '#065f46', pos: 100 }] },
  { name: 'Violet', type: 'linear', angle: 45, stops: [{ color: '#8b5cf6', pos: 0 }, { color: '#d946ef', pos: 100 }] },
  { name: 'Gold', type: 'linear', angle: 120, stops: [{ color: '#facc15', pos: 0 }, { color: '#84cc16', pos: 100 }] },
  { name: 'Slate', type: 'linear', angle: 160, stops: [{ color: '#334155', pos: 0 }, { color: '#0f172a', pos: 100 }] },
];

const RADIAL_SIZES = [
  'closest-side',
  'closest-corner',
  'farthest-side',
  'farthest-corner',
];

function normalizeStopColor(raw: string): string | null {
  const c: Rgba | null = parseColor(raw);
  return c ? toHex6(c) : null;
}

export default function GradientGenerator() {
  let nextId = 3;
  const [type, setType] = createSignal<'linear' | 'radial'>('linear');
  const [angle, setAngle] = createSignal(45);
  const [shape, setShape] = createSignal<'circle' | 'ellipse'>('circle');
  const [size, setSize] = createSignal('farthest-corner');
  const [posX, setPosX] = createSignal(50);
  const [posY, setPosY] = createSignal(50);
  const [stops, setStops] = createSignal<Stop[]>([
    { id: 1, color: '#6366f1', pos: 0 },
    { id: 2, color: '#ec4899', pos: 100 },
  ]);
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | CSS Gradient Generator';
  });

  const css = createMemo(() => {
    const sorted = [...stops()].sort((a, b) => a.pos - b.pos);
    const stopsCss = sorted
      .map((s) => `${normalizeStopColor(s.color) ?? s.color} ${s.pos}%`)
      .join(', ');
    if (type() === 'linear') return `linear-gradient(${angle()}deg, ${stopsCss})`;
    return `radial-gradient(${shape()} ${size()} at ${posX()}% ${posY()}%, ${stopsCss})`;
  });

  const cssDecl = createMemo(() => `background: ${css()};`);

  const updateStop = (id: number, patch: Partial<Stop>) => {
    setStops((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStop = (id: number) => {
    setStops((arr) => (arr.length > 2 ? arr.filter((s) => s.id !== id) : arr));
  };

  const addStop = () => {
    const arr = [...stops()].sort((a, b) => a.pos - b.pos);
    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2];
    const pos = Math.min(100, Math.round((last.pos + prev.pos) / 2));
    setStops([...stops(), { id: nextId++, color: '#22c55e', pos }]);
  };

  const applyPreset = (preset: Preset) => {
    setType(preset.type);
    setAngle(preset.angle);
    setStops(
      preset.stops.map((s) => ({ id: nextId++, color: s.color, pos: s.pos })),
    );
  };

  return (
    <Section
      title="CSS Gradient Generator"
      description="Design linear and radial CSS gradients — angle, shape, color stops, and a live preview. Copy the ready-to-paste CSS. Runs locally in your browser."
    >
      <div
        class="h-64 rounded-lg border border-stone-950/20 dark:border-stone-50/16"
        style={{ background: css() }}
        role="img"
        aria-label="Gradient preview"
      />

      <div class="rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 p-4 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs text-stone-500 dark:text-stone-400">CSS</span>
          <button
            type="button"
            class={actionBtnClass()}
            onClick={() => copy('css', cssDecl())}
          >
            {copiedKey() === 'css' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre class="font-mono text-sm text-stone-900 dark:text-stone-100 whitespace-pre-wrap break-all m-0">
          {cssDecl()}
        </pre>
      </div>

      <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 text-sm flex-wrap">
            <span class="text-stone-500 dark:text-stone-400">Type</span>
            <button type="button" class={btnClass(type() === 'linear')} onClick={() => setType('linear')}>
              Linear
            </button>
            <button type="button" class={btnClass(type() === 'radial')} onClick={() => setType('radial')}>
              Radial
            </button>
          </div>

          <Show when={type() === 'linear'}>
            <label class="flex flex-col gap-2">
              <span class="text-sm text-stone-500 dark:text-stone-400">
                Angle — {angle()}°
              </span>
              <input
                type="range"
                min="0"
                max="360"
                value={angle()}
                onInput={(e) => setAngle(Number(e.currentTarget.value))}
                class="w-full accent-stone-800 dark:accent-stone-200"
              />
              <span class="flex gap-2 flex-wrap">
                <For each={[0, 45, 90, 135, 180, 225, 270, 315]}>
                  {(a) => (
                    <button type="button" class={btnClass(angle() === a)} onClick={() => setAngle(a)}>
                      {a}°
                    </button>
                  )}
                </For>
              </span>
            </label>
          </Show>

          <Show when={type() === 'radial'}>
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2 text-sm flex-wrap">
                <span class="text-stone-500 dark:text-stone-400">Shape</span>
                <button type="button" class={btnClass(shape() === 'circle')} onClick={() => setShape('circle')}>
                  Circle
                </button>
                <button type="button" class={btnClass(shape() === 'ellipse')} onClick={() => setShape('ellipse')}>
                  Ellipse
                </button>
              </div>
              <div class="flex items-center gap-2 text-sm flex-wrap">
                <span class="text-stone-500 dark:text-stone-400">Size</span>
                <For each={RADIAL_SIZES}>
                  {(s) => (
                    <button type="button" class={btnClass(size() === s)} onClick={() => setSize(s)}>
                      {s}
                    </button>
                  )}
                </For>
              </div>
              <label class="flex flex-col gap-1">
                <span class="text-sm text-stone-500 dark:text-stone-400">
                  Position X — {posX()}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={posX()}
                  onInput={(e) => setPosX(Number(e.currentTarget.value))}
                  class="w-full accent-stone-800 dark:accent-stone-200"
                />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-sm text-stone-500 dark:text-stone-400">
                  Position Y — {posY()}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={posY()}
                  onInput={(e) => setPosY(Number(e.currentTarget.value))}
                  class="w-full accent-stone-800 dark:accent-stone-200"
                />
              </label>
            </div>
          </Show>

          <div class="flex items-center gap-2 text-sm flex-wrap">
            <span class="text-stone-500 dark:text-stone-400">Presets</span>
            <For each={PRESETS}>
              {(preset) => (
                <button
                  type="button"
                  title={preset.name}
                  aria-label={preset.name}
                  class="h-7 w-12 rounded-md border border-stone-950/20 dark:border-stone-50/16 cursor-pointer p-0"
                  style={{
                    background: `linear-gradient(90deg, ${preset.stops
                      .map((s) => `${s.color} ${s.pos}%`)
                      .join(', ')})`,
                  }}
                  onClick={() => applyPreset(preset)}
                />
              )}
            </For>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-stone-500 dark:text-stone-400">
              Color stops ({stops().length})
            </span>
            <button type="button" class={actionBtnClass()} onClick={addStop}>
              + Add stop
            </button>
          </div>

          <For each={stops()}>
            {(stop) => (
              <div class="flex items-center gap-2 flex-wrap rounded-lg border border-stone-950/20 dark:border-stone-50/16 p-3">
                <input
                  type="color"
                  value={normalizeStopColor(stop.color) ?? '#000000'}
                  onInput={(e) => updateStop(stop.id, { color: e.currentTarget.value })}
                  aria-label="Stop color"
                  class="h-9 w-11 p-0.5 rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 cursor-pointer"
                />
                <input
                  type="text"
                  value={stop.color}
                  onInput={(e) => updateStop(stop.id, { color: e.currentTarget.value })}
                  spellcheck="false"
                  aria-label="Stop color value"
                  class="w-28 font-mono text-sm p-2 rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={stop.pos}
                  onInput={(e) => updateStop(stop.id, { pos: Number(e.currentTarget.value) })}
                  aria-label="Stop position"
                  class="flex-1 min-w-24 accent-stone-800 dark:accent-stone-200"
                />
                <span class="font-mono text-xs text-stone-500 dark:text-stone-400 w-10 text-right">
                  {stop.pos}%
                </span>
                <button
                  type="button"
                  aria-label="Remove stop"
                  disabled={stops().length <= 2}
                  class="px-2 py-1 text-xs rounded border border-stone-950/20 dark:border-stone-50/16 text-stone-600 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  onClick={() => removeStop(stop.id)}
                >
                  ✕
                </button>
              </div>
            )}
          </For>
        </div>
      </div>
    </Section>
  );
}

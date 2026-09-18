import { createSignal, onSettled, Show } from 'solid-js';
import { For } from 'solid-js';
import Section from '../components/Section';
import Dropzone from '../components/Dropzone';
import { downloadBlob, loadImage, toBlob } from '../lib/image';
import { actionBtnClass, btnClass } from '../lib/ui';

const MODES = [
  { label: 'Percent', value: 'percent' as const },
  { label: 'Exact', value: 'exact' as const },
  { label: 'Max side', value: 'max' as const },
];

const PRESETS = [
  { label: 'IG Post 1080×1080', w: 1080, h: 1080 },
  { label: 'IG Story 1080×1920', w: 1080, h: 1920 },
  { label: 'Twitter 1200×675', w: 1200, h: 675 },
  { label: 'OG 1200×630', w: 1200, h: 630 },
];

export default function ImageResizer() {
  const [source, setSource] = createSignal<{
    img: HTMLImageElement;
    name: string;
    type: string;
  } | null>(null);
  const [mode, setMode] = createSignal<'percent' | 'exact' | 'max'>('percent');
  const [percent, setPercent] = createSignal(50);
  const [width, setWidth] = createSignal(0);
  const [height, setHeight] = createSignal(0);
  const [maxSide, setMaxSide] = createSignal(1000);
  const [lock, setLock] = createSignal(true);
  const [result, setResult] = createSignal<{
    blob: Blob;
    url: string;
    w: number;
    h: number;
  } | null>(null);
  const [error, setError] = createSignal('');

  let reqId = 0;

  onSettled(() => {
    document.title = 'Hari Pahwandi | Image Resizer';
    return () => {
      const r = result();
      if (r) URL.revokeObjectURL(r.url);
    };
  });

  function targetDims() {
    const s = source()!;
    const nw = s.img.naturalWidth;
    const nh = s.img.naturalHeight;
    if (mode() === 'percent') {
      const f = percent() / 100;
      return { w: Math.max(1, Math.round(nw * f)), h: Math.max(1, Math.round(nh * f)) };
    }
    if (mode() === 'exact') {
      let w = width();
      let h = height();
      if (lock() && w > 0) {
        h = Math.round((w * nh) / nw);
      }
      return { w: w > 0 ? w : nw, h: h > 0 ? h : nh };
    }
    const scale = Math.min(1, maxSide() / Math.max(nw, nh));
    return { w: Math.max(1, Math.round(nw * scale)), h: Math.max(1, Math.round(nh * scale)) };
  }

  async function resize() {
    const s = source();
    if (!s) return;
    const id = ++reqId;
    const { w, h } = targetDims();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(s.img, 0, 0, w, h);
    const outType = ['image/png', 'image/jpeg', 'image/webp'].includes(s.type)
      ? s.type
      : 'image/png';
    try {
      const blob = await toBlob(canvas, outType);
      if (id !== reqId) return;
      const url = URL.createObjectURL(blob);
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { blob, url, w, h };
      });
    } catch {
      // ignore
    }
  }

  async function onFile(file: File) {
    try {
      const img = await loadImage(file);
      setSource({ img, name: file.name, type: file.type });
      setWidth(img.naturalWidth);
      setHeight(img.naturalHeight);
      setError('');
      resize();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load image.');
    }
  }

  function download() {
    const r = result();
    const s = source();
    if (!r || !s) return;
    const ext = r.blob.type.split('/')[1] || 'png';
    downloadBlob(r.blob, `${s.name.replace(/\.[^.]+$/, '')}-resized.${ext}`);
  }

  return (
    <Section
      title="Image Resizer"
      description="Batch-resize images by percentage, exact size, or max dimensions — social-card presets."
    >
      <Dropzone accept="image/*" onFile={onFile}>
        <span class="text-stone-900 dark:text-stone-100">
          Drop an image here, or click to browse
        </span>
        <span class="text-xs text-stone-500 dark:text-stone-400">
          PNG, JPEG, WebP
        </span>
      </Dropzone>

      {source() && (
        <>
          <div class="flex items-center gap-2 text-sm flex-wrap">
            <span class="text-stone-500 dark:text-stone-400">Mode</span>
            <For each={MODES}>
              {(m) => (
                <button
                  type="button"
                  class={btnClass(mode() === m.value)}
                  onClick={() => {
                    setMode(m.value);
                    resize();
                  }}
                >
                  {m.label}
                </button>
              )}
            </For>
          </div>

          <Show when={mode() === 'percent'}>
            <label class="flex flex-col gap-2 text-sm max-w-xl">
              <span class="text-stone-500 dark:text-stone-400">
                Scale: {percent()}%
              </span>
              <input
                type="range"
                min={1}
                max={200}
                value={percent()}
                onInput={(e) => {
                  setPercent(Number(e.currentTarget.value));
                  resize();
                }}
                class="accent-stone-900 dark:accent-stone-100"
              />
            </label>
          </Show>

          <Show when={mode() === 'exact'}>
            <div class="flex items-end gap-3 flex-wrap">
              <label class="flex flex-col gap-2 text-sm">
                <span class="text-stone-500 dark:text-stone-400">Width (px)</span>
                <input
                  type="number"
                  min={1}
                  value={width()}
                  onInput={(e) => {
                    setWidth(Number(e.currentTarget.value));
                    resize();
                  }}
                  class="w-32 px-3 py-1 text-sm rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
                />
              </label>
              <label class="flex flex-col gap-2 text-sm">
                <span class="text-stone-500 dark:text-stone-400">Height (px)</span>
                <input
                  type="number"
                  min={1}
                  value={height()}
                  disabled={lock()}
                  onInput={(e) => {
                    setHeight(Number(e.currentTarget.value));
                    resize();
                  }}
                  class="w-32 px-3 py-1 text-sm rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
                />
              </label>
              <button
                type="button"
                class={btnClass(lock())}
                onClick={() => {
                  setLock((v) => !v);
                  resize();
                }}
              >
                Lock aspect
              </button>
            </div>
          </Show>

          <Show when={mode() === 'max'}>
            <label class="flex flex-col gap-2 text-sm max-w-xl">
              <span class="text-stone-500 dark:text-stone-400">
                Max side: {maxSide()}px
              </span>
              <input
                type="range"
                min={1}
                max={4000}
                value={maxSide()}
                onInput={(e) => {
                  setMaxSide(Number(e.currentTarget.value));
                  resize();
                }}
                class="accent-stone-900 dark:accent-stone-100"
              />
            </label>
          </Show>

          <div class="flex items-center gap-2 text-sm flex-wrap">
            <span class="text-stone-500 dark:text-stone-400">Presets</span>
            <For each={PRESETS}>
              {(p) => (
                <button
                  type="button"
                  class={btnClass(false)}
                  onClick={() => {
                    setMode('exact');
                    setWidth(p.w);
                    setHeight(p.h);
                    setLock(false);
                    resize();
                  }}
                >
                  {p.label}
                </button>
              )}
            </For>
          </div>

          <div class="flex items-center gap-3 text-sm text-stone-500 dark:text-stone-400 flex-wrap">
            <span>
              {source().img.naturalWidth}×{source().img.naturalHeight}
            </span>
            <span>→</span>
            <span>{result() ? `${result()!.w}×${result()!.h}` : '…'}</span>
            <button type="button" class={actionBtnClass()} onClick={download}>
              Download
            </button>
          </div>

          {result() && (
            <img
              src={result()!.url}
              alt="Resized preview"
              class="max-w-full max-h-96 rounded-lg border border-stone-950/20 dark:border-stone-50/16"
            />
          )}
        </>
      )}

      {error() && (
        <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
      )}
    </Section>
  );
}

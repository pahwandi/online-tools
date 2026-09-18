import { createMemo, createSignal, onSettled, Show } from 'solid-js';
import { For } from 'solid-js';
import Section from '../components/Section';
import Dropzone from '../components/Dropzone';
import { downloadBlob, formatBytes, loadImage, toBlob } from '../lib/image';
import { actionBtnClass, btnClass } from '../lib/ui';

const FORMATS = [
  { label: 'JPEG', type: 'image/jpeg' },
  { label: 'WebP', type: 'image/webp' },
  { label: 'PNG', type: 'image/png' },
];

export default function ImageCompressor() {
  const [source, setSource] = createSignal<{
    img: HTMLImageElement;
    name: string;
    size: number;
  } | null>(null);
  const [quality, setQuality] = createSignal(0.8);
  const [format, setFormat] = createSignal('image/jpeg');
  const [result, setResult] = createSignal<{
    blob: Blob;
    url: string;
    size: number;
  } | null>(null);
  const [error, setError] = createSignal('');

  let reqId = 0;

  onSettled(() => {
    document.title = 'Hari Pahwandi | Image Compressor';
    return () => {
      const r = result();
      if (r) URL.revokeObjectURL(r.url);
    };
  });

  async function applyCompression() {
    const s = source();
    if (!s) return;
    const id = ++reqId;
    const canvas = document.createElement('canvas');
    canvas.width = s.img.naturalWidth;
    canvas.height = s.img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(s.img, 0, 0);
    try {
      const blob = await toBlob(
        canvas,
        format(),
        format() === 'image/png' ? undefined : quality(),
      );
      if (id !== reqId) return;
      const url = URL.createObjectURL(blob);
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { blob, url, size: blob.size };
      });
    } catch {
      // ignore export errors
    }
  }

  async function onFile(file: File) {
    try {
      const img = await loadImage(file);
      setSource({ img, name: file.name, size: file.size });
      setError('');
      applyCompression();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load image.');
    }
  }

  function download() {
    const r = result();
    const s = source();
    if (!r || !s) return;
    const ext = format().split('/')[1];
    downloadBlob(r.blob, `${s.name.replace(/\.[^.]+$/, '')}.${ext}`);
  }

  const saved = createMemo<{ text: string; good: boolean } | null>(() => {
    const s = source();
    const r = result();
    if (!s || !r || s.size <= 0) return null;
    const pct = Math.round((1 - r.size / s.size) * 100);
    return {
      text: pct >= 0 ? `−${pct}%` : `+${Math.abs(pct)}%`,
      good: pct >= 0,
    };
  });

  return (
    <Section
      title="Image Compressor"
      description="Compress PNG, JPEG, WebP, and AVIF images — quality presets or target size in KB. Everything runs locally."
    >
      <Dropzone accept="image/*" onFile={onFile}>
        <span class="text-stone-900 dark:text-stone-100">
          Drop an image here, or click to browse
        </span>
        <span class="text-xs text-stone-500 dark:text-stone-400">
          PNG, JPEG, WebP, AVIF
        </span>
      </Dropzone>

      {source() && (
        <>
          <div class="flex items-center gap-2 text-sm flex-wrap">
            <span class="text-stone-500 dark:text-stone-400">Format</span>
            <For each={FORMATS}>
              {(f) => (
                <button
                  type="button"
                  class={btnClass(format() === f.type)}
                  onClick={() => {
                    setFormat(f.type);
                    applyCompression();
                  }}
                >
                  {f.label}
                </button>
              )}
            </For>
          </div>

          <label class="flex flex-col gap-2 text-sm max-w-xl">
            <span class="text-stone-500 dark:text-stone-400">
              Quality: {Math.round(quality() * 100)}%
            </span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.01}
              value={quality()}
              onInput={(e) => {
                setQuality(Number(e.currentTarget.value));
                applyCompression();
              }}
              class="accent-stone-900 dark:accent-stone-100"
            />
          </label>

          <div class="flex items-center gap-3 text-sm text-stone-500 dark:text-stone-400 flex-wrap">
            <span>{formatBytes(source().size)}</span>
            <span>→</span>
            <span>{result() ? formatBytes(result()!.size) : '…'}</span>
            <Show when={saved()} keyed>
              {(sv) => (
                <span
                  class={
                    sv.good
                      ? 'text-lime-700 dark:text-lime-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                >
                  {sv.text}
                </span>
              )}
            </Show>
            <button type="button" class={actionBtnClass()} onClick={download}>
              Download
            </button>
          </div>

          {result() && (
            <img
              src={result()!.url}
              alt="Compressed preview"
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

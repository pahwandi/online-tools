import { createSignal, onSettled } from 'solid-js';
import { For } from 'solid-js';
import Section from '../components/Section';
import Dropzone from '../components/Dropzone';
import { downloadBlob, loadImage, toBlob } from '../lib/image';
import { actionBtnClass, btnClass } from '../lib/ui';

const POSITIONS = ['tl', 'tc', 'tr', 'cl', 'cc', 'cr', 'bl', 'bc', 'br'];

export default function ImageWatermark() {
  const [source, setSource] = createSignal<{
    img: HTMLImageElement;
    name: string;
  } | null>(null);
  const [type, setType] = createSignal<'text' | 'image'>('text');
  const [text, setText] = createSignal('pahwandi');
  const [fontSize, setFontSize] = createSignal(48);
  const [color, setColor] = createSignal('#fafaf9');
  const [opacity, setOpacity] = createSignal(0.5);
  const [rotation, setRotation] = createSignal(-30);
  const [position, setPosition] = createSignal('br');
  const [tile, setTile] = createSignal(false);
  const [watermark, setWatermark] = createSignal<HTMLImageElement | null>(null);
  const [result, setResult] = createSignal<{ blob: Blob; url: string } | null>(
    null,
  );
  const [error, setError] = createSignal('');

  let reqId = 0;
  let wmInput: HTMLInputElement | undefined;

  onSettled(() => {
    document.title = 'Hari Pahwandi | Image Watermark';
    return () => {
      const r = result();
      if (r) URL.revokeObjectURL(r.url);
    };
  });

  function applyWatermark() {
    const s = source();
    if (!s) return;
    const id = ++reqId;
    const W = s.img.naturalWidth;
    const H = s.img.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(s.img, 0, 0);

    let w = 0;
    let h = 0;
    let draw: () => void;

    if (type() === 'text') {
      const t = text() || 'watermark';
      const fs = fontSize();
      ctx.font = `600 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color();
      const m = ctx.measureText(t);
      w = m.width;
      h = fs;
      draw = () => ctx.fillText(t, 0, 0);
    } else {
      const wm = watermark();
      if (!wm) return;
      const maxW = Math.round(W * 0.4);
      const scale = Math.min(1, maxW / wm.naturalWidth);
      w = Math.round(wm.naturalWidth * scale);
      h = Math.round(wm.naturalHeight * scale);
      draw = () => ctx.drawImage(wm, -w / 2, -h / 2, w, h);
    }

    ctx.globalAlpha = opacity();
    const angle = (rotation() * Math.PI) / 180;
    const margin = 24;

    const drawAt = (cx: number, cy: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      draw();
      ctx.restore();
    };

    if (tile()) {
      const gapX = w + 48;
      const gapY = h + 48;
      for (let cy = h / 2 + 24; cy < H + h; cy += gapY) {
        for (let cx = w / 2 + 24; cx < W + w; cx += gapX) {
          drawAt(cx, cy);
        }
      }
    } else {
      const pos = position();
      const cx = pos[1] === 'l' ? margin + w / 2 : pos[1] === 'r' ? W - margin - w / 2 : W / 2;
      const cy = pos[0] === 't' ? margin + h / 2 : pos[0] === 'b' ? H - margin - h / 2 : H / 2;
      drawAt(cx, cy);
    }

    toBlob(canvas, 'image/png').then((blob) => {
      if (id !== reqId) return;
      const url = URL.createObjectURL(blob);
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { blob, url };
      });
    });
  }

  async function onFile(file: File) {
    try {
      const img = await loadImage(file);
      setSource({ img, name: file.name });
      setError('');
      applyWatermark();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load image.');
    }
  }

  async function onWatermarkFile(file: File) {
    try {
      const img = await loadImage(file);
      setWatermark(img);
      applyWatermark();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load watermark.');
    }
  }

  function download() {
    const r = result();
    const s = source();
    if (!r || !s) return;
    downloadBlob(r.blob, `${s.name.replace(/\.[^.]+$/, '')}-watermarked.png`);
  }

  const numberInput =
    'w-32 px-3 py-1 text-sm rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100';

  return (
    <Section
      title="Image Watermark"
      description="Stamp a text or image watermark onto photos — position, opacity, rotation, tiling."
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
            <span class="text-stone-500 dark:text-stone-400">Watermark</span>
            <button
              type="button"
              class={btnClass(type() === 'text')}
              onClick={() => {
                setType('text');
                applyWatermark();
              }}
            >
              Text
            </button>
            <button
              type="button"
              class={btnClass(type() === 'image')}
              onClick={() => {
                setType('image');
                applyWatermark();
              }}
            >
              Image
            </button>
          </div>

          {type() === 'text' ? (
            <div class="flex items-end gap-3 flex-wrap">
              <label class="flex flex-col gap-2 text-sm">
                <span class="text-stone-500 dark:text-stone-400">Text</span>
                <input
                  type="text"
                  value={text()}
                  onInput={(e) => {
                    setText(e.currentTarget.value);
                    applyWatermark();
                  }}
                  class={numberInput}
                />
              </label>
              <label class="flex flex-col gap-2 text-sm">
                <span class="text-stone-500 dark:text-stone-400">Size</span>
                <input
                  type="number"
                  min={8}
                  max={400}
                  value={fontSize()}
                  onInput={(e) => {
                    setFontSize(Number(e.currentTarget.value));
                    applyWatermark();
                  }}
                  class={numberInput}
                />
              </label>
              <label class="flex flex-col gap-2 text-sm">
                <span class="text-stone-500 dark:text-stone-400">Color</span>
                <input
                  type="color"
                  value={color()}
                  onInput={(e) => {
                    setColor(e.currentTarget.value);
                    applyWatermark();
                  }}
                  class="w-12 h-8 p-0 rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 cursor-pointer"
                />
              </label>
            </div>
          ) : (
            <div class="flex items-center gap-3">
              <button
                type="button"
                class={actionBtnClass()}
                onClick={() => wmInput?.click()}
              >
                {watermark() ? 'Change watermark image' : 'Upload watermark image'}
              </button>
              <input
                ref={(el) => {
                  wmInput = el;
                }}
                type="file"
                accept="image/*"
                class="hidden"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (f) onWatermarkFile(f);
                }}
              />
            </div>
          )}

          <label class="flex flex-col gap-2 text-sm max-w-xl">
            <span class="text-stone-500 dark:text-stone-400">
              Opacity: {Math.round(opacity() * 100)}%
            </span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={opacity()}
              onInput={(e) => {
                setOpacity(Number(e.currentTarget.value));
                applyWatermark();
              }}
              class="accent-stone-900 dark:accent-stone-100"
            />
          </label>

          <label class="flex flex-col gap-2 text-sm max-w-xl">
            <span class="text-stone-500 dark:text-stone-400">
              Rotation: {rotation()}°
            </span>
            <input
              type="range"
              min={-180}
              max={180}
              value={rotation()}
              onInput={(e) => {
                setRotation(Number(e.currentTarget.value));
                applyWatermark();
              }}
              class="accent-stone-900 dark:accent-stone-100"
            />
          </label>

          <div class="flex items-center gap-6 flex-wrap">
            <div class="flex flex-col gap-2 text-sm">
              <span class="text-stone-500 dark:text-stone-400">Position</span>
              <div class="grid grid-cols-3 gap-1 w-28">
                <For each={POSITIONS}>
                  {(p) => (
                    <button
                      type="button"
                      aria-label={`Position ${p}`}
                      class={[
                        'h-8 flex items-center justify-center rounded-md border transition-colors cursor-pointer',
                        position() === p
                          ? 'border-stone-900 dark:border-stone-100 bg-stone-200 dark:bg-stone-800'
                          : 'border-stone-950/20 dark:border-stone-50/16 hover:bg-stone-100 dark:hover:bg-stone-900',
                      ]}
                      onClick={() => {
                        setPosition(p);
                        applyWatermark();
                      }}
                    >
                      <span
                        class="w-1.5 h-1.5 rounded-full bg-stone-900 dark:bg-stone-100"
                        style={{
                          'align-self': p[0] === 't' ? 'flex-start' : p[0] === 'b' ? 'flex-end' : 'center',
                          'margin-left': p[1] === 'l' ? '0.5rem' : p[1] === 'r' ? '-0.5rem' : '0',
                        }}
                      />
                    </button>
                  )}
                </For>
              </div>
            </div>

            <button
              type="button"
              class={btnClass(tile())}
              onClick={() => {
                setTile((v) => !v);
                applyWatermark();
              }}
            >
              Tile
            </button>
          </div>

          <div class="flex items-center gap-3">
            <button type="button" class={actionBtnClass()} onClick={download}>
              Download
            </button>
          </div>

          {result() && (
            <img
              src={result()!.url}
              alt="Watermarked preview"
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

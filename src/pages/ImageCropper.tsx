import { createEffect, createMemo, createSignal, onSettled } from 'solid-js';
import { For } from 'solid-js';
import Section from '../components/Section';
import Dropzone from '../components/Dropzone';
import { downloadBlob, loadImage, toBlob } from '../lib/image';
import { actionBtnClass, btnClass } from '../lib/ui';

const MAX_W = 720;
const MAX_H = 540;

const ASPECTS = [
  { label: 'Free', value: null as number | null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
];

interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Drag {
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  orig: Crop;
}

export default function ImageCropper() {
  const [source, setSource] = createSignal<{
    img: HTMLImageElement;
    name: string;
  } | null>(null);
  const [crop, setCrop] = createSignal<Crop>({ x: 0, y: 0, w: 0, h: 0 });
  const [aspect, setAspect] = createSignal<number | null>(1);
  const [shape, setShape] = createSignal<'rect' | 'circle'>('rect');
  const [error, setError] = createSignal('');

  let canvas: HTMLCanvasElement | undefined;
  let drag: Drag | null = null;

  onSettled(() => {
    document.title = 'Hari Pahwandi | Image Cropper';
  });

  const dims = createMemo(() => {
    const s = source();
    if (!s) return { w: 0, h: 0, scale: 1 };
    const scale = Math.min(
      MAX_W / s.img.naturalWidth,
      MAX_H / s.img.naturalHeight,
      1,
    );
    return {
      w: Math.round(s.img.naturalWidth * scale),
      h: Math.round(s.img.naturalHeight * scale),
      scale,
    };
  });

  function redraw() {
    const c = canvas;
    const s = source();
    const d = dims();
    if (!c || !s) return;
    c.width = d.w;
    c.height = d.h;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(s.img, 0, 0, d.w, d.h);

    const cr = crop();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, d.w, cr.y);
    ctx.fillRect(0, cr.y, cr.x, cr.h);
    ctx.fillRect(cr.x + cr.w, cr.y, d.w - cr.x - cr.w, cr.h);
    ctx.fillRect(0, cr.y + cr.h, d.w, d.h - cr.y - cr.h);

    ctx.strokeStyle = '#fafaf9';
    ctx.lineWidth = 2;
    if (shape() === 'circle') {
      ctx.beginPath();
      ctx.ellipse(
        cr.x + cr.w / 2,
        cr.y + cr.h / 2,
        cr.w / 2,
        cr.h / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else {
      ctx.strokeRect(cr.x, cr.y, cr.w, cr.h);
    }

    ctx.fillStyle = '#fafaf9';
    ctx.fillRect(cr.x + cr.w - 6, cr.y + cr.h - 6, 12, 12);
  }

  createEffect(
    () => {
      source();
      crop();
      shape();
    },
    () => redraw(),
  );

  function initCrop() {
    const d = dims();
    const a = aspect() ?? 1;
    let w = Math.round(d.w * 0.8);
    let h = Math.round(w / a);
    if (h > d.h * 0.8) {
      h = Math.round(d.h * 0.8);
      w = Math.round(h * a);
    }
    setCrop({
      x: Math.round((d.w - w) / 2),
      y: Math.round((d.h - h) / 2),
      w,
      h,
    });
  }

  async function onFile(file: File) {
    try {
      const img = await loadImage(file);
      setSource({ img, name: file.name });
      setError('');
      initCrop();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load image.');
    }
  }

  function localXY(e: PointerEvent) {
    const c = canvas!;
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (c.width / rect.width),
      y: (e.clientY - rect.top) * (c.height / rect.height),
    };
  }

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    const d = dims();
    if (!d.w || !d.h) return;
    const p = localXY(e);
    const cr = crop();
    const nearHandle =
      Math.abs(p.x - (cr.x + cr.w)) <= 12 && Math.abs(p.y - (cr.y + cr.h)) <= 12;
    const inside = p.x >= cr.x && p.x <= cr.x + cr.w && p.y >= cr.y && p.y <= cr.y + cr.h;

    if (nearHandle) {
      drag = { mode: 'resize', startX: p.x, startY: p.y, orig: { ...cr } };
    } else if (inside) {
      drag = { mode: 'move', startX: p.x, startY: p.y, orig: { ...cr } };
    } else {
      const c0 = { x: p.x, y: p.y, w: 0, h: 0 };
      setCrop(c0);
      drag = { mode: 'resize', startX: p.x, startY: p.y, orig: c0 };
    }
    canvas?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag) return;
    const d = dims();
    const p = localXY(e);
    const dx = p.x - drag.startX;
    const dy = p.y - drag.startY;

    if (drag.mode === 'move') {
      const c = drag.orig;
      setCrop({
        x: Math.max(0, Math.min(c.x + dx, d.w - c.w)),
        y: Math.max(0, Math.min(c.y + dy, d.h - c.h)),
        w: c.w,
        h: c.h,
      });
    } else {
      const c = drag.orig;
      const a = aspect();
      const maxW = d.w - c.x;
      const maxH = d.h - c.y;
      if (a) {
        let w = Math.max(1, c.w + dx);
        let h = w / a;
        if (w > maxW) {
          w = maxW;
          h = w / a;
        }
        if (h > maxH) {
          h = maxH;
          w = h * a;
        }
        setCrop({ x: c.x, y: c.y, w: Math.max(1, w), h: Math.max(1, h) });
      } else {
        setCrop({
          x: c.x,
          y: c.y,
          w: Math.max(1, Math.min(c.w + dx, maxW)),
          h: Math.max(1, Math.min(c.h + dy, maxH)),
        });
      }
    }
  }

  function onPointerUp() {
    drag = null;
  }

  async function download() {
    const s = source();
    const d = dims();
    const cr = crop();
    if (!s || !d.scale || cr.w <= 0 || cr.h <= 0) return;
    const outW = Math.max(1, Math.round(cr.w / d.scale));
    const outH = Math.max(1, Math.round(cr.h / d.scale));
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    if (shape() === 'circle') {
      ctx.beginPath();
      ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(
      s.img,
      cr.x / d.scale,
      cr.y / d.scale,
      outW,
      outH,
      0,
      0,
      outW,
      outH,
    );
    try {
      const blob = await toBlob(out, 'image/png');
      downloadBlob(blob, `${s.name.replace(/\.[^.]+$/, '')}-cropped.png`);
    } catch {
      // ignore
    }
  }

  return (
    <Section
      title="Image Cropper"
      description="Crop a region — rectangle or circle, drag the box, lock an aspect ratio."
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
            <span class="text-stone-500 dark:text-stone-400">Aspect</span>
            <For each={ASPECTS}>
              {(a) => (
                <button
                  type="button"
                  class={btnClass(aspect() === a.value)}
                  onClick={() => {
                    setAspect(a.value);
                    initCrop();
                  }}
                >
                  {a.label}
                </button>
              )}
            </For>
          </div>

          <div class="flex items-center gap-2 text-sm flex-wrap">
            <span class="text-stone-500 dark:text-stone-400">Shape</span>
            <button
              type="button"
              class={btnClass(shape() === 'rect')}
              onClick={() => setShape('rect')}
            >
              Rectangle
            </button>
            <button
              type="button"
              class={btnClass(shape() === 'circle')}
              onClick={() => setShape('circle')}
            >
              Circle
            </button>
          </div>

          <canvas
            ref={(el) => {
              canvas = el;
            }}
            class="max-w-full h-auto rounded-lg border border-stone-950/20 dark:border-stone-50/16 touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />

          <button type="button" class={actionBtnClass()} onClick={download}>
            Crop & Download
          </button>
        </>
      )}

      {error() && (
        <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
      )}
    </Section>
  );
}

import { createSignal, onSettled, For, onCleanup } from 'solid-js';
import Section from '../components/Section';
import Dropzone from '../components/Dropzone';
import { downloadBlob, formatBytes } from '../lib/image';
import { actionBtnClass, btnClass } from '../lib/ui';

interface Item {
  id: number;
  file: File;
  name: string;
  w: number;
  h: number;
  url: string;
}

const PAGE_SIZES = [
  { label: 'Each page = image size', value: 'image' as const },
  { label: 'A4 Portrait', value: 'a4-p' as const },
  { label: 'A4 Landscape', value: 'a4-l' as const },
  { label: 'Letter Portrait', value: 'letter-p' as const },
  { label: 'Letter Landscape', value: 'letter-l' as const },
];

const PAGE_DIMS: Record<Exclude<(typeof PAGE_SIZES)[number]['value'], 'image'>, [number, number]> =
  {
    'a4-p': [595.28, 841.89],
    'a4-l': [841.89, 595.28],
    'letter-p': [612, 792],
    'letter-l': [792, 612],
  };

export default function ImageToPdf() {
  const [items, setItems] = createSignal<Item[]>([]);
  const [pageSize, setPageSize] = createSignal<'image' | 'a4-p' | 'a4-l' | 'letter-p' | 'letter-l'>(
    'image',
  );
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  let nextId = 0;

  const dropItem = (id: number) => {
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) URL.revokeObjectURL(it.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const move = (id: number, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      const to = idx + dir;
      if (idx === -1 || to < 0 || to >= prev.length) return prev;
      const copy = [...prev];
      const [it] = copy.splice(idx, 1);
      copy.splice(to, 0, it);
      return copy;
    });
  };

  onSettled(() => {
    document.title = 'Hari Pahwandi | Image to PDF';
    return () => {
      for (const it of items()) URL.revokeObjectURL(it.url);
    };
  });
  onCleanup(() => {
    for (const it of items()) URL.revokeObjectURL(it.url);
  });

  async function loadItem(id: number, file: File): Promise<Item> {
    const url = URL.createObjectURL(file);
    try {
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
        img.src = url;
      });
      return { id, file, name: file.name, url, ...dims };
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
  }

  async function onFiles(files: File[]) {
    setError('');
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) {
      setError('No image files selected.');
      return;
    }
    const results = await Promise.allSettled(
      images.map((file) => loadItem(nextId++, file)),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    for (const r of results) {
      if (r.status === 'rejected') {
        setError(r.reason instanceof Error ? r.reason.message : 'Failed to load image.');
      }
    }
    if (ok.length > 0) {
      setItems((prev) => [
        ...prev,
        ...ok.map((r) => (r as PromiseFulfilledResult<Item>).value),
      ]);
    }
  }

  function canvasToBytes(canvas: HTMLCanvasElement, type: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? blob.arrayBuffer().then(resolve, reject)
            : reject(new Error(`Export failed for ${type}.`)),
        type,
      );
    });
  }

  async function imageBytes(file: File, url: string): Promise<{
    bytes: ArrayBuffer;
    format: 'jpg' | 'png';
    w: number;
    h: number;
  }> {
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      return { bytes: await file.arrayBuffer(), format: 'jpg', w: 0, h: 0 };
    }
    if (file.type === 'image/png') {
      return { bytes: await file.arrayBuffer(), format: 'png', w: 0, h: 0 };
    }
    // WebP, AVIF, GIF, BMP, SVG… re-encode via canvas. PNG output keeps alpha.
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`Failed to decode ${file.name}.`));
      im.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return {
      bytes: await canvasToBytes(canvas, 'image/png'),
      format: 'png',
      w: img.naturalWidth,
      h: img.naturalHeight,
    };
  }

  async function generate() {
    const list = items();
    if (list.length === 0 || busy()) return;
    setBusy(true);
    setError('');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.create();
      const ps = pageSize();
      for (const it of list) {
        const { bytes, format, w, h } = await imageBytes(it.file, it.url);
        const img = format === 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
        const iw = img.width || w || it.w;
        const ih = img.height || h || it.h;
        let page: [number, number] = [iw, ih];
        let x = 0;
        let y = 0;
        let dw = iw;
        let dh = ih;
        if (ps !== 'image') {
          page = PAGE_DIMS[ps];
          const scale = Math.min(page[0] / iw, page[1] / ih);
          dw = iw * scale;
          dh = ih * scale;
          x = (page[0] - dw) / 2;
          y = (page[1] - dh) / 2;
        }
        const p = doc.addPage(page);
        p.drawImage(img, { x, y, width: dw, height: dh });
      }
      const out = await doc.save();
      const firstName = list[0].name.replace(/\.[^.]+$/, '');
      downloadBlob(
        new Blob([out as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
        list.length === 1 ? `${firstName}.pdf` : `${firstName}-merged.pdf`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Image to PDF"
      description="Merge images into a PDF — each image becomes one page, in your order, all locally."
    >
      <Dropzone accept="image/*" multiple onFiles={onFiles}>
        <span class="text-stone-900 dark:text-stone-100">
          Drop images here, or click to browse
        </span>
        <span class="text-xs text-stone-500 dark:text-stone-400">
          Select multiple — PNG, JPEG, WebP, AVIF, GIF
        </span>
      </Dropzone>

      {items().length > 0 && (
        <>
          <div class="flex items-center gap-2 text-sm flex-wrap">
            <span class="text-stone-500 dark:text-stone-400">Page size</span>
            <For each={PAGE_SIZES}>
              {(p) => (
                <button
                  type="button"
                  class={btnClass(pageSize() === p.value)}
                  onClick={() => setPageSize(p.value)}
                >
                  {p.label}
                </button>
              )}
            </For>
          </div>

          <ul class="flex flex-col gap-2">
            <For each={items()}>
              {(it, i) => (
                <li class="flex items-center gap-3 rounded-md border border-stone-950/20 dark:border-stone-50/16 px-3 py-2">
                  <span class="text-xs text-stone-500 dark:text-stone-400 w-5">{i() + 1}</span>
                  <img
                    src={it.url}
                    alt={it.name}
                    class="h-12 w-12 object-cover rounded border border-stone-950/10 dark:border-stone-50/10"
                  />
                  <span class="text-sm text-stone-900 dark:text-stone-100 truncate flex-1 min-w-0">
                    {it.name}
                  </span>
                  <span class="text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">
                    {it.w}×{it.h} · {formatBytes(it.file.size)}
                  </span>
                  <button
                    type="button"
                    class={btnClass(false)}
                    disabled={i() === 0}
                    title="Move up"
                    onClick={() => move(it.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class={btnClass(false)}
                    disabled={i() === items().length - 1}
                    title="Move down"
                    onClick={() => move(it.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    class={btnClass(false)}
                    title="Remove"
                    onClick={() => dropItem(it.id)}
                  >
                    ✕
                  </button>
                </li>
              )}
            </For>
          </ul>

          <div class="flex items-center gap-3 text-sm flex-wrap">
            <button
              type="button"
              class={actionBtnClass()}
              disabled={busy()}
              onClick={generate}
            >
              {busy() ? `Generating (${items().length} pages)…` : 'Generate PDF'}
            </button>
            <span class="text-stone-500 dark:text-stone-400">
              {items().length} {items().length === 1 ? 'image' : 'images'},{' '}
              {items().length}{' '}
              {items().length === 1 ? 'page' : 'pages'}
            </span>
          </div>
        </>
      )}

      {error() && <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>}
    </Section>
  );
}

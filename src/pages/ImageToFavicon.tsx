import { createSignal, onSettled } from 'solid-js';
import { For } from 'solid-js';
import Section from '../components/Section';
import Dropzone from '../components/Dropzone';
import { downloadBlob, loadImage, toBlob } from '../lib/image';
import { actionBtnClass } from '../lib/ui';

const SIZES = [16, 32, 48, 180, 192, 512];
const MASKABLE_SIZES = [192, 512];
const PREVIEW_SIZES = [16, 32, 48, 180, 512];

interface FaviconSet {
  urls: Record<string, string>;
  png: Record<string, Blob>;
  ico: Blob;
  manifest: Blob;
  html: string;
}

function drawIcon(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  size: number,
  padding = 0,
) {
  const inner = size - padding * 2;
  const scale = Math.max(inner / img.naturalWidth, inner / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(
    img,
    padding + (inner - dw) / 2,
    padding + (inner - dh) / 2,
    dw,
    dh,
  );
}

async function renderPng(
  img: HTMLImageElement,
  size: number,
  padding = 0,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  drawIcon(ctx, img, size, padding);
  return toBlob(canvas, 'image/png');
}

async function pngsToIco(
  entries: { size: number; blob: Blob }[],
): Promise<Blob> {
  const datas = await Promise.all(entries.map((e) => e.blob.arrayBuffer()));
  const count = entries.length;
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + entrySize * count;
  const totalSize = dataOffset + datas.reduce((a, d) => a + d.byteLength, 0);
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, count, true);

  let offset = dataOffset;
  entries.forEach((e, i) => {
    const base = headerSize + i * entrySize;
    view.setUint8(base, e.size >= 256 ? 0 : e.size);
    view.setUint8(base + 1, e.size >= 256 ? 0 : e.size);
    view.setUint8(base + 2, 0);
    view.setUint8(base + 3, 0);
    view.setUint16(base + 4, 1, true);
    view.setUint16(base + 6, 32, true);
    view.setUint32(base + 8, datas[i].byteLength, true);
    view.setUint32(base + 12, offset, true);
    bytes.set(new Uint8Array(datas[i]), offset);
    offset += datas[i].byteLength;
  });

  return new Blob([buffer], { type: 'image/x-icon' });
}

export default function ImageToFavicon() {
  const [favicons, setFavicons] = createSignal<FaviconSet | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [error, setError] = createSignal('');
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;

  onSettled(() => {
    document.title = 'Hari Pahwandi | Image to Favicon';
    return () => {
      const f = favicons();
      if (f) Object.values(f.urls).forEach((u) => URL.revokeObjectURL(u));
      if (copyTimeout) clearTimeout(copyTimeout);
    };
  });

  async function generate(img: HTMLImageElement, name: string) {
    const png: Record<string, Blob> = {};
    const urls: Record<string, string> = {};

    for (const size of SIZES) {
      const blob = await renderPng(img, size);
      png[`${size}`] = blob;
      urls[`${size}`] = URL.createObjectURL(blob);
    }
    for (const size of MASKABLE_SIZES) {
      const blob = await renderPng(img, size, Math.round(size * 0.1));
      png[`maskable-${size}`] = blob;
      urls[`maskable-${size}`] = URL.createObjectURL(blob);
    }

    const ico = await pngsToIco([
      { size: 16, blob: png['16'] },
      { size: 32, blob: png['32'] },
    ]);

    const base = name.replace(/\.[^.]+$/, '');
    const manifest = {
      name: base,
      short_name: base,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
      theme_color: '#0c0a09',
      background_color: '#0c0a09',
      display: 'standalone',
    };
    const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/manifest+json',
    });

    const html = [
      '<link rel="icon" href="/favicon.ico" sizes="48x48" />',
      '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />',
      '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />',
      '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
      '<link rel="manifest" href="/site.webmanifest" />',
    ].join('\n');

    setFavicons({ urls, png, ico, manifest: manifestBlob, html });
  }

  async function onFile(file: File) {
    try {
      const img = await loadImage(file);
      setError('');
      const prev = favicons();
      if (prev) Object.values(prev.urls).forEach((u) => URL.revokeObjectURL(u));
      setFavicons(null);
      await generate(img, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load image.');
    }
  }

  async function copyHtml() {
    const f = favicons();
    if (!f) return;
    try {
      await navigator.clipboard.writeText(f.html);
      setCopied(true);
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const downloadBtn = (blob: Blob, name: string) => (
    <button
      type="button"
      class={actionBtnClass()}
      onClick={() => downloadBlob(blob, name)}
    >
      {name}
    </button>
  );

  return (
    <Section
      title="Image to Favicon"
      description="Generate a full favicon set from an image — PNG sizes, .ico, maskable icons, and a web manifest."
    >
      <Dropzone accept="image/*" onFile={onFile}>
        <span class="text-stone-900 dark:text-stone-100">
          Drop an image here, or click to browse
        </span>
        <span class="text-xs text-stone-500 dark:text-stone-400">
          PNG, JPEG, WebP
        </span>
      </Dropzone>

      {favicons() && (
        <>
          <div class="flex items-end gap-6 flex-wrap">
            <For each={PREVIEW_SIZES}>
              {(size) => (
                <div class="flex flex-col items-center gap-2">
                  <img
                    src={favicons()!.urls[`${size}`]}
                    alt={`${size}px favicon`}
                    width={size}
                    height={size}
                    class="rounded border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900"
                  />
                  <span class="text-xs text-stone-500 dark:text-stone-400">
                    {size}px
                  </span>
                </div>
              )}
            </For>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            {downloadBtn(favicons()!.ico, 'favicon.ico')}
            {downloadBtn(favicons()!.png['512'], 'favicon-512x512.png')}
            {downloadBtn(favicons()!.png['180'], 'apple-touch-icon.png')}
            {downloadBtn(favicons()!.manifest, 'site.webmanifest')}
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-sm text-stone-500 dark:text-stone-400">
              HTML snippet
            </span>
            <textarea
              readOnly
              value={favicons()!.html}
              class="w-full font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 resize-none"
              rows={5}
            />
            <div>
              <button type="button" class={actionBtnClass()} onClick={copyHtml}>
                {copied() ? 'Copied!' : 'Copy HTML'}
              </button>
            </div>
          </div>
        </>
      )}

      {error() && (
        <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
      )}
    </Section>
  );
}

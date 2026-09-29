import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import Section from '../components/Section';
import Dropzone from '../components/Dropzone';
import { actionBtnClass } from '../lib/ui';
import { downloadBlob, formatBytes, loadImage, toBlob } from '../lib/image';
import {
  readImageMeta,
  stripJpegMetadata,
  stripPngMetadata,
  type ImageMeta,
} from '../lib/exif';

interface Source {
  name: string;
  size: number;
  type: string;
  buf: ArrayBuffer;
  meta: ImageMeta;
  previewUrl: string;
}

interface Output {
  blob: Blob;
  url: string;
  size: number;
  meta: ImageMeta;
  lossless: boolean;
}

function MetaTable(props: { meta: ImageMeta; title: string }) {
  const rows = createMemo(() => props.meta.entries);
  return (
    <div class="flex flex-col gap-2">
      <span class="text-sm text-stone-500 dark:text-stone-400">{props.title}</span>
      <Show
        when={rows().length > 0 || props.meta.gps}
        fallback={
          <p class="text-sm text-stone-500 dark:text-stone-400 m-0">
            No metadata found.
          </p>
        }
      >
        <div class="overflow-x-auto rounded-lg border border-stone-950/20 dark:border-stone-50/16">
          <table class="w-full text-sm border-collapse">
            <tbody>
              <For each={rows()}>
                {(row) => (
                  <tr class="border-t border-stone-950/10 dark:border-stone-50/10 first:border-0">
                    <td
                      class={[
                        'p-3 align-top w-1/3',
                        row.gps
                          ? 'text-red-600 dark:text-red-400 font-medium'
                          : 'text-stone-600 dark:text-stone-400',
                      ]}
                    >
                      {row.name}
                    </td>
                    <td class="p-3 font-mono text-stone-900 dark:text-stone-100 break-all">
                      {row.value}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}

export default function ExifStripper() {
  const [source, setSource] = createSignal<Source | null>(null);
  const [result, setResult] = createSignal<Output | null>(null);
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  onSettled(() => {
    document.title = 'Hari Pahwandi | EXIF Stripper';
    return () => {
      const s = source();
      if (s) URL.revokeObjectURL(s.previewUrl);
      const r = result();
      if (r) URL.revokeObjectURL(r.url);
    };
  });

  async function onFile(file: File) {
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const meta = readImageMeta(buf);
      const img = await loadImage(file);
      const prev = source();
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      const s: Source = {
        name: file.name,
        size: file.size,
        type: file.type,
        buf,
        meta,
        previewUrl: URL.createObjectURL(file),
      };
      setSource(s);
      await strip(s, img);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to process image.');
    } finally {
      setBusy(false);
    }
  }

  async function strip(s: Source, img: HTMLImageElement) {
    let blob: Blob | null = null;
    let lossless = true;

    if (s.meta.kind === 'jpeg') {
      const out = stripJpegMetadata(s.buf);
      if (out) blob = new Blob([out.bytes as BlobPart], { type: 'image/jpeg' });
    } else if (s.meta.kind === 'png') {
      const out = stripPngMetadata(s.buf);
      if (out) blob = new Blob([out.bytes as BlobPart], { type: 'image/png' });
    }

    if (!blob) {
      // WebP/AVIF/other or unexpected structure: re-encode through canvas.
      lossless = false;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable in this browser.');
      ctx.drawImage(img, 0, 0);
      const type = ['image/png', 'image/jpeg', 'image/webp'].includes(s.type)
        ? s.type
        : 'image/png';
      blob = await toBlob(canvas, type, type === 'image/png' ? undefined : 0.95);
    }

    const outMeta = readImageMeta(await blob.arrayBuffer());
    const prev = result();
    if (prev) URL.revokeObjectURL(prev.url);
    setResult({
      blob,
      url: URL.createObjectURL(blob),
      size: blob.size,
      meta: outMeta,
      lossless,
    });
  }

  function download() {
    const s = source();
    const r = result();
    if (!s || !r) return;
    const ext = r.blob.type === 'image/jpeg' ? 'jpg' : r.blob.type.split('/')[1] || 'img';
    const base = s.name.replace(/\.[^.]+$/, '');
    downloadBlob(r.blob, `${base}-clean.${ext}`);
  }

  return (
    <Section
      title="EXIF Stripper"
      description="View and remove hidden metadata — EXIF, GPS location, XMP, comments — from your photos. JPEG and PNG are stripped losslessly (pixels untouched); other formats are re-encoded. Everything runs locally."
    >
      <Dropzone accept="image/*" onFile={onFile}>
        <span class="text-stone-900 dark:text-stone-100">
          Drop an image here, or click to browse
        </span>
        <span class="text-xs text-stone-500 dark:text-stone-400">
          JPEG, PNG, WebP, AVIF — processed entirely in your browser
        </span>
      </Dropzone>

      <Show when={busy()}>
        <p class="text-sm text-stone-500 dark:text-stone-400">Processing…</p>
      </Show>

      {error() && (
        <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
      )}

      <Show when={source()}>
        {(src) => (
          <>
            <Show when={src().meta.gps}>
              <div class="rounded-lg border border-red-600/30 dark:border-red-400/30 bg-red-50 dark:bg-red-950/40 p-4">
                <p class="text-sm text-red-700 dark:text-red-300 m-0 font-medium">
                  ⚠ GPS location found: {src().meta.gps!.lat.toFixed(6)},{' '}
                  {src().meta.gps!.lon.toFixed(6)} — this reveals where the photo was taken.
                </p>
              </div>
            </Show>

            <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
              <MetaTable meta={src().meta} title={`Before — ${src().name}`} />
              <div class="flex flex-col gap-2">
                <Show when={result()}>
                  {(r) => (
                    <MetaTable
                      meta={r().meta}
                      title={r().lossless ? 'After — stripped (lossless)' : 'After — re-encoded'}
                    />
                  )}
                </Show>
              </div>
            </div>

            <Show when={result()}>
              {(r) => (
                <div class="flex items-center gap-3 text-sm text-stone-500 dark:text-stone-400 flex-wrap">
                  <span>Original: {formatBytes(src().size)}</span>
                  <span>→</span>
                  <span>Clean: {formatBytes(r().size)}</span>
                  <Show when={!r().lossless}>
                    <span class="text-xs">
                      (re-encoded — this format has no lossless strip)
                    </span>
                  </Show>
                  <button type="button" class={actionBtnClass()} onClick={download}>
                    Download
                  </button>
                </div>
              )}
            </Show>

            <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
              <div class="flex flex-col gap-2">
                <span class="text-sm text-stone-500 dark:text-stone-400">Preview</span>
                <img
                  src={src().previewUrl}
                  alt="Original"
                  class="max-w-full max-h-96 rounded-lg border border-stone-950/20 dark:border-stone-50/16 object-contain bg-stone-50 dark:bg-stone-950"
                />
              </div>
              <div class="flex flex-col gap-2">
                <span class="text-sm text-stone-500 dark:text-stone-400">Stripped</span>
                <Show when={result()}>
                  {(r) => (
                    <img
                      src={r().url}
                      alt="Stripped"
                      class="max-w-full max-h-96 rounded-lg border border-stone-950/20 dark:border-stone-50/16 object-contain bg-stone-50 dark:bg-stone-950"
                    />
                  )}
                </Show>
              </div>
            </div>

            <p class="text-xs text-stone-500 dark:text-stone-400">
              ICC color profiles are kept so colors stay identical. For JPEG and PNG the pixel
              data is copied byte-for-byte — only metadata segments are removed.
            </p>
          </>
        )}
      </Show>
    </Section>
  );
}

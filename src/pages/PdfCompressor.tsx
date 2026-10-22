import { createSignal, onSettled, Show, For } from 'solid-js';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Section from '../components/Section';
import Dropzone from '../components/Dropzone';
import { downloadBlob, formatBytes } from '../lib/image';
import { actionBtnClass, btnClass } from '../lib/ui';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const DPI_OPTIONS = [
  { label: '72 DPI', value: 72 },
  { label: '96 DPI (default)', value: 96 },
  { label: '150 DPI', value: 150 },
  { label: '200 DPI', value: 200 },
];

export default function PdfCompressor() {
  const [source, setSource] = createSignal<{ file: File; pages: number } | null>(null);
  const [dpi, setDpi] = createSignal(96);
  const [quality, setQuality] = createSignal(0.7);
  const [result, setResult] = createSignal<{ blob: Blob; qualityOut: number; scale: number } | null>(
    null,
  );
  const [busy, setBusy] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [error, setError] = createSignal('');

  let reqId = 0;

  onSettled(() => {
    document.title = 'Hari Pahwandi | PDF Compressor';
  });

  async function onFile(file: File) {
    if (file.type !== 'application/pdf') {
      setError('Please drop a PDF file.');
      return;
    }
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const task = pdfjsLib.getDocument({ data: buffer });
      const pdf = await task.promise;
      setSource({ file, pages: pdf.numPages });
      setResult(null);
      task.destroy();
    } catch (e) {
      setSource(null);
      setError(
        e instanceof Error && /password/i.test(e.message)
          ? 'The PDF is password-protected.'
          : 'Failed to read the PDF.',
      );
    }
  }

  function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    const q = quality();
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Page export failed.'))),
        'image/jpeg',
        q,
      );
    });
  }

  async function compress() {
    const s = source();
    if (!s || busy()) return;
    const id = ++reqId;
    setBusy(true);
    setProgress(0);
    setError('');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const buffer = await s.file.arrayBuffer();
      const task = pdfjsLib.getDocument({ data: buffer });
      const pdf = await task.promise;
      const out = await PDFDocument.create();
      for (let i = 1; i <= pdf.numPages; i++) {
        if (id !== reqId) return;
        setProgress(i);
        const page = await pdf.getPage(i);
        // 1 CSS px per pt ≈ 96 DPI, so scale = dpi / 96.
        const scale = dpi() / 96;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const renderTask = page.render({ canvas, canvasContext: ctx, viewport });
        await renderTask.promise;
        // Page dimensions in pt stay the original PDF's size (CSS px × 72/96).
        const pw = (canvas.width * 72) / 96;
        const ph = (canvas.height * 72) / 96;
        const jpg = await canvasToBlob(canvas);
        const img = await out.embedJpg(await jpg.arrayBuffer());
        const outPage = out.addPage([pw, ph]);
        outPage.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
      }
      if (id !== reqId) return;
      const bytes = await out.save();
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      setResult({ blob, qualityOut: quality(), scale: dpi() / 96 });
      task.destroy();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compress the PDF.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="PDF Compressor"
      description="Shrink PDF files in your browser — pages are downsampled and re-encoded as images."
    >
      <Dropzone accept="application/pdf" onFile={onFile}>
        <span class="text-stone-900 dark:text-stone-100">
          Drop a PDF here, or click to browse
        </span>
        <span class="text-xs text-stone-500 dark:text-stone-400">PDF files only</span>
      </Dropzone>

      {source() && (
        <>
          <div class="flex items-center gap-2 text-sm flex-wrap">
            <span class="text-stone-500 dark:text-stone-400">Resolution</span>
            <For each={DPI_OPTIONS}>
              {(o) => (
                <button
                  type="button"
                  class={btnClass(dpi() === o.value)}
                  onClick={() => setDpi(o.value)}
                >
                  {o.label}
                </button>
              )}
            </For>
          </div>

          <label class="flex flex-col gap-2 text-sm max-w-xl">
            <span class="text-stone-500 dark:text-stone-400">
              JPEG quality: {Math.round(quality() * 100)}%
            </span>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(quality() * 100)}
              onInput={(e) => setQuality(Number(e.currentTarget.value) / 100)}
              class="accent-stone-900 dark:accent-stone-100"
            />
          </label>

          <div class="flex items-center gap-3 text-sm flex-wrap">
            <button
              type="button"
              class={actionBtnClass()}
              disabled={busy()}
              onClick={compress}
            >
              {busy() ? `Compressing page ${progress()} of ${source()!.pages}…` : 'Compress PDF'}
            </button>
            <span class="text-stone-500 dark:text-stone-400">
              {source()!.file.name} · {source()!.pages} page{source()!.pages === 1 ? '' : 's'} ·{' '}
              {formatBytes(source()!.file.size)}
            </span>
          </div>
        </>
      )}

      <Show when={result()}>
        <div class="flex items-center gap-3 text-sm flex-wrap">
          <button
            type="button"
            class={actionBtnClass()}
            onClick={() =>
              result() &&
              downloadBlob(
                result()!.blob,
                (source()?.file.name ?? 'document').replace(/\.pdf$/, '') + '-compressed.pdf',
              )
            }
          >
            Download
          </button>
          <span class="text-stone-500 dark:text-stone-400">
            {formatBytes(source()?.file.size ?? 0)} → {formatBytes(result()!.blob.size)} (
            {Math.round((result()!.blob.size / (source()?.file.size || 1)) * 100)}%)
          </span>
        </div>
      </Show>

      {error() && <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>}
    </Section>
  );
}

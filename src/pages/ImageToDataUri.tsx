import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import Section from '../components/Section';
import Dropzone from '../components/Dropzone';
import { actionBtnClass, btnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';
import { formatBytes } from '../lib/image';

type Mode = 'datauri' | 'base64' | 'css' | 'html';
type SvgEncoding = 'base64' | 'utf8';

const MODES: { value: Mode; label: string }[] = [
  { value: 'datauri', label: 'Data URI' },
  { value: 'base64', label: 'Base64 only' },
  { value: 'css', label: 'CSS url()' },
  { value: 'html', label: 'HTML <img>' },
];

const LARGE_BYTES = 512 * 1024;

export default function ImageToDataUri() {
  const [file, setFile] = createSignal<{ name: string; size: number } | null>(null);
  const [dataUri, setDataUri] = createSignal('');
  const [svgText, setSvgText] = createSignal('');
  const [mode, setMode] = createSignal<Mode>('datauri');
  const [svgEncoding, setSvgEncoding] = createSignal<SvgEncoding>('base64');
  const [error, setError] = createSignal('');
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | Image to Data URI';
  });

  const isSvg = createMemo(() => svgText() !== '');

  const uri = createMemo(() => {
    if (isSvg() && svgEncoding() === 'utf8') {
      return `data:image/svg+xml,${encodeURIComponent(svgText()).replace(/%20/g, ' ')}`;
    }
    return dataUri();
  });

  const output = createMemo(() => {
    const u = uri();
    if (!u) return '';
    const name = file()?.name.replace(/\.[^.]+$/, '') ?? 'image';
    switch (mode()) {
      case 'base64':
        return isSvg() && svgEncoding() === 'utf8' ? u.slice(u.indexOf(',') + 1) : u.split(',')[1] ?? u;
      case 'css':
        return `url("${u}")`;
      case 'html':
        return `<img src="${u}" alt="${name}" />`;
      default:
        return u;
    }
  });

  const stats = createMemo(() => {
    const src = file();
    if (!src) return null;
    const len = output().length;
    const pct = src.size > 0 ? Math.round(((len - src.size) / src.size) * 100) : 0;
    return { srcBytes: src.size, outChars: len, pct };
  });

  function onFile(f: File) {
    setError('');
    setDataUri('');
    setSvgText('');
    setFile({ name: f.name, size: f.size });

    const reader = new FileReader();
    reader.onload = () => setDataUri(String(reader.result ?? ''));
    reader.onerror = () => setError('Failed to read the file.');
    reader.readAsDataURL(f);

    if (f.type === 'image/svg+xml') {
      const textReader = new FileReader();
      textReader.onload = () => setSvgText(String(textReader.result ?? ''));
      textReader.readAsText(f);
    }
  }

  return (
    <Section
      title="Image to Data URI"
      description="Convert an image to a base64 data URI — with CSS and HTML snippets, URL-encoded SVG output, and size stats. Useful for small icons and inline SVGs; everything runs locally."
    >
      <Dropzone accept="image/*" onFile={onFile}>
        <span class="text-stone-900 dark:text-stone-100">
          Drop an image here, or click to browse
        </span>
        <span class="text-xs text-stone-500 dark:text-stone-400">
          PNG, JPEG, WebP, AVIF, GIF, SVG
        </span>
      </Dropzone>

      {error() && (
        <p class="text-sm text-red-600 dark:text-red-400">{error()}</p>
      )}

      <Show when={file() && dataUri()}>
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <span class="text-stone-500 dark:text-stone-400">Output</span>
          <For each={MODES}>
            {(m) => (
              <button
                type="button"
                class={[m.value === 'html' ? '' : 'font-mono', btnClass(mode() === m.value)]}
                onClick={() => setMode(m.value)}
              >
                {m.label}
              </button>
            )}
          </For>
        </div>

        <Show when={isSvg()}>
          <div class="flex items-center gap-2 text-sm flex-wrap">
            <span class="text-stone-500 dark:text-stone-400">SVG encoding</span>
            <button
              type="button"
              class={btnClass(svgEncoding() === 'base64')}
              onClick={() => setSvgEncoding('base64')}
            >
              base64
            </button>
            <button
              type="button"
              class={btnClass(svgEncoding() === 'utf8')}
              onClick={() => setSvgEncoding('utf8')}
            >
              URL-encoded (smaller)
            </button>
          </div>
        </Show>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <span class="text-sm text-stone-500 dark:text-stone-400 flex-1">Result</span>
            <button
              type="button"
              class={actionBtnClass()}
              onClick={() => copy('out', output())}
            >
              {copiedKey() === 'out' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <textarea
            readonly
            value={output()}
            spellcheck="false"
            aria-label="Data URI output"
            class="w-full h-45 font-mono text-xs leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 resize-y break-all"
          />
        </div>

        <Show when={stats()}>
          {(s) => (
            <p class="text-sm text-stone-500 dark:text-stone-400 m-0">
              {s().srcBytes > 0 && formatBytes(s().srcBytes)} file →{' '}
              {formatBytes(s().outChars)} of text
              <Show when={s().pct !== 0}>
                {' '}({s().pct > 0 ? '+' : '−'}
                {Math.abs(s().pct)}%)
              </Show>
            </p>
          )}
        </Show>

        <Show when={file()!.size > LARGE_BYTES}>
          <p class="text-sm text-amber-600 dark:text-amber-400 m-0">
            Heads-up: files above ~512 KB make heavy data URIs — they cannot be cached or
            streamed separately. <a href="/image-compressor">Compress the image</a> first.
          </p>
        </Show>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">Preview</span>
          <div class="p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 [background-image:linear-gradient(45deg,rgba(120,113,108,.15)_25%,transparent_25%,transparent_75%,rgba(120,113,108,.15)_75%),linear-gradient(45deg,rgba(120,113,108,.15)_25%,transparent_25%,transparent_75%,rgba(120,113,108,.15)_75%)] [background-size:16px_16px] [background-position:0_0,8px_8px]">
            <img
              src={uri()}
              alt="Data URI preview"
              class="max-h-64 mx-auto object-contain"
            />
          </div>
        </div>
      </Show>
    </Section>
  );
}

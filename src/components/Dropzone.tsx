import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';

interface Props {
  accept: string;
  onFile: (file: File) => void;
  children: JSX.Element;
}

export default function Dropzone(props: Props) {
  const [dragging, setDragging] = createSignal(false);
  let input: HTMLInputElement | undefined;

  const pick = (file: File | undefined) => {
    if (file) props.onFile(file);
  };

  return (
    <div
      class={[
        'flex flex-col items-center justify-center gap-2 py-12 px-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
        dragging()
          ? 'border-stone-900 dark:border-stone-100 bg-stone-100 dark:bg-stone-900'
          : 'border-stone-950/20 dark:border-stone-50/16 hover:border-stone-400 dark:hover:border-stone-500',
      ]}
      onClick={() => input?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer?.files?.[0]);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          input?.click();
        }
      }}
    >
      <input
        ref={(el) => {
          input = el;
        }}
        type="file"
        accept={props.accept}
        class="hidden"
        onChange={(e) => {
          pick(e.currentTarget.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
      {props.children}
    </div>
  );
}

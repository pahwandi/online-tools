import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';

interface Props {
  accept: string;
  /** Required unless `multiple` and `onFiles` are set. */
  onFile?: (file: File) => void;
  multiple?: boolean;
  /** Called instead of `onFile` when `multiple` is set. */
  onFiles?: (files: File[]) => void;
  children: JSX.Element;
}

export default function Dropzone(props: Props) {
  const [dragging, setDragging] = createSignal(false);
  let input: HTMLInputElement | undefined;

  const pick = (files: FileList | undefined | null) => {
    if (!files || files.length === 0) return;
    if (props.multiple && props.onFiles) {
      props.onFiles(Array.from(files));
    } else if (props.onFile) {
      props.onFile(files[0]);
    }
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
        pick(e.dataTransfer?.files);
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
        multiple={props.multiple}
        class="hidden"
        onChange={(e) => {
          pick(e.currentTarget.files);
          e.currentTarget.value = '';
        }}
      />
      {props.children}
    </div>
  );
}

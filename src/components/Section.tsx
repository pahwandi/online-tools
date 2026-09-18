import type { ParentProps } from 'solid-js';

interface Props {
  title?: string;
  description?: string;
  class?: string;
  id?: string;
}

export default function Section(props: ParentProps<Props>) {
  return (
    <section class={['section', props.class]} id={props.id}>
      <div class="section__header">
        {props.title && <h3 class="section__title">{props.title}</h3>}
        {props.description && (
          <p class="text-stone-500 dark:text-stone-400 text-sm">
            {props.description}
          </p>
        )}
      </div>
      {props.children}
    </section>
  );
}

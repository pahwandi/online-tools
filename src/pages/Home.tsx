import { For, onSettled } from 'solid-js';
import Section from '../components/Section';
import { TOOL_CATEGORIES } from '../consts';

export default function Home() {
  onSettled(() => {
    document.title = 'Hari Pahwandi | Online Tools';
  });

  return (
    <>
      <section class="px-20 max-[65rem]:px-0 max-[60rem]:px-6 py-16 border-b border-stone-950/20 dark:border-stone-50/16">
        <div class="max-w-260 max-[60rem]:px-0">
          <h1 class="text-[2.375rem] max-[60rem]:text-[1.375rem] font-bold text-stone-900 dark:text-stone-100 leading-tight mb-6 max-w-160">
            Online Tools
          </h1>
          <p class="text-stone-900 dark:text-stone-100 text-base max-[60rem]:text-sm leading-loose pb-4 max-w-xl">
            Free, privacy-friendly tools that run entirely in your browser.
          </p>
        </div>
      </section>

      <For each={TOOL_CATEGORIES}>
        {(category) => (
          <Section title={category.name}>
            <ul class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8 list-none m-0 p-0">
              <For each={category.tools}>
                {(tool) => (
                  <li>
                    <a href={tool.href} class="group block no-underline!">
                      <h4 class="text-lg text-stone-900 dark:text-stone-100 group-hover:underline mb-1">
                        {tool.name}
                      </h4>
                      <p class="text-xs text-stone-500 dark:text-stone-400">
                        {tool.description}
                      </p>
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </Section>
        )}
      </For>
    </>
  );
}

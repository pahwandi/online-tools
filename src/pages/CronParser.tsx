import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import Section from '../components/Section';
import { btnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';
import { parseCron } from '../lib/cron';

const SAMPLE = '*/15 9-17 * * 1-5';

const PRESETS = [
  '* * * * *',
  '*/5 * * * *',
  '0 0 * * *',
  '30 4 * * 0',
  '0 9 * * 1-5',
  '0 0 1 * *',
  '0 0 1 1 *',
  '0 */6 * * *',
];

const pad = (n: number): string => String(n).padStart(2, '0');

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatRun(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function relativeFromNow(d: Date): string {
  const diff = d.getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'in less than a minute';
  if (mins < 60) return `in ${mins} minute${mins > 1 ? 's' : ''}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days > 1 ? 's' : ''}`;
}

export default function CronParser() {
  const [expr, setExpr] = createSignal(SAMPLE);
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | Cron Parser';
  });

  const info = createMemo(() => parseCron(expr()));

  const bothDaysRestricted = createMemo(() => {
    const dom = info().rows.find((r) => r.def.key === 'dom');
    const dow = info().rows.find((r) => r.def.key === 'dow');
    return Boolean(
      dom && dow && !dom.parsed.isWildcard && !dow.parsed.isWildcard,
    );
  });

  return (
    <Section
      title="Cron Parser"
      description="Explain a cron expression in plain English, validate each field, and preview the next run times. Supports 5 fields (minute-first) and 6 fields (second-first). Runs locally in your browser."
    >
      <div class="flex gap-2 flex-wrap">
        <input
          type="text"
          value={expr()}
          onInput={(e) => setExpr(e.currentTarget.value)}
          placeholder="* * * * *"
          spellcheck="false"
          aria-label="Cron expression"
          class="flex-1 min-w-60 font-mono text-sm p-3 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
        />
        <button
          type="button"
          class={btnClass(false)}
          onClick={() => copy('expr', expr().trim())}
        >
          {copiedKey() === 'expr' ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div class="flex items-center gap-2 text-sm flex-wrap">
        <span class="text-stone-500 dark:text-stone-400">Presets</span>
        <For each={PRESETS}>
          {(preset) => (
            <button
              type="button"
              class={['font-mono', btnClass(expr().trim() === preset)]}
              onClick={() => setExpr(preset)}
            >
              {preset}
            </button>
          )}
        </For>
      </div>

      <Show when={info().error}>
        <p class="text-sm text-red-600 dark:text-red-400">{info().error}</p>
      </Show>

      <Show when={!info().error && !info().empty}>
        <div class="rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 p-4">
          <span class="text-xs text-stone-500 dark:text-stone-400">
            Plain English
          </span>
          <p class="text-base text-stone-900 dark:text-stone-100 font-medium leading-relaxed">
            {info().description}
          </p>
          <Show when={bothDaysRestricted()}>
            <p class="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Note: when both day-of-month and day-of-week are restricted, standard
              cron matches either one (OR), not both.
            </p>
          </Show>
        </div>

        <div class="overflow-x-auto rounded-lg border border-stone-950/20 dark:border-stone-50/16">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-stone-100 dark:bg-stone-900 text-left">
                <th class="p-3 font-medium text-stone-500 dark:text-stone-400">Field</th>
                <th class="p-3 font-medium text-stone-500 dark:text-stone-400">Value</th>
                <th class="p-3 font-medium text-stone-500 dark:text-stone-400">Allowed</th>
                <th class="p-3 font-medium text-stone-500 dark:text-stone-400">Meaning</th>
              </tr>
            </thead>
            <tbody>
              <For each={info().rows}>
                {(row) => (
                  <tr class="border-t border-stone-950/10 dark:border-stone-50/10">
                    <td class="p-3 text-stone-600 dark:text-stone-400">{row.def.label}</td>
                    <td class="p-3 font-mono text-stone-900 dark:text-stone-100">{row.raw}</td>
                    <td class="p-3 text-stone-500 dark:text-stone-400 text-xs">{row.def.hint}</td>
                    <td class="p-3 text-stone-900 dark:text-stone-100">{row.meaning}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">
            Next 5 runs (
            {Intl.DateTimeFormat().resolvedOptions().timeZone}, local time)
          </span>
          <Show
            when={info().runs.length > 0}
            fallback={
              <p class="text-sm text-stone-500 dark:text-stone-400">
                No matching time found within the next few years.
              </p>
            }
          >
            <ul class="list-none m-0 p-0 flex flex-col">
              <For each={info().runs}>
                {(run) => (
                  <li class="flex items-center justify-between gap-3 py-1.5 border-b border-stone-950/10 dark:border-stone-50/10 last:border-0">
                    <span class="font-mono text-sm text-stone-900 dark:text-stone-100">
                      {formatRun(run)}
                    </span>
                    <span class="text-xs text-stone-500 dark:text-stone-400 shrink-0">
                      {relativeFromNow(run)}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </Show>
    </Section>
  );
}

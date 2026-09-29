import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import Section from '../components/Section';
import { actionBtnClass, btnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';
import { formatRunDate, parseCron, relativeFromNow } from '../lib/cron';

type Freq = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' | 'interval';
type IntervalUnit = 'minute' | 'hour' | 'day';

const FREQS: { value: Freq; label: string }[] = [
  { value: 'minute', label: 'Every minute' },
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
  { value: 'interval', label: 'Interval' },
];

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(n) || min));

const numInputClass =
  'w-20 font-mono text-sm p-2 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100';

export default function CronGenerator() {
  const [freq, setFreq] = createSignal<Freq>('day');
  const [hour, setHour] = createSignal(9);
  const [minute, setMinute] = createSignal(0);
  const [dow, setDow] = createSignal<number[]>([1, 2, 3, 4, 5]);
  const [dom, setDom] = createSignal<number[]>([1]);
  const [months, setMonths] = createSignal<number[]>([1]);
  const [everyN, setEveryN] = createSignal(5);
  const [everyUnit, setEveryUnit] = createSignal<IntervalUnit>('minute');
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | Cron Generator';
  });

  const csv = (values: number[]): string => (values.length ? [...values].sort((a, b) => a - b).join(',') : '*');

  const expr = createMemo(() => {
    const m = minute();
    const h = hour();
    switch (freq()) {
      case 'minute':
        return '* * * * *';
      case 'hour':
        return `${m} * * * *`;
      case 'day':
        return `${m} ${h} * * *`;
      case 'week':
        return `${m} ${h} * * ${csv(dow())}`;
      case 'month':
        return `${m} ${h} ${csv(dom())} * *`;
      case 'year':
        return `${m} ${h} ${csv(dom())} ${csv(months())} *`;
      case 'interval': {
        const n = clamp(everyN(), 1, everyUnit() === 'minute' ? 59 : everyUnit() === 'hour' ? 23 : 31);
        if (everyUnit() === 'minute') return `*/${n} * * * *`;
        if (everyUnit() === 'hour') return `${m} */${n} * * *`;
        return `${m} ${h} */${n} * *`;
      }
    }
  });

  const info = createMemo(() => parseCron(expr()));

  const toggle = (
    list: number[],
    v: number,
    set: (next: number[]) => void,
  ) => {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const showTime = createMemo(() =>
    ['day', 'week', 'month', 'year'].includes(freq()) ||
    (freq() === 'interval' && everyUnit() === 'day'),
  );
  const showMinuteOnly = createMemo(() => freq() === 'hour' || (freq() === 'interval' && everyUnit() === 'hour'));

  return (
    <Section
      title="Cron Generator"
      description="Build a cron expression from a form — frequency, time, weekdays, month days, or intervals — with a plain-English description and the next run times. The inverse of the Cron Parser."
    >
      <div class="flex items-center gap-2 text-sm flex-wrap">
        <span class="text-stone-500 dark:text-stone-400">Frequency</span>
        <For each={FREQS}>
          {(f) => (
            <button
              type="button"
              class={btnClass(freq() === f.value)}
              onClick={() => setFreq(f.value)}
            >
              {f.label}
            </button>
          )}
        </For>
      </div>

      <Show when={freq() === 'interval'}>
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <span class="text-stone-500 dark:text-stone-400">Every</span>
          <input
            type="number"
            min={1}
            max={59}
            value={everyN()}
            onInput={(e) => setEveryN(clamp(Number(e.currentTarget.value), 1, 59))}
            aria-label="Interval"
            class={numInputClass}
          />
          <For each={['minute', 'hour', 'day'] as IntervalUnit[]}>
            {(u) => (
              <button
                type="button"
                class={btnClass(everyUnit() === u)}
                onClick={() => setEveryUnit(u)}
              >
                {u}{everyN() > 1 ? 's' : ''}
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={showMinuteOnly()}>
        <label class="flex items-center gap-2 text-sm">
          <span class="text-stone-500 dark:text-stone-400">At minute</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minute()}
            onInput={(e) => setMinute(clamp(Number(e.currentTarget.value), 0, 59))}
            aria-label="Minute"
            class={numInputClass}
          />
        </label>
      </Show>

      <Show when={showTime()}>
        <label class="flex items-center gap-2 text-sm">
          <span class="text-stone-500 dark:text-stone-400">At time</span>
          <input
            type="number"
            min={0}
            max={23}
            value={hour()}
            onInput={(e) => setHour(clamp(Number(e.currentTarget.value), 0, 23))}
            aria-label="Hour"
            class={numInputClass}
          />
          <span class="text-stone-500 dark:text-stone-400">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minute()}
            onInput={(e) => setMinute(clamp(Number(e.currentTarget.value), 0, 59))}
            aria-label="Minute"
            class={numInputClass}
          />
          <span class="text-xs text-stone-500 dark:text-stone-400">
            ({Intl.DateTimeFormat().resolvedOptions().timeZone})
          </span>
        </label>
      </Show>

      <Show when={freq() === 'week'}>
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <span class="text-stone-500 dark:text-stone-400">On days</span>
          <For each={DOW_LABELS}>
            {(label, d) => (
              <button
                type="button"
                class={btnClass(dow().includes(d()))}
                onClick={() => toggle(dow(), d(), setDow)}
              >
                {label}
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={freq() === 'month' || freq() === 'year'}>
        <div class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">
            On day{freq() === 'month' ? 's' : ''} of month
          </span>
          <div class="flex gap-1.5 flex-wrap max-w-xl">
            <For each={Array.from({ length: 31 }, (_, i) => i + 1)}>
              {(d) => (
                <button
                  type="button"
                  class={[
                    'w-9 font-mono',
                    dom().includes(d)
                      ? 'px-1 py-1 text-sm rounded-md border border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100 font-medium transition-colors cursor-pointer'
                      : 'px-1 py-1 text-sm rounded-md border border-stone-950/20 dark:border-stone-50/16 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer',
                  ]}
                  onClick={() => toggle(dom(), d, setDom)}
                >
                  {d}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      <Show when={freq() === 'year'}>
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <span class="text-stone-500 dark:text-stone-400">In months</span>
          <For each={MONTH_LABELS}>
            {(label, m) => (
              <button
                type="button"
                class={btnClass(months().includes(m() + 1))}
                onClick={() => toggle(months(), m() + 1, setMonths)}
              >
                {label}
              </button>
            )}
          </For>
        </div>
      </Show>

      <div class="rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 p-4 flex flex-col gap-3">
        <div class="flex items-center gap-2 flex-wrap">
          <code class="flex-1 min-w-50 font-mono text-lg text-stone-900 dark:text-stone-100 break-all">
            {expr()}
          </code>
          <button
            type="button"
            class={actionBtnClass()}
            onClick={() => copy('expr', expr())}
          >
            {copiedKey() === 'expr' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p class="text-sm text-stone-900 dark:text-stone-100 font-medium m-0 leading-relaxed">
          {info().description}
        </p>
      </div>

      <Show when={info().error}>
        <p class="text-sm text-red-600 dark:text-red-400">{info().error}</p>
      </Show>

      <div class="flex flex-col gap-2">
        <span class="text-sm text-stone-500 dark:text-stone-400">
          Next 5 runs ({Intl.DateTimeFormat().resolvedOptions().timeZone}, local time)
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
                    {formatRunDate(run)}
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

      <p class="text-xs text-stone-500 dark:text-stone-400">
        Standard 5-field cron (minute-first). Need to go the other way?{' '}
        <a href="/cron-parser">Parse an existing expression</a>. Note: day-interval expressions
        like <span class="font-mono">*/3</span> reset at the start of each month.
      </p>
    </Section>
  );
}

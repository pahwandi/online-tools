import { createSignal, onCleanup } from 'solid-js';

/**
 * Copy-to-clipboard helper with per-key "Copied!" feedback.
 * `copiedKey()` returns the key of the last copied item, or null.
 */
export function createCopier(resetMs = 1500) {
  const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  const copy = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setCopiedKey(null), resetMs);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return { copiedKey, copy };
}

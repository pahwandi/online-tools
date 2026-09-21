import type { ParentProps } from 'solid-js';
import { HydrationScript } from '@solidjs/web';
import { GOOGLE_ANALYTICS_ID } from './consts';

// The document shell — the new index.html: picked up by the src/Document.*
// convention, it wraps the app in the plugin's generated entries and must
// render the full <html>. Head tags go here. It is compiled only into the
// prerendered static shell and ships zero client-side JS: in client mode
// <HydrationScript /> is stripped from the shell, and it activates when the
// app flips to SSR (`ssr: true` in vite.config.ts) — no document changes
// needed. Delete this file to fall back to the plugin's built-in shell.
const themeInit = `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

const gaInit = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_ANALYTICS_ID}');
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === 'first-contentful-paint') {
      gtag('event', 'first_contentful_paint', {
        value: Math.round(entry.startTime),
        metric_id: 'FCP',
        non_interaction: true,
      });
    }
  }
}).observe({ type: 'paint', buffered: true });`;

export default function Document(props: ParentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="Free, privacy-friendly online tools by Hari Pahwandi." />
        <title>Hari Pahwandi | Online Tools</title>
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`} />
        <script>{gaInit}</script>
        <script>{themeInit}</script>
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}

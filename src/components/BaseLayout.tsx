import type { ParentProps } from 'solid-js';
import Header from './Header';
import Footer from './Footer';

export default function BaseLayout(props: ParentProps) {
  return (
    <>
      <a
        href="#main-content"
        class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-stone-900 focus:text-stone-50 focus:rounded"
      >
        Skip to main content
      </a>
      <div class="max-w-270 mx-auto border-x border-stone-950/20 dark:border-stone-50/16 min-h-screen pb-11">
        <Header />
        <main id="main-content">{props.children}</main>
        <Footer />
      </div>
    </>
  );
}

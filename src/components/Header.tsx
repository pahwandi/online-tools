import { createSignal, onSettled } from 'solid-js';
import MoonIcon from '~icons/mdi/moon-and-stars';
import SunIcon from '~icons/mdi/white-balance-sunny';
import MenuIcon from '~icons/mdi/menu';
import CloseIcon from '~icons/mdi/close';

const PAHWANDI_BASE = import.meta.env.DEV
  ? 'http://localhost:8090'
  : 'https://pahwandi.com';

export default function Header() {
  const [dark, setDark] = createSignal(
    typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark'),
  );
  const [navOpen, setNavOpen] = createSignal(false);

  onSettled(() => {
    const onResize = () => {
      if (window.innerWidth > 640) setNavOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  const toggleTheme = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const closeNav = () => setNavOpen(false);

  return (
    <>
      <header class="sticky top-0 z-10 h-20 min-h-20 flex items-center bg-stone-50 dark:bg-stone-950 border-b border-stone-950/20 dark:border-stone-50/16">
        <div class="w-full max-w-270 mx-auto px-20 max-[65rem]:px-6 max-[60rem]:px-6 flex items-center justify-between">
          <a href="/" class="no-underline!">
            <h2 class="text-stone-900 dark:text-stone-100">
              <span class="font-bold text-xl tracking-wide">HARI</span>
              <span class="font-normal text-sm underline tracking-[0.15em]">
                pahwandi
              </span>
            </h2>
          </a>

          <nav
            id="main-nav"
            class={
              navOpen()
                ? 'flex flex-col absolute top-20 left-0 w-full bg-stone-50 dark:bg-stone-950 border-b border-stone-950/20 dark:border-stone-50/16 p-6 z-10'
                : 'max-[40rem]:hidden'
            }
          >
            <ul class="flex max-[40rem]:flex-col items-center gap-8 m-0 p-0 list-none">
              <li>
                <a href={`${PAHWANDI_BASE}/`} class="nav-link" onClick={closeNav}>
                  Home
                </a>
              </li>
              <li>
                <a
                  href={`${PAHWANDI_BASE}/blog`}
                  class="nav-link"
                  onClick={closeNav}
                >
                  Blog
                </a>
              </li>
              <li>
                <a
                  href={`${PAHWANDI_BASE}/about`}
                  class="nav-link"
                  onClick={closeNav}
                >
                  About
                </a>
              </li>
              <li>
                <a href="/" class="nav-link" onClick={closeNav}>
                  Tools
                </a>
              </li>
              <li>
                <div class="flex flex-row gap-4 items-center">
                  <span class="text-stone-900 dark:text-stone-100 text-sm sm:hidden">
                    Appearance
                  </span>
                  <button
                    type="button"
                    class="flex items-center justify-start dark:justify-end px-1 h-6 w-12 bg-stone-100 dark:bg-stone-900 border border-stone-950/20 dark:border-stone-50/16 rounded-3xl cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors focus-visible:outline-2 focus-visible:outline-stone-900 dark:focus-visible:outline-stone-100 focus-visible:outline-offset-2"
                    aria-label="Toggle dark mode"
                    onClick={toggleTheme}
                  >
                    <span class="w-4 h-4 rounded-full flex items-center justify-center">
                      {dark() ? (
                        <MoonIcon class="w-4 h-4 text-stone-600 dark:text-stone-100" />
                      ) : (
                        <SunIcon class="w-4 h-4 text-stone-600 dark:text-stone-100" />
                      )}
                    </span>
                  </button>
                </div>
              </li>
            </ul>
          </nav>

          <button
            type="button"
            class="hidden max-[40rem]:flex items-center justify-center h-10 w-10 -mr-2 bg-transparent border-none rounded cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-900 focus-visible:outline-2 focus-visible:outline-stone-900 dark:focus-visible:outline-stone-100 focus-visible:outline-offset-2"
            aria-label="Toggle menu"
            aria-expanded={navOpen() ? 'true' : 'false'}
            aria-controls="main-nav"
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen() ? (
              <CloseIcon class="w-7 h-7 text-stone-900 dark:text-stone-100" />
            ) : (
              <MenuIcon class="w-7 h-7 text-stone-900 dark:text-stone-100" />
            )}
          </button>
        </div>
      </header>

      <div
        id="nav-overlay"
        class={
          navOpen()
            ? 'fixed inset-0 z-0 bg-stone-950/80'
            : 'fixed inset-0 z-0 bg-stone-950/80 hidden'
        }
        aria-hidden="true"
        onClick={closeNav}
      />
    </>
  );
}

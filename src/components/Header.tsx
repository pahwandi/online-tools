import { createSignal, onSettled } from 'solid-js';

const PAHWANDI_BASE = import.meta.env.DEV
  ? 'http://localhost:8090'
  : 'https://pahwandi.com';

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      class="w-4 h-4 text-stone-600 dark:text-stone-100"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12.2 2C11.2 2.9 10.5 4.1 10.3 5.4C9.9 8.7 12.4 11.6 15.7 11.9C16.4 11.9 17 11.9 17.6 11.8C16.7 13.9 14.5 15.3 12 15.3C8.8 15.3 6.2 12.7 6.2 9.5C6.2 7.1 7.5 5.1 9.5 4.2C9.4 4.2 9.4 4.2 9.3 4.1C10.1 2.9 11.1 2 12.2 2M14.2 2C14.2 3.9 15.7 5.4 17.6 5.4C18.4 5.4 19.2 5.2 19.9 4.9C19.7 6 19.2 7 18.5 7.9C18.9 7.9 19.2 8 19.6 8C18.8 9.3 17.3 10.2 15.6 10.2C13.1 10.2 11.1 8.2 11.1 5.7C11.1 4.3 11.7 3 12.6 2C13.1 2 13.7 2 14.2 2Z"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      class="w-4 h-4 text-stone-600 dark:text-stone-100"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M3.55 19.09L4.96 20.5L6.76 18.71L5.34 17.29M12 6C8.69 6 6 8.69 6 12S8.69 18 12 18 18 15.31 18 12 15.31 6 12 6M20 13H23V11H20M17.24 18.71L19.04 20.5L20.45 19.09L18.66 17.29M20.45 5L19.04 3.6L17.24 5.39L18.66 6.81M13 1H11V4H13M6.76 5.39L4.96 3.6L3.55 5L5.34 6.81M1 13H4V11H1M13 20H11V23H13Z"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      class="w-7 h-7 text-stone-900 dark:text-stone-100"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      class="w-7 h-7 text-stone-900 dark:text-stone-100"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
      />
    </svg>
  );
}

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
                      {dark() ? <SunIcon /> : <MoonIcon />}
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
            {navOpen() ? <CloseIcon /> : <MenuIcon />}
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

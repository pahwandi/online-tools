export default function Footer() {
  const today = new Date();

  return (
    <footer class="fixed bottom-0 w-full max-w-269.5 z-10 bg-stone-50 dark:bg-stone-950 border-t border-stone-950/20 dark:border-stone-50/16">
      <div class="flex gap-2 justify-center flex-wrap py-4 text-stone-600 dark:text-stone-400 text-xs">
        <span>&copy;{today.getFullYear()}</span>
        <a
          href="/"
          class="text-stone-600 dark:text-stone-400 no-underline! hover:underline!"
        >
          pahwandi
        </a>
      </div>
    </footer>
  );
}

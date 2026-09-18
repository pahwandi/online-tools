export function btnClass(active: boolean): string {
  return active
    ? 'px-3 py-1 text-sm rounded-md border border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100 font-medium transition-colors cursor-pointer'
    : 'px-3 py-1 text-sm rounded-md border border-stone-950/20 dark:border-stone-50/16 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer';
}

export function actionBtnClass(): string {
  return 'px-3 py-1 text-sm rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors cursor-pointer';
}

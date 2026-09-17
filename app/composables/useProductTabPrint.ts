/**
 * Print expansion for a product tab row.
 *
 * radix Tabs sets the `hidden` HTML attribute on inactive panels. The
 * `[hidden]` reset lives in Tailwind's @layer base with !important, and
 * unlayered overrides cannot beat that because CSS cascade-layers reverses
 * layer order for !important. The simplest reliable answer is to drop the
 * attribute on `beforeprint` for the panels we want printed, and put it back
 * on `afterprint`.
 *
 * Both product tab rows call this, which is what makes the shared
 * `data-testid="product-tabs"` on their roots mean something.
 */
export function useProductTabPrint(): void {
  onMounted(() => {
    const PRINT_VISIBLE = ['description', 'specifications'];
    const restoredHidden: HTMLElement[] = [];
    const onBeforePrint = () => {
      document
        .querySelectorAll<HTMLElement>(
          '[data-testid="product-tabs"] [data-print]',
        )
        .forEach((el) => {
          const key = el.getAttribute('data-print');
          if (key && PRINT_VISIBLE.includes(key) && el.hasAttribute('hidden')) {
            el.removeAttribute('hidden');
            restoredHidden.push(el);
          }
        });
    };
    const onAfterPrint = () => {
      while (restoredHidden.length) {
        const el = restoredHidden.pop()!;
        el.setAttribute('hidden', '');
      }
    };
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    onBeforeUnmount(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    });
  });
}

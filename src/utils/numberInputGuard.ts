/**
 * Chặn triệt để hành vi lăn chuột làm nhảy số trên các ô input type=number,
 * đồng thời chuyển tiếp chuyển động cuộn cho container cha (modal/trang) để trải nghiệm cuộn tự nhiên.
 */
function findScrollableParent(element: HTMLElement | null): HTMLElement | Window {
  let parent = element?.parentElement;
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight;
    if (isScrollable) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

export function setupNumberInputScrollGuard() {
  if (typeof window === 'undefined') return;

  // Lắng nghe sự kiện wheel với capture: true và non-passive để có thể preventDefault việc nhảy số của browser
  window.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      const isNumberInput = target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number';

      if (isNumberInput) {
        // Chặn trình duyệt tự động tăng/giảm giá trị ô input
        e.preventDefault();
        (target as HTMLInputElement).blur();

        // Chuyển tiếp động tác cuộn lên container cha (modal-body hoặc trang)
        const scrollable = findScrollableParent(target);
        if (scrollable instanceof Window) {
          window.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: 'auto' });
        } else {
          scrollable.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: 'auto' });
        }
        return;
      }

      // Nếu ô input number đang được focus nhưng chuột lăn ở ngoài, hủy focus để tránh bắt nhầm sự kiện
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'number') {
        activeEl.blur();
      }
    },
    { passive: false, capture: true }
  );

  // Ngăn chặn bổ sung trực tiếp trên từng element khi được focus
  document.addEventListener('focusin', (e: FocusEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
      const el = target as HTMLInputElement;
      if (!el.dataset.guardWheel) {
        el.dataset.guardWheel = 'true';
        el.addEventListener(
          'wheel',
          (we: WheelEvent) => {
            we.preventDefault();
            el.blur();
          },
          { passive: false }
        );
      }
    }
  });
}

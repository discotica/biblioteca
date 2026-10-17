/**
 * Shared behaviour for modal layers. Consumers own their composition and
 * visual treatment; this module only owns the accessibility contract.
 */
export type OverlayOptions = {
  onClose: () => void;
  /** A selector inside the overlay. Defaults to `[data-overlay-initial-focus]`. */
  initialFocus?: string;
  /** Explicit opener when mounting is not caused by a focused trigger. */
  returnFocus?: HTMLElement | null;
};

export type DropdownOptions = OverlayOptions & {
  trigger?: HTMLElement | null;
  /**
   * Tab closes the popup and returns focus to the trigger instead of cycling
   * inside it. Required for `role="menu"`, whose items are not tab stops.
   */
  tabCloses?: boolean;
};

type ModalEntry = { node: HTMLElement };
type ScrollSnapshot = {
  scrollX: number;
  scrollY: number;
  overflow: string;
  position: string;
  top: string;
  width: string;
  paddingRight: string;
  boxSizing: string;
};

const modalStack: ModalEntry[] = [];
let scrollSnapshot: ScrollSnapshot | undefined;
const hiddenSiblings = new Map<HTMLElement, { ariaHidden: string | null; inert: boolean }>();

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function isVisible(element: HTMLElement) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
}

function focusableIn(node: HTMLElement) {
  return Array.from(node.querySelectorAll<HTMLElement>(focusableSelector)).filter(isVisible);
}

function focusInitial(node: HTMLElement, selector = '[data-overlay-initial-focus]') {
  const preferred = node.querySelector<HTMLElement>(selector);
  const target = preferred && isVisible(preferred) ? preferred : focusableIn(node)[0] ?? node;
  target.focus({ preventScroll: true });
}

function lockScroll() {
  if (scrollSnapshot) return;

  const body = document.body;
  const scrollY = window.scrollY;
  scrollSnapshot = {
    scrollX: window.scrollX,
    scrollY,
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
    paddingRight: body.style.paddingRight,
    boxSizing: body.style.boxSizing
  };

  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  const currentPaddingRight = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.width = '100%';
  // width:100% plus padding uses border-box so opening a modal does not make
  // the document wider. Preserve pre-existing body padding while reserving
  // exactly the scrollbar gutter that disappeared.
  body.style.boxSizing = 'border-box';
  if (scrollbarWidth) body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
}

function restoreScroll() {
  if (!scrollSnapshot) return;
  const body = document.body;
  const snapshot = scrollSnapshot;
  body.style.overflow = snapshot.overflow;
  body.style.position = snapshot.position;
  body.style.top = snapshot.top;
  body.style.width = snapshot.width;
  body.style.paddingRight = snapshot.paddingRight;
  body.style.boxSizing = snapshot.boxSizing;
  scrollSnapshot = undefined;
  // Do not use smooth scrolling here: returning from a modal must restore the
  // exact reading position, including when a page has global smooth scroll.
  window.scrollTo(snapshot.scrollX, snapshot.scrollY);
}

function restoreHiddenSiblings() {
  for (const [element, previous] of hiddenSiblings) {
    if (previous.ariaHidden === null) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', previous.ariaHidden);
    element.inert = previous.inert;
  }
  hiddenSiblings.clear();
}

function hideOutside(node: HTMLElement) {
  restoreHiddenSiblings();
  let current: HTMLElement | null = node;

  while (current?.parentElement) {
    const parent = current.parentElement;
    for (const sibling of Array.from(parent.children) as HTMLElement[]) {
      if (sibling === current || sibling.contains(current)) continue;
      hiddenSiblings.set(sibling, {
        ariaHidden: sibling.getAttribute('aria-hidden'),
        inert: sibling.inert
      });
      sibling.setAttribute('aria-hidden', 'true');
      sibling.inert = true;
    }
    current = parent;
  }
}

function refreshModalEnvironment() {
  const top = modalStack.at(-1);
  if (!top) {
    restoreHiddenSiblings();
    restoreScroll();
    return;
  }
  lockScroll();
  hideOutside(top.node);
}

/**
 * Svelte action for elements with `role="dialog"`/`aria-modal="true"`.
 * It traps Tab, closes on Escape, restores the invoking focus, hides siblings
 * from assistive technology and keeps the document scroll stable on desktop
 * and mobile. The consumer handles its own backdrop click by calling onClose.
 */
export function dialogOverlay(node: HTMLElement, initialOptions: OverlayOptions) {
  let options = initialOptions;
  const opener = options.returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const entry = { node };
  modalStack.push(entry);
  refreshModalEnvironment();
  node.tabIndex = node.tabIndex >= 0 ? node.tabIndex : -1;

  const onKeydown = (event: KeyboardEvent) => {
    if (modalStack.at(-1) !== entry) return;

    if (event.key === 'Escape') {
      // A nested dropdown or an expanded combobox owns its first Escape. Let
      // its bubble listener close the popup (and restore the trigger); a
      // second Escape can close the dialog.
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[role="menu"], [role="combobox"][aria-expanded="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      options.onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const targets = focusableIn(node);
    if (!targets.length) {
      event.preventDefault();
      node.focus({ preventScroll: true });
      return;
    }

    const first = targets[0];
    const last = targets[targets.length - 1];
    if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onFocusIn = (event: FocusEvent) => {
    if (modalStack.at(-1) !== entry || node.contains(event.target as Node)) return;
    focusInitial(node, options.initialFocus);
  };

  // Capture at document level as mobile rotation/virtual-keyboard changes can
  // transiently move focus to body without emitting a recoverable focusin.
  // The stack guard keeps only the top modal responsive.
  document.addEventListener('keydown', onKeydown, true);
  document.addEventListener('focusin', onFocusIn, true);
  const moveInitialFocus = () => {
    if (modalStack.at(-1) !== entry) return;
    // A route transition or an embedded player may briefly reclaim focus after
    // mount. Never override a person who has already moved within the dialog.
    if (!node.contains(document.activeElement)) focusInitial(node, options.initialFocus);
  };
  requestAnimationFrame(() => requestAnimationFrame(moveInitialFocus));
  const initialFocusRetry = window.setTimeout(moveInitialFocus, 60);

  return {
    update(next: OverlayOptions) {
      options = next;
    },
    destroy() {
      window.clearTimeout(initialFocusRetry);
      document.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      const wasTop = modalStack.at(-1) === entry;
      const index = modalStack.indexOf(entry);
      if (index >= 0) modalStack.splice(index, 1);
      refreshModalEnvironment();
      // An underlying overlay may unmount while another one is still on top.
      // In that case the active layer retains focus; only the dismissed top
      // layer is allowed to restore its invoking element.
      if (wasTop) {
        const focusTarget = options.returnFocus ?? opener;
        if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
        else if (modalStack.at(-1)) focusInitial(modalStack.at(-1).node);
      }
    }
  };
}

/**
 * Alias kept deliberately separate in the public API: a Sheet has the same
 * modal behaviour as Dialog but a different visual composition.
 */
export const sheetOverlay = dialogOverlay;

export type AnchoredLayerOptions = {
  /**
   * Positioned layer the node is moved into. It must sit outside every
   * scrolling or clipping ancestor of the trigger, and inside the dialog when
   * the trigger lives in one, so the dialog keeps owning focus and the
   * accessibility tree.
   */
  target?: HTMLElement | null;
  trigger?: HTMLElement | null;
  /** Space kept between the node, its trigger and the edges. */
  gutter?: number;
  /** Align the node with the trigger's start (default) or end edge. */
  align?: 'start' | 'end';
  /** Never narrower than the trigger (listboxes under a field). */
  matchWidth?: boolean;
};

/**
 * Svelte action for a dropdown rendered in a portal layer instead of next to
 * its trigger. It opens below the trigger (above when the viewport has more
 * room there), stays inside the layer horizontally and inside the viewport
 * vertically, and repositions on resize, on any scroll and whenever its own
 * size changes, e.g. when items load after opening. Geometry only: pair it
 * with `dropdownMenu` for focus, Escape and outside-pointer close.
 */
export function anchoredLayer(node: HTMLElement, initialOptions: AnchoredLayerOptions) {
  let options = initialOptions;
  let frame = 0;

  const place = () => {
    const { target, trigger } = options;
    if (!target || !trigger?.isConnected) return;
    if (node.parentElement !== target) target.appendChild(node);

    const gutter = options.gutter ?? 8;
    const layer = target.getBoundingClientRect();
    const anchor = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    // With an on-screen keyboard only the visual viewport is visible; in
    // layout-viewport coordinates it ends at offsetTop + height.
    const visual = window.visualViewport;
    const viewportHeight = Math.min(
      document.documentElement.clientHeight,
      visual ? visual.offsetTop + visual.height : Number.POSITIVE_INFINITY
    );
    const minLeft = Math.max(layer.left, 0) + gutter;
    const maxRight = Math.min(layer.right, viewportWidth) - gutter;

    // Measure the intrinsic width, not the width left over at the current
    // offset; otherwise content that grows after opening ends up cut.
    const style = getComputedStyle(node);
    const frameWidth = style.boxSizing === 'border-box' ? 0 : ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
      .reduce((sum, key) => sum + (Number.parseFloat(style[key as 'paddingLeft']) || 0), 0);
    node.style.width = 'max-content';
    node.style.maxWidth = `${Math.max(0, maxRight - minLeft - frameWidth)}px`;
    node.style.minWidth = options.matchWidth ? `${Math.min(anchor.width, maxRight - minLeft) - frameWidth}px` : '';
    const width = node.offsetWidth;
    const height = node.scrollHeight + (node.offsetHeight - node.clientHeight);
    const below = viewportHeight - anchor.bottom - gutter * 2;
    const above = anchor.top - gutter * 2;
    const placeBelow = height <= below || below >= above;
    const room = Math.max(0, placeBelow ? below : above);
    const maxHeight = height > room ? `${room}px` : '';
    if (node.style.maxHeight !== maxHeight) node.style.maxHeight = maxHeight;
    if (maxHeight) node.style.overflowY = 'auto';
    const finalHeight = Math.min(height, room);

    const preferred = options.align === 'end' ? anchor.right - width : anchor.left;
    const left = Math.max(minLeft, Math.min(preferred, maxRight - width));
    const top = placeBelow ? anchor.bottom + gutter : anchor.top - gutter - finalHeight;
    node.style.left = `${left - layer.left}px`;
    node.style.top = `${top - layer.top}px`;
    node.style.pointerEvents = 'auto';
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  };

  place();
  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(node);
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);

  return {
    update(next: AnchoredLayerOptions) {
      options = next;
      schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    }
  };
}

const LAYER_ATTRIBUTE = 'data-ui-layer';

/**
 * Portal layer for `anchoredLayer`, chosen from where the trigger lives:
 *
 * - inside a modal (`aria-modal="true"`): that modal's own layer, a direct
 *   child marked `data-ui-layer` (Dialog and Sheet render one). The popup stays
 *   inside the modal, so the focus trap and the hidden-siblings contract hold,
 *   but outside the panel that scrolls or clips. A legacy modal without a layer
 *   gets the modal node itself;
 * - anywhere else: one page-level layer fixed over the viewport, created on
 *   first use at the end of <body>.
 */
export function layerFor(trigger: HTMLElement | null | undefined): HTMLElement | null {
  if (!trigger || typeof document === 'undefined') return null;
  const modal = trigger.closest<HTMLElement>('[aria-modal="true"]');
  if (modal) return modal.querySelector<HTMLElement>(`:scope > [${LAYER_ATTRIBUTE}]`) ?? modal;

  let layer = document.querySelector<HTMLElement>(`body > [${LAYER_ATTRIBUTE}="page"]`);
  if (!layer) {
    layer = document.createElement('div');
    layer.setAttribute(LAYER_ATTRIBUTE, 'page');
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      zIndex: 'var(--layer-dropdown)',
      pointerEvents: 'none'
    });
    document.body.appendChild(layer);
  }
  return layer;
}

/**
 * Svelte action for non-modal menu popovers. It establishes initial focus,
 * Escape, outside-pointer close and exact focus return without locking scroll.
 */
export function dropdownMenu(node: HTMLElement, initialOptions: DropdownOptions) {
  let options = initialOptions;
  const opener = options.trigger ?? options.returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);

  const close = () => options.onClose();
  const onPointerDown = (event: PointerEvent) => {
    const trigger = options.trigger;
    if (!node.contains(event.target as Node) && !trigger?.contains(event.target as Node)) {
      // Keep the documented return-focus contract instead of letting the
      // pointer's default action immediately move focus into the page behind.
      event.preventDefault();
      close();
    }
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    if (event.key !== 'Tab') return;
    if (options.tabCloses) {
      event.preventDefault();
      close();
      return;
    }
    const targets = focusableIn(node);
    if (!targets.length) {
      event.preventDefault();
      node.focus({ preventScroll: true });
      return;
    }

    const first = targets[0];
    const last = targets[targets.length - 1];
    if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  node.addEventListener('keydown', onKeydown);
  document.addEventListener('pointerdown', onPointerDown, true);
  requestAnimationFrame(() => focusInitial(node, options.initialFocus));

  return {
    update(next: DropdownOptions) {
      options = next;
    },
    destroy() {
      node.removeEventListener('keydown', onKeydown);
      document.removeEventListener('pointerdown', onPointerDown, true);
      const focusTarget = options.trigger ?? options.returnFocus ?? opener;
      if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
    }
  };
}

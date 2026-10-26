/**
 * Calls `onFailure` when a cover image cannot be shown: the request failed
 * before the action ran (cached error) or fails afterwards. The host swaps the
 * <img> for <CoverFallback />.
 */
export function coverFailure(image: HTMLImageElement, onFailure: () => void) {
  const fail = () => onFailure();
  image.addEventListener('error', fail);
  if (image.complete && image.naturalWidth === 0 && image.getAttribute('src')) fail();
  return {
    destroy() {
      image.removeEventListener('error', fail);
    }
  };
}

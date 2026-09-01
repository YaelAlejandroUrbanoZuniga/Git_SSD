/**
 * Delay for a page's own "initial fetch" `LoadingState` — the one that covers
 * the whole screen right after the lazy chunk mounted.
 *
 * `App.tsx`'s `<Suspense>` fallback already covers the perceptible part of a
 * navigation (chunk download + first render) at 350ms. A page-level loader on
 * the same threshold would simply take over from it, so the user saw two
 * spinners back to back — two different icons, one navigation. Sitting above
 * the Suspense threshold, this one only appears when the data fetch *itself*
 * is abnormally slow after the chunk already arrived, which is the case it was
 * meant to cover in the first place.
 *
 * Section loaders (a table body swapping while the page's header and filters
 * stay on screen) are not part of that cascade and keep `LoadingState`'s 400ms
 * default.
 */
export const PAGE_FETCH_DELAY_MS = 600;

/**
 * Applies the stored or OS theme before first paint so there is no flash of the
 * wrong palette. Inline and synchronous by necessity — it must run before body
 * renders. Kept tiny and dependency-free.
 */
const script = `
(function () {
  try {
    var stored = localStorage.getItem('lgos-theme');
    var dark = stored === 'dark' || (stored !== 'light' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) { /* private mode: fall back to light */ }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

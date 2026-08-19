'use client';

import { useSyncExternalStore } from 'react';

/**
 * Follows the OS by default; an explicit choice is persisted. Paired with the
 * inline ThemeScript in the root layout, which applies the stored value before
 * first paint so there is no flash.
 *
 * The `dark` class on <html> is the single source of truth — the script sets it
 * before React exists, so React subscribes to the DOM rather than mirroring it
 * into state that would start out wrong.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

/** The server cannot know the preference; the pre-paint script corrects it. */
function isDarkOnServer(): boolean {
  return false;
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, isDarkOnServer);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('lgos-theme', next ? 'dark' : 'light');
    } catch {
      /* private mode: the choice simply does not persist */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      className="type-small text-ink-faint transition-colors hover:text-ink"
    >
      {dark ? 'Light' : 'Dark'}
    </button>
  );
}

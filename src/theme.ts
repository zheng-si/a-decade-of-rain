// Dark / light theme switching. The choice lives on <html data-theme="…">;
// an inline script in index.html applies it before first paint (no flash),
// defaulting to the reader's prefers-color-scheme. All colour mapping is
// CSS-side (App.css tokens + the dark blocks at the end of Story.css).

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'adr-theme'

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* private mode etc. — the choice just won't persist */
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

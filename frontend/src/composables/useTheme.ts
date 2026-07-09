import { onBeforeUnmount, onMounted } from 'vue'

export type ResolvedTheme = 'light' | 'dark'

export function useTheme() {
  const applyTheme = (theme: ResolvedTheme) => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.theme = theme
  }

  let mediaQuery: MediaQueryList | null = null

  const handleMediaChange = (event: MediaQueryListEvent) => {
    applyTheme(event.matches ? 'dark' : 'light')
  }

  onMounted(() => {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    applyTheme(mediaQuery.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', handleMediaChange)
  })

  onBeforeUnmount(() => {
    mediaQuery?.removeEventListener('change', handleMediaChange)
  })
}

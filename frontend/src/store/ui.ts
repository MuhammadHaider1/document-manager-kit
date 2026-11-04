import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from '@/lib/constants'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface UiState {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  sidebarOpen: boolean
  commandOpen: boolean
  setTheme: (theme: ThemePreference) => void
  applySystemTheme: () => void
  setSidebarOpen: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
}

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  return theme === 'system' ? systemTheme() : theme
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#08131F' : '#FAF8F4')
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: resolveTheme('system'),
      sidebarOpen: false,
      commandOpen: false,

      setTheme: (theme) => {
        const resolved = resolveTheme(theme)
        applyTheme(resolved)
        set({ theme, resolvedTheme: resolved })
      },

      applySystemTheme: () => {
        if (get().theme !== 'system') return
        const resolved = systemTheme()
        applyTheme(resolved)
        set({ resolvedTheme: resolved })
      },

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    {
      name: STORAGE_KEYS.ui,
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.theme)
          applyTheme(resolved)
          state.resolvedTheme = resolved
        }
      },
    }
  )
)

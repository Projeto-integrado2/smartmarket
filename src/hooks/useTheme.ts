import { useEffect, useState } from 'react'

const STORAGE_KEY = 'smartmarket-theme'

export function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem(STORAGE_KEY) === 'dark')
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  }, [dark])
  return { dark, toggleDark: () => setDark((value) => !value) }
}

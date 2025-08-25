import { useEffect, useState } from 'react'

const KEY = 'wd_theme' // 'light' | 'dark'

function applyTheme(theme){
  const isDark = theme === 'dark'
  const el = document.documentElement
  el.classList.toggle('dark', isDark)
  try { localStorage.setItem(KEY, theme) } catch {}
 
}

function detectInitial(){
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  } catch { return 'light' }
}

export default function ThemeToggle(){
  const [theme, setTheme] = useState(detectInitial)

  useEffect(() => { applyTheme(theme) }, [theme])

  return (
    <button
      onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <span>🌙 Dark</span> : <span>☀️ Light</span>}
    </button>
  )
}

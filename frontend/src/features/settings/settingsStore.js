import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const FONT_FAMILIES = [
  { id: 'jetbrains', label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
  { id: 'fira', label: 'Fira Code', value: '"Fira Code", monospace' },
  { id: 'cascadia', label: 'Cascadia Code', value: '"Cascadia Code", monospace' },
  { id: 'monaco', label: 'Monaco', value: 'Monaco, monospace' },
  { id: 'courier', label: 'Courier New', value: '"Courier New", monospace' },
]

const DEFAULTS = {
  fontSize: 14,
  fontFamily: FONT_FAMILIES[0].value,
  tabSize: 4,
  wordWrap: true,
  lineNumbers: 'on',
  minimap: false,
  autoSave: false,
  formatOnSave: false,
  theme: 'dark',
  cursorStyle: 'block',
  cursorBlink: true,
  fontLigatures: true,
  terminalFontSize: 14,
  terminalFontFamily: FONT_FAMILIES[0].value,
  terminalScrollback: 5000,
}

const useSettingsStore = create(
  persist(
    (set) => ({
      ...DEFAULTS,
      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      toggleSettingsOpen: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
      updateSetting: (key, value) => set({ [key]: value }),
      resetSettings: () => set({ ...DEFAULTS }),
    }),
    { name: 'stellaride-settings' }
  )
)

export function buildMonacoOptions(settings) {
  return {
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    fontLigatures: settings.fontLigatures,
    tabSize: settings.tabSize,
    insertSpaces: true,
    wordWrap: settings.wordWrap ? 'on' : 'off',
    lineNumbers: settings.lineNumbers,
    minimap: { enabled: settings.minimap },
    cursorStyle: settings.cursorStyle,
    cursorBlinking: settings.cursorBlink ? 'blink' : 'solid',
    scrollBeyondLastLine: false,
    renderLineHighlight: 'line',
    automaticLayout: true,
    padding: { top: 16, bottom: 16 },
  }
}

export function monacoTheme(settings) {
  return settings.theme === 'light' ? 'vs' : 'vs-dark'
}

export default useSettingsStore

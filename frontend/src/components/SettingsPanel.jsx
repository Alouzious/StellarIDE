import { X } from 'lucide-react'
import useSettingsStore, { FONT_FAMILIES } from '../features/settings/settingsStore'

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-stellar-muted">{label}</span>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-stellar-heading uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}

const KEYBINDINGS = [
  ['Compile', 'Ctrl+Shift+B'],
  ['Test', 'Toolbar'],
  ['Deploy', 'Ctrl+Shift+D'],
  ['Save', 'Ctrl+S'],
  ['Search files', 'Ctrl+Shift+F'],
  ['Find in file', 'Ctrl+F'],
  ['Close tab', 'Ctrl+W'],
  ['Reopen tab', 'Ctrl+Shift+T'],
  ['Cycle tabs', 'Ctrl+Tab'],
  ['Toggle terminal', 'Ctrl+`'],
  ['Settings', 'Ctrl+,'],
  ['Format document', 'Shift+Alt+F'],
]

export default function SettingsPanel({ open, onClose }) {
  const settings = useSettingsStore()
  const { updateSetting } = settings

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-stellar-card border-l border-stellar-border z-50 flex flex-col shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stellar-border">
          <h2 className="text-lg font-semibold text-stellar-heading">IDE Settings</h2>
          <button type="button" onClick={onClose} className="text-stellar-muted hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-8">
          <Section title="Editor">
            <Row label="Font size">
              <input
                type="range"
                min={10}
                max={24}
                value={settings.fontSize}
                onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                className="w-32 accent-stellar-accent"
              />
              <span className="text-xs text-stellar-text w-8 text-right">{settings.fontSize}px</span>
            </Row>
            <Row label="Font family">
              <select
                value={settings.fontFamily}
                onChange={(e) => updateSetting('fontFamily', e.target.value)}
                className="input-field py-1.5 text-xs max-w-[180px]"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.id} value={f.value}>{f.label}</option>
                ))}
              </select>
            </Row>
            <Row label="Tab size">
              <select
                value={settings.tabSize}
                onChange={(e) => updateSetting('tabSize', Number(e.target.value))}
                className="input-field py-1.5 text-xs w-20"
              >
                {[2, 4, 8].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Row>
            <Row label="Word wrap">
              <input type="checkbox" checked={settings.wordWrap} onChange={(e) => updateSetting('wordWrap', e.target.checked)} />
            </Row>
            <Row label="Line numbers">
              <select
                value={settings.lineNumbers}
                onChange={(e) => updateSetting('lineNumbers', e.target.value)}
                className="input-field py-1.5 text-xs w-28"
              >
                <option value="on">On</option>
                <option value="off">Off</option>
                <option value="relative">Relative</option>
              </select>
            </Row>
            <Row label="Minimap">
              <input type="checkbox" checked={settings.minimap} onChange={(e) => updateSetting('minimap', e.target.checked)} />
            </Row>
            <Row label="Auto save">
              <input type="checkbox" checked={settings.autoSave} onChange={(e) => updateSetting('autoSave', e.target.checked)} />
            </Row>
            <Row label="Format on save">
              <input type="checkbox" checked={settings.formatOnSave} onChange={(e) => updateSetting('formatOnSave', e.target.checked)} />
            </Row>
            <Row label="Font ligatures">
              <input type="checkbox" checked={settings.fontLigatures} onChange={(e) => updateSetting('fontLigatures', e.target.checked)} />
            </Row>
          </Section>

          <Section title="Appearance">
            <Row label="Theme">
              <select
                value={settings.theme}
                onChange={(e) => updateSetting('theme', e.target.value)}
                className="input-field py-1.5 text-xs w-28"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </Row>
            <Row label="Cursor style">
              <select
                value={settings.cursorStyle}
                onChange={(e) => updateSetting('cursorStyle', e.target.value)}
                className="input-field py-1.5 text-xs w-28"
              >
                <option value="block">Block</option>
                <option value="line">Line</option>
                <option value="underline">Underline</option>
              </select>
            </Row>
            <Row label="Cursor blink">
              <input type="checkbox" checked={settings.cursorBlink} onChange={(e) => updateSetting('cursorBlink', e.target.checked)} />
            </Row>
          </Section>

          <Section title="Terminal">
            <Row label="Font size">
              <input
                type="range"
                min={10}
                max={20}
                value={settings.terminalFontSize}
                onChange={(e) => updateSetting('terminalFontSize', Number(e.target.value))}
                className="w-32 accent-stellar-accent"
              />
              <span className="text-xs text-stellar-text w-8 text-right">{settings.terminalFontSize}px</span>
            </Row>
            <Row label="Font family">
              <select
                value={settings.terminalFontFamily}
                onChange={(e) => updateSetting('terminalFontFamily', e.target.value)}
                className="input-field py-1.5 text-xs max-w-[180px]"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.id} value={f.value}>{f.label}</option>
                ))}
              </select>
            </Row>
            <Row label="Scrollback lines">
              <input
                type="number"
                min={500}
                max={50000}
                value={settings.terminalScrollback}
                onChange={(e) => updateSetting('terminalScrollback', Number(e.target.value) || 5000)}
                className="input-field py-1.5 text-xs w-24"
              />
            </Row>
          </Section>

          <Section title="Keybindings">
            <ul className="space-y-1.5">
              {KEYBINDINGS.map(([label, keys]) => (
                <li key={label} className="flex items-center justify-between text-xs py-1 border-b border-stellar-border/40">
                  <span className="text-stellar-muted">{label}</span>
                  <kbd className="px-2 py-0.5 rounded bg-stellar-surface border border-stellar-border text-stellar-text font-mono">{keys}</kbd>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </aside>
    </>
  )
}

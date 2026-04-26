import { FileCode, Play, CheckCircle, FolderOpen, Terminal } from 'lucide-react'

export default function IdePreviewSection() {
  const files = [
    { name: 'token_contract.rs', active: true },
    { name: 'lib.rs', active: false },
    { name: 'Cargo.toml', active: false },
  ]

  const LOG_LINES = [
    { text: '$ cargo build --target wasm32-unknown-unknown', color: 'text-stellar-muted' },
    { text: '   Compiling token_contract v0.1.0', color: 'text-stellar-text' },
    { text: '   Finished release [optimized] target(s) in 4.23s', color: 'text-green-400' },
    { text: '✔  Contract compiled successfully', color: 'text-green-400' },
    { text: '   Output: target/wasm32/.../token_contract.wasm (38 KB)', color: 'text-stellar-muted' },
  ]

  return (
    <section id="preview" className="py-24 border-t border-stellar-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-semibold text-stellar-accent tracking-widest uppercase">
            IDE Preview
          </span>
          <h2 className="mt-3 text-4xl lg:text-5xl font-black text-stellar-heading tracking-tight">
            Your IDE. Your browser.
          </h2>
          <p className="mt-4 text-lg text-stellar-muted">
            A full VS Code–inspired environment running entirely in your browser — no installs, no config.
          </p>
        </div>

        {/* IDE Mockup */}
        <div className="rounded-2xl border border-stellar-border overflow-hidden shadow-2xl bg-stellar-surface">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-stellar-card border-b border-stellar-border">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-sm font-semibold text-stellar-heading">StellarIDE — my-token-contract</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-2">
                {['Compile', 'Test', 'Deploy', 'Audit'].map((label, i) => (
                  <div
                    key={label}
                    className={`px-3 py-1 rounded text-xs font-semibold ${
                      i === 0
                        ? 'bg-stellar-accent text-white'
                        : 'bg-stellar-surface border border-stellar-border text-stellar-muted'
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* IDE body */}
          <div className="flex" style={{ height: '440px' }}>
            {/* Sidebar */}
            <div className="w-52 border-r border-stellar-border bg-stellar-card flex flex-col flex-shrink-0">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-stellar-border">
                <FolderOpen className="w-4 h-4 text-stellar-accent" />
                <span className="text-xs font-semibold text-stellar-muted uppercase tracking-wide">Explorer</span>
              </div>
              <div className="p-2 flex-1">
                <div className="mb-1 px-2 py-1">
                  <span className="text-xs text-stellar-muted uppercase font-semibold tracking-wide">src</span>
                </div>
                {files.map((f) => (
                  <div
                    key={f.name}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono cursor-pointer ${
                      f.active
                        ? 'bg-stellar-accent/20 text-stellar-accent border border-stellar-accent/20'
                        : 'text-stellar-muted hover:text-stellar-text hover:bg-stellar-surface'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5 flex-shrink-0" />
                    {f.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Editor area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab */}
              <div className="flex items-center border-b border-stellar-border bg-stellar-card">
                <div className="flex items-center gap-2 px-4 py-2 border-r border-stellar-border bg-stellar-surface">
                  <FileCode className="w-3.5 h-3.5 text-stellar-accent" />
                  <span className="text-xs text-stellar-text font-mono">token_contract.rs</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-stellar-accent" />
                </div>
              </div>

              {/* Code lines */}
              <div className="flex-1 overflow-hidden p-4 font-mono text-xs leading-6 bg-stellar-surface">
                {[
                  { n: 1, code: '#![no_std]', cls: 'text-stellar-accent' },
                  { n: 2, code: 'use soroban_sdk::{contract, contractimpl, Env};', cls: 'text-stellar-text' },
                  { n: 3, code: '', cls: '' },
                  { n: 4, code: '#[contract]', cls: 'text-stellar-accent' },
                  { n: 5, code: 'pub struct TokenContract;', cls: 'text-stellar-text' },
                  { n: 6, code: '', cls: '' },
                  { n: 7, code: '#[contractimpl]', cls: 'text-stellar-accent' },
                  { n: 8, code: 'impl TokenContract {', cls: 'text-stellar-text' },
                  { n: 9, code: '    pub fn mint(env: Env, to: Address, amount: i128) {', cls: 'text-stellar-text' },
                  { n: 10, code: '        let admin = Self::admin(&env);', cls: 'text-stellar-text' },
                  { n: 11, code: '        admin.require_auth();', cls: 'text-stellar-text' },
                  { n: 12, code: '    }', cls: 'text-stellar-text' },
                  { n: 13, code: '}', cls: 'text-stellar-text' },
                ].map(({ n, code, cls }) => (
                  <div key={n} className="flex gap-4">
                    <span className="text-stellar-border w-5 text-right select-none flex-shrink-0">{n}</span>
                    <span className={cls || 'text-stellar-text'}>{code || '\u00a0'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom panel */}
          <div className="border-t border-stellar-border bg-stellar-card">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-stellar-border">
              <Terminal className="w-3.5 h-3.5 text-stellar-muted" />
              <span className="text-xs font-semibold text-stellar-muted uppercase tracking-wide">Output</span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400">Build succeeded</span>
              </div>
            </div>
            <div className="p-4 font-mono text-xs space-y-1">
              {LOG_LINES.map((l, i) => (
                <div key={i} className={l.color}>{l.text}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

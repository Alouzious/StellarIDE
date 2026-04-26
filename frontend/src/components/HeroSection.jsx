import { Link } from 'react-router-dom'
import { ArrowRight, Circle } from 'lucide-react'
import Button from '../ui/Button'

const CODE_LINES = [
  { n: 1, code: '#![no_std]', cls: 'text-stellar-accent' },
  { n: 2, code: 'use soroban_sdk::{contract, contractimpl,', cls: 'text-stellar-text' },
  { n: 3, code: '    vec, Env, Symbol, symbol_short, Vec};', cls: 'text-stellar-text' },
  { n: 4, code: '', cls: '' },
  { n: 5, code: '#[contract]', cls: 'text-stellar-accent' },
  { n: 6, code: 'pub struct HelloContract;', cls: 'text-blue-400' },
  { n: 7, code: '', cls: '' },
  { n: 8, code: '#[contractimpl]', cls: 'text-stellar-accent' },
  { n: 9, code: 'impl HelloContract {', cls: 'text-stellar-text' },
  { n: 10, code: '    pub fn hello(env: Env, to: Symbol)', cls: 'text-stellar-text' },
  { n: 11, code: '        -> Vec<Symbol> {', cls: 'text-stellar-text' },
  { n: 12, code: '        vec![&env, symbol_short!("Hello"), to]', cls: 'text-green-400' },
  { n: 13, code: '    }', cls: 'text-stellar-text' },
  { n: 14, code: '}', cls: 'text-stellar-text' },
]

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-stellar-accent/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-700/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-5">
              <p className="text-sm font-mono text-stellar-accent tracking-widest uppercase">
                Soroban Smart Contract IDE
              </p>
              <h1 className="text-5xl lg:text-6xl font-black text-stellar-heading leading-[1.08] tracking-tight">
                Write, Test &<br />
                Deploy Soroban<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-stellar-accent to-blue-400">
                  Contracts
                </span>
              </h1>
              <p className="text-lg text-stellar-muted leading-relaxed max-w-md">
                A browser-native IDE for the Stellar ecosystem.
                Full Monaco editor, one-click compilation, integrated testing,
                and direct deployment — no local toolchain required.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link to="/register">
                <Button size="lg" className="shadow-lg shadow-stellar-accent/20">
                  Open the IDE
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#preview">
                <Button variant="secondary" size="lg">
                  See how it works
                </Button>
              </a>
            </div>

            <div className="flex items-center gap-6 text-xs text-stellar-muted font-mono pt-2">
              <span className="flex items-center gap-1.5">
                <Circle className="w-2 h-2 fill-green-400 text-green-400" />
                Free on Testnet
              </span>
              <span className="flex items-center gap-1.5">
                <Circle className="w-2 h-2 fill-stellar-accent text-stellar-accent" />
                No install needed
              </span>
              <span className="flex items-center gap-1.5">
                <Circle className="w-2 h-2 fill-blue-400 text-blue-400" />
                Soroban SDK built-in
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-stellar-accent/20 via-transparent to-blue-500/10 blur-sm" />
            <div className="relative bg-[#0d1117] rounded-2xl border border-stellar-border overflow-hidden shadow-2xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-stellar-border bg-stellar-card">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                </div>
                <span className="text-xs font-mono text-stellar-muted ml-2">hello_contract.rs</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <Circle className="w-2 h-2 fill-green-400 text-green-400" />
                  <span className="text-xs text-green-400 font-mono">compiled</span>
                </div>
              </div>
              <div className="p-5 font-mono text-xs leading-6">
                {CODE_LINES.map(({ n, code, cls }) => (
                  <div key={n} className="flex gap-4 hover:bg-white/[0.02] px-1 rounded">
                    <span className="text-stellar-border select-none w-4 text-right flex-shrink-0 text-[10px] mt-0.5">{n}</span>
                    <span className={cls || 'text-stellar-text'}>{code || '\u00a0'}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 px-4 py-2 border-t border-stellar-border bg-stellar-card text-[10px] font-mono text-stellar-muted">
                <span>Rust</span>
                <span>·</span>
                <span>Soroban SDK 22.0.11</span>
                <span>·</span>
                <span>wasm32-unknown-unknown</span>
                <span className="ml-auto">UTF-8</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

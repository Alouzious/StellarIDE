// import { Link } from 'react-router-dom'
// import { Zap, ArrowRight, Star } from 'lucide-react'
// import Button from '../../components/ui/Button'

// const CODE_SNIPPET = `#![no_std]
// use soroban_sdk::{contract, contractimpl, Env};

// #[contract]
// pub struct TokenContract;

// #[contractimpl]
// impl TokenContract {
//     pub fn mint(env: Env, to: Address, amount: i128) {
//         let admin = Self::admin(&env);
//         admin.require_auth();
        
//         let balance = Self::balance(&env, to.clone());
//         env.storage()
//            .instance()
//            .set(&to, &(balance + amount));
//     }
// }`

// export default function HeroSection() {
//   return (
//     <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
//       {/* Background gradients */}
//       <div className="absolute inset-0 pointer-events-none">
//         <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-stellar-accent/10 rounded-full blur-3xl" />
//         <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-700/10 rounded-full blur-3xl" />
//         <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-stellar-accent/20 to-transparent" />
//       </div>

//       {/* Grid overlay */}
//       <div
//         className="absolute inset-0 opacity-[0.03]"
//         style={{
//           backgroundImage:
//             'linear-gradient(rgba(59,130,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,1) 1px, transparent 1px)',
//           backgroundSize: '50px 50px',
//         }}
//       />

//       <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
//         <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
//           {/* Left content */}
//           <div className="space-y-8 animate-fade-in">
//             {/* Badge */}
//             {/* <div className="inline-flex items-center gap-2 px-4 py-2 bg-stellar-card border border-stellar-accent/30 rounded-full text-sm text-stellar-accent">
//               <Star className="w-3.5 h-3.5 fill-stellar-accent" />
//               <span className="font-medium">Built for Stellar & Soroban developers</span>
//             </div> */}

//             {/* Headline */}
//             <div>
//               <h1 className="text-5xl lg:text-7xl font-black text-stellar-heading leading-tight tracking-tight">
//                 Write Soroban
//                 <br />
//                 <span className="text-transparent bg-clip-text bg-gradient-to-r from-stellar-accent via-blue-400 to-indigo-400">
//                   Contracts
//                 </span>
//                 <br />
//                 in the Browser
//               </h1>
//               <p className="mt-6 text-xl text-stellar-muted max-w-lg leading-relaxed">
//                 StellarIDE is the professional-grade, browser-native smart contract IDE for the Stellar ecosystem. 
//                 Write, test, and deploy Soroban contracts with zero setup.
//               </p>
//             </div>

//             {/* CTAs */}
//             <div className="flex flex-wrap gap-4">
//               <Link to="/register">
//                 <Button size="lg" className="shadow-lg shadow-stellar-accent/20">
//                   <Zap className="w-5 h-5" />
//                   Start Building Free
//                 </Button>
//               </Link>
//               <a href="#preview">
//                 <Button variant="secondary" size="lg">
//                   See it in Action
//                   <ArrowRight className="w-5 h-5" />
//                 </Button>
//               </a>
//             </div>

//             {/* Social proof */}
//             <div className="flex items-center gap-6 text-sm text-stellar-muted">
//               <div className="flex items-center gap-2">
//                 <div className="flex -space-x-2">
//                   {['A', 'B', 'C', 'D'].map((l) => (
//                     <div key={l} className="w-7 h-7 rounded-full bg-stellar-accent/20 border-2 border-stellar-bg flex items-center justify-center text-xs text-stellar-accent font-bold">
//                       {l}
//                     </div>
//                   ))}
//                 </div>
//                 <span>500+ developers building</span>
//               </div>
//               <div className="h-4 w-px bg-stellar-border" />
//               <div className="flex items-center gap-1">
//                 {[1, 2, 3, 4, 5].map((i) => (
//                   <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
//                 ))}
//                 <span>4.9/5 rating</span>
//               </div>
//             </div>
//           </div>

//           {/* Right: code preview */}
//           <div className="relative animate-slide-up">
//             <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-stellar-accent/20 via-blue-500/20 to-indigo-500/20 blur-sm" />
//             <div className="relative bg-stellar-surface rounded-2xl border border-stellar-border overflow-hidden shadow-2xl">
//               {/* Window chrome */}
//               <div className="flex items-center gap-2 px-4 py-3 border-b border-stellar-border bg-stellar-card">
//                 <div className="flex gap-1.5">
//                   <div className="w-3 h-3 rounded-full bg-red-500" />
//                   <div className="w-3 h-3 rounded-full bg-yellow-500" />
//                   <div className="w-3 h-3 rounded-full bg-green-500" />
//                 </div>
//                 <div className="flex-1 text-center">
//                   <span className="text-xs text-stellar-muted font-mono">token_contract.rs</span>
//                 </div>
//               </div>

//               {/* Code */}
//               <pre className="p-6 text-xs font-mono leading-relaxed overflow-x-auto">
//                 {CODE_SNIPPET.split('\n').map((line, i) => (
//                   <div key={i} className="flex gap-4">
//                     <span className="text-stellar-border select-none w-5 text-right flex-shrink-0">{i + 1}</span>
//                     <span
//                       className="text-stellar-text"
//                       dangerouslySetInnerHTML={{
//                         __html: line
//                           .replace(/\b(use|pub|fn|impl|let|struct|mod)\b/g, '<span class="text-blue-400">$1</span>')
//                           .replace(/\b(Env|Address|TokenContract|Self)\b/g, '<span class="text-yellow-400">$1</span>')
//                           .replace(/#!\[.*?\]|#\[.*?\]/g, '<span class="text-stellar-accent">$&</span>')
//                           .replace(/\/\/.*/g, '<span class="text-stellar-muted">$&</span>')
//                           .replace(/".*?"/g, '<span class="text-green-400">$&</span>')
//                           || '&nbsp;',
//                       }}
//                     />
//                   </div>
//                 ))}
//               </pre>

//               {/* Status bar */}
//               <div className="flex items-center gap-4 px-4 py-2 border-t border-stellar-border bg-stellar-card text-xs text-stellar-muted font-mono">
//                 <div className="flex items-center gap-1.5">
//                   <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
//                   <span>Ready</span>
//                 </div>
//                 <span>Rust</span>
//                 <span>Soroban SDK v25</span>
//                 <span className="ml-auto">Ln 1, Col 1</span>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </section>
//   )
// }













import { Link } from 'react-router-dom'
import { Zap, ArrowRight, Star } from 'lucide-react'
import Button from '../../components/ui/Button'

const CODE_SNIPPET = `#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin = Self::admin(&env);
        admin.require_auth();
        
        let balance = Self::balance(&env, to.clone());
        env.storage()
           .instance()
           .set(&to, &(balance + amount));
    }
}`

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-stellar-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-700/10 rounded-full blur-3xl" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-stellar-accent/20 to-transparent" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left content */}
          <div className="space-y-8 animate-fade-in">
            {/* Badge */}
            {/* <div className="inline-flex items-center gap-2 px-4 py-2 bg-stellar-card border border-stellar-accent/30 rounded-full text-sm text-stellar-accent">
              <Star className="w-3.5 h-3.5 fill-stellar-accent" />
              <span className="font-medium">Built for Stellar & Soroban developers</span>
            </div> */}

            {/* Headline */}
            <div>
              <h1 className="text-5xl lg:text-7xl font-black text-stellar-heading leading-tight tracking-tight">
                Write Soroban
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-stellar-accent via-blue-400 to-indigo-400">
                  Contracts
                </span>
                <br />
                in the Browser
              </h1>
              <p className="mt-6 text-xl text-stellar-muted max-w-lg leading-relaxed">
                StellarIDE is the professional-grade, browser-native smart contract IDE for the Stellar ecosystem. 
                Write, test, and deploy Soroban contracts with zero setup.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Link to="/register">
                <Button size="lg" className="shadow-lg shadow-stellar-accent/20">
                  <Zap className="w-5 h-5" />
                  Start Building Free
                </Button>
              </Link>
              <a href="#preview">
                <Button variant="secondary" size="lg">
                  See it in Action
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </a>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-6 text-sm text-stellar-muted">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['A', 'B', 'C', 'D'].map((l) => (
                    <div key={l} className="w-7 h-7 rounded-full bg-stellar-accent/20 border-2 border-stellar-bg flex items-center justify-center text-xs text-stellar-accent font-bold">
                      {l}
                    </div>
                  ))}
                </div>
                <span>500+ developers building</span>
              </div>
              <div className="h-4 w-px bg-stellar-border" />
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                ))}
                <span>4.9/5 rating</span>
              </div>
            </div>
          </div>

          {/* Right: code preview */}
          <div className="relative animate-slide-up">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-stellar-accent/20 via-blue-500/20 to-indigo-500/20 blur-sm" />
            <div className="relative bg-stellar-surface rounded-2xl border border-stellar-border overflow-hidden shadow-2xl">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-stellar-border bg-stellar-card">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xs text-stellar-muted font-mono">token_contract.rs</span>
                </div>
              </div>

              {/* Code */}
              <pre className="p-6 text-xs font-mono leading-relaxed overflow-x-auto">
                {CODE_SNIPPET.split('\n').map((line, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-stellar-border select-none w-5 text-right flex-shrink-0">{i + 1}</span>
                    <span
                      className="text-stellar-text"
                      dangerouslySetInnerHTML={{
                        __html: line
                          .replace(/\b(use|pub|fn|impl|let|struct|mod)\b/g, '<span class="text-blue-400">$1</span>')
                          .replace(/\b(Env|Address|TokenContract|Self)\b/g, '<span class="text-yellow-400">$1</span>')
                          .replace(/#!\[.*?\]|#\[.*?\]/g, '<span class="text-stellar-accent">$&</span>')
                          .replace(/\/\/.*/g, '<span class="text-stellar-muted">$&</span>')
                          .replace(/".*?"/g, '<span class="text-green-400">$&</span>')
                          || '&nbsp;',
                      }}
                    />
                  </div>
                ))}
              </pre>

              {/* Status bar */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-stellar-border bg-stellar-card text-xs text-stellar-muted font-mono">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span>Ready</span>
                </div>
                <span>Rust</span>
                <span>Soroban SDK v25</span>
                <span className="ml-auto">Ln 1, Col 1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

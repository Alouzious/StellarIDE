export default {
  title: 'Understanding compile errors',
  description: 'Common beginner errors and how to fix them in StellarIDE.',
  editFile: 'guide/compile-errors.js',
  sections: [
    {
      id: 'no-such-crate',
      title: '"no such crate" or dependency errors',
      body: `**Cause**: \`Cargo.toml\` is missing a dependency or the name is wrong.

**Fix**: Open \`Cargo.toml\` and confirm \`soroban-sdk = "22.0.11"\` (or your target version) is under \`[dependencies]\`.`,
    },
    {
      id: 'address-type',
      title: '"cannot find type Address"',
      body: `**Cause**: \`Address\` is not imported from \`soroban_sdk\`.

**Fix**: Add \`Address\` to your import line:

\`\`\`rust
use soroban_sdk::{contract, contractimpl, Address, Env};
\`\`\``,
    },
    {
      id: 'function-not-found',
      title: '"function not found" or wrong method name',
      body: `**Cause**: Typo in a function name or calling a method that does not exist on the SDK type.

**Fix**: Check spelling and compare with [Soroban docs](https://developers.stellar.org/docs/build/smart-contracts). Use **Explain** in the IDE for context-specific help.`,
    },
    {
      id: 'require-auth',
      title: 'Missing require_auth() / audit warnings',
      body: `**Cause**: A function changes storage or moves value but does not verify who called it.

**Fix**: Add at the start of the function:

\`\`\`rust
caller.require_auth();
\`\`\`

Pass the \`Address\` of the account that must sign. Run **Audit** to confirm Scout no longer flags the issue.`,
    },
    {
      id: 'wasm-errors',
      title: 'WASM build errors',
      body: `**Cause**: Rust code uses features not allowed on-chain (std library, threads, etc.).

**Fix**: Keep \`#![no_std]\` at the top. Use \`soroban_sdk\` types only. Remove \`println!\` and standard library imports.`,
    },
  ],
}

use serde::Serialize;

const SDK_VERSION: &str = "22.0.11";

#[derive(Debug, Clone, Serialize)]
pub struct TemplateFile {
    pub path: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
}

impl TemplateFile {
    fn rust(path: &str, content: &str) -> Self {
        Self {
            path: path.into(),
            content: content.into(),
            language: Some("rust".into()),
        }
    }

    fn toml(content: &str) -> Self {
        Self {
            path: "Cargo.toml".into(),
            content: content.into(),
            language: Some("toml".into()),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ContractTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub files: Vec<TemplateFile>,
}

fn cargo_toml() -> String {
    format!(
        r#"[package]
name = "stellaride_contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = "{SDK_VERSION}"

[dev-dependencies]
soroban-sdk = {{ version = "{SDK_VERSION}", features = ["testutils"] }}
"#
    )
}

fn blank_lib() -> &'static str {
    r##"#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

/// Empty Soroban contract. Start from scratch.
#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Placeholder entry point.
    pub fn hello(_env: Env) -> u32 {
        1
    }
}
"##
}

fn hello_world_lib() -> &'static str {
    r##"#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol};

/// Simple contract that stores and returns a greeting.
#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    /// Store the default greeting on first use.
    pub fn init(env: Env) {
        if !env.storage().instance().has(&symbol_short!("GREET")) {
            env.storage()
                .instance()
                .set(&symbol_short!("GREET"), &symbol_short!("Hello"));
        }
    }

    /// Return the stored greeting.
    pub fn get_greeting(env: Env) -> Symbol {
        env.storage()
            .instance()
            .get(&symbol_short!("GREET"))
            .unwrap_or(symbol_short!("Hello"))
    }

    /// Update the greeting. Caller must authorize.
    pub fn set_greeting(env: Env, caller: Address, greeting: Symbol) {
        caller.require_auth();
        env.storage().instance().set(&symbol_short!("GREET"), &greeting);
    }
}
"##
}

fn token_lib() -> &'static str {
    r##"#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

/// SEP-41 style fungible token with mint, burn, transfer, and allowance.
#[contract]
pub struct TokenContract;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(Address, Address),
}

#[contractimpl]
impl TokenContract {
    /// Set the admin address. Admin must authorize.
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Mint tokens to an address. Admin must authorize.
    pub fn mint(env: Env, admin: Address, to: Address, amount: i128) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let bal = Self::read_balance(&env, &to);
        env.storage()
            .instance()
            .set(&DataKey::Balance(to), &(bal + amount));
    }

    /// Burn tokens from caller's balance.
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let bal = Self::read_balance(&env, &from);
        if bal < amount {
            panic!("insufficient balance");
        }
        env.storage()
            .instance()
            .set(&DataKey::Balance(from), &(bal - amount));
    }

    /// Transfer tokens from caller to another address.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        Self::move_balance(&env, &from, &to, amount);
    }

    /// Return token balance for an address.
    pub fn balance(env: Env, id: Address) -> i128 {
        Self::read_balance(&env, &id)
    }

    /// Approve a spender allowance. Owner must authorize.
    pub fn approve(env: Env, from: Address, spender: Address, amount: i128) {
        from.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::Allowance(from, spender), &amount);
    }

    /// Return remaining allowance for spender.
    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Allowance(from, spender))
            .unwrap_or(0)
    }

    /// Transfer using an allowance. Spender must authorize.
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let allowed: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Allowance(from.clone(), spender))
            .unwrap_or(0);
        if allowed < amount {
            panic!("insufficient allowance");
        }
        env.storage()
            .instance()
            .set(&DataKey::Allowance(from.clone(), spender), &(allowed - amount));
        Self::move_balance(&env, &from, &to, amount);
    }

    fn require_admin(env: &Env, admin: &Address) {
        let stored: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        if stored != *admin {
            panic!("not admin");
        }
    }

    fn read_balance(env: &Env, id: &Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Balance(id.clone()))
            .unwrap_or(0)
    }

    fn move_balance(env: &Env, from: &Address, to: &Address, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let from_bal = Self::read_balance(env, from);
        if from_bal < amount {
            panic!("insufficient balance");
        }
        let to_bal = Self::read_balance(env, to);
        env.storage()
            .instance()
            .set(&DataKey::Balance(from.clone()), &(from_bal - amount));
        env.storage()
            .instance()
            .set(&DataKey::Balance(to.clone()), &(to_bal + amount));
    }
}
"##
}

fn nft_lib() -> &'static str {
    r##"#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

/// Non-fungible token with mint, transfer, owner lookup, and metadata URI.
#[contract]
pub struct NftContract;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    NextId,
    Owner(u32),
    Uri(u32),
}

#[contractimpl]
impl NftContract {
    /// Set admin who can mint new tokens.
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextId, &1u32);
    }

    /// Mint a new NFT to `to`. Admin must authorize.
    pub fn mint(env: Env, admin: Address, to: Address, uri: String) -> u32 {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        let id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap_or(1);
        env.storage().instance().set(&DataKey::Owner(id), &to);
        env.storage().instance().set(&DataKey::Uri(id), &uri);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        id
    }

    /// Transfer NFT to a new owner. Current owner must authorize.
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u32) {
        from.require_auth();
        let owner: Address = env.storage().instance().get(&DataKey::Owner(token_id)).expect("no token");
        if owner != from {
            panic!("not owner");
        }
        env.storage().instance().set(&DataKey::Owner(token_id), &to);
    }

    /// Return owner of a token id.
    pub fn owner_of(env: Env, token_id: u32) -> Address {
        env.storage().instance().get(&DataKey::Owner(token_id)).expect("no token")
    }

    /// Return metadata URI for a token id.
    pub fn token_uri(env: Env, token_id: u32) -> String {
        env.storage().instance().get(&DataKey::Uri(token_id)).expect("no token")
    }

    fn require_admin(env: &Env, admin: &Address) {
        let stored: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        if stored != *admin {
            panic!("not admin");
        }
    }
}
"##
}

fn voting_lib() -> &'static str {
    r##"#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

/// On-chain voting with proposals, votes, and tallies.
#[contract]
pub struct VotingContract;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    NextProposal,
    Title(u32),
    Active(u32),
    Yes(u32),
    No(u32),
    Voted(u32, Address),
}

#[contractimpl]
impl VotingContract {
    /// Set contract admin.
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextProposal, &1u32);
    }

    /// Create a proposal. Admin must authorize.
    pub fn create_proposal(env: Env, admin: Address, title: Symbol) -> u32 {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        let id: u32 = env.storage().instance().get(&DataKey::NextProposal).unwrap_or(1);
        env.storage().instance().set(&DataKey::Title(id), &title);
        env.storage().instance().set(&DataKey::Active(id), &true);
        env.storage().instance().set(&DataKey::Yes(id), &0i128);
        env.storage().instance().set(&DataKey::No(id), &0i128);
        env.storage().instance().set(&DataKey::NextProposal, &(id + 1));
        id
    }

    /// Cast a vote (true = yes). Voter must authorize once per proposal.
    pub fn vote(env: Env, voter: Address, proposal_id: u32, support: bool) {
        voter.require_auth();
        if !env.storage().instance().get(&DataKey::Active(proposal_id)).unwrap_or(false) {
            panic!("proposal inactive");
        }
        if env.storage().instance().has(&DataKey::Voted(proposal_id, voter.clone())) {
            panic!("already voted");
        }
        env.storage().instance().set(&DataKey::Voted(proposal_id, voter), &true);
        if support {
            let yes: i128 = env.storage().instance().get(&DataKey::Yes(proposal_id)).unwrap_or(0);
            env.storage().instance().set(&DataKey::Yes(proposal_id), &(yes + 1));
        } else {
            let no: i128 = env.storage().instance().get(&DataKey::No(proposal_id)).unwrap_or(0);
            env.storage().instance().set(&DataKey::No(proposal_id), &(no + 1));
        }
    }

    /// Return yes/no vote counts.
    pub fn get_results(env: Env, proposal_id: u32) -> (i128, i128) {
        let yes = env.storage().instance().get(&DataKey::Yes(proposal_id)).unwrap_or(0);
        let no = env.storage().instance().get(&DataKey::No(proposal_id)).unwrap_or(0);
        (yes, no)
    }

    /// Return whether a proposal accepts votes.
    pub fn is_active(env: Env, proposal_id: u32) -> bool {
        env.storage().instance().get(&DataKey::Active(proposal_id)).unwrap_or(false)
    }

    fn require_admin(env: &Env, admin: &Address) {
        let stored: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        if stored != *admin {
            panic!("not admin");
        }
    }
}
"##
}

fn escrow_lib() -> &'static str {
    r##"#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

/// Escrow contract: deposit, release to recipient, or refund depositor.
#[contract]
pub struct EscrowContract;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Depositor,
    Recipient,
    Amount,
    Released,
}

#[contractimpl]
impl EscrowContract {
    /// Initialize escrow parties and amount. Depositor must authorize.
    pub fn initialize(env: Env, depositor: Address, recipient: Address, amount: i128) {
        depositor.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        env.storage().instance().set(&DataKey::Depositor, &depositor);
        env.storage().instance().set(&DataKey::Recipient, &recipient);
        env.storage().instance().set(&DataKey::Amount, &amount);
        env.storage().instance().set(&DataKey::Released, &false);
    }

    /// Record a deposit (logical; integrate token transfer in production).
    pub fn deposit(env: Env, depositor: Address) {
        depositor.require_auth();
        let stored: Address = env.storage().instance().get(&DataKey::Depositor).expect("not initialized");
        if stored != depositor {
            panic!("not depositor");
        }
    }

    /// Release escrow to recipient. Depositor must authorize.
    pub fn release(env: Env, depositor: Address) {
        depositor.require_auth();
        if env.storage().instance().get(&DataKey::Released).unwrap_or(false) {
            panic!("already released");
        }
        env.storage().instance().set(&DataKey::Released, &true);
    }

    /// Refund escrow to depositor. Depositor must authorize.
    pub fn refund(env: Env, depositor: Address) {
        depositor.require_auth();
        if env.storage().instance().get(&DataKey::Released).unwrap_or(false) {
            panic!("already released");
        }
        env.storage().instance().set(&DataKey::Released, &true);
    }

    /// Return escrow amount.
    pub fn get_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Amount).unwrap_or(0)
    }
}
"##
}

fn multisig_lib() -> &'static str {
    r##"#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

/// Multisig-style approval flow before executing an action.
#[contract]
pub struct MultisigContract;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Threshold,
    Signer(u32),
    SignerCount,
    NextProposal,
    Action(u32),
    Approvals(u32),
    Approved(u32, Address),
    Executed(u32),
}

#[contractimpl]
impl MultisigContract {
    /// Initialize signers and approval threshold.
    pub fn initialize(env: Env, admin: Address, signers: Vec<Address>, threshold: u32) {
        admin.require_auth();
        if threshold == 0 || threshold as usize > signers.len() {
            panic!("invalid threshold");
        }
        env.storage().instance().set(&DataKey::Threshold, &threshold);
        env.storage().instance().set(&DataKey::SignerCount, &(signers.len() as u32));
        for (i, signer) in signers.iter().enumerate() {
            env.storage().instance().set(&DataKey::Signer(i as u32), signer);
        }
        env.storage().instance().set(&DataKey::NextProposal, &1u32);
    }

    /// Propose an action label. Any signer may propose.
    pub fn propose(env: Env, proposer: Address, action: Symbol) -> u32 {
        proposer.require_auth();
        Self::require_signer(&env, &proposer);
        let id: u32 = env.storage().instance().get(&DataKey::NextProposal).unwrap_or(1);
        env.storage().instance().set(&DataKey::Action(id), &action);
        env.storage().instance().set(&DataKey::Approvals(id), &0u32);
        env.storage().instance().set(&DataKey::Executed(id), &false);
        env.storage().instance().set(&DataKey::NextProposal, &(id + 1));
        id
    }

    /// Approve a proposal. Signer must authorize.
    pub fn approve(env: Env, signer: Address, proposal_id: u32) {
        signer.require_auth();
        Self::require_signer(&env, &signer);
        if env.storage().instance().get(&DataKey::Executed(proposal_id)).unwrap_or(false) {
            panic!("already executed");
        }
        if env.storage().instance().has(&DataKey::Approved(proposal_id, signer.clone())) {
            panic!("already approved");
        }
        env.storage().instance().set(&DataKey::Approved(proposal_id, signer), &true);
        let count: u32 = env.storage().instance().get(&DataKey::Approvals(proposal_id)).unwrap_or(0);
        env.storage().instance().set(&DataKey::Approvals(proposal_id), &(count + 1));
    }

    /// Execute when threshold is met. Any signer may execute.
    pub fn execute(env: Env, executor: Address, proposal_id: u32) {
        executor.require_auth();
        Self::require_signer(&env, &executor);
        let threshold: u32 = env.storage().instance().get(&DataKey::Threshold).expect("not initialized");
        let approvals: u32 = env.storage().instance().get(&DataKey::Approvals(proposal_id)).unwrap_or(0);
        if approvals < threshold {
            panic!("not enough approvals");
        }
        env.storage().instance().set(&DataKey::Executed(proposal_id), &true);
    }

    /// Return approval count for a proposal.
    pub fn get_approvals(env: Env, proposal_id: u32) -> u32 {
        env.storage().instance().get(&DataKey::Approvals(proposal_id)).unwrap_or(0)
    }

    fn require_signer(env: &Env, addr: &Address) {
        let count: u32 = env.storage().instance().get(&DataKey::SignerCount).unwrap_or(0);
        for i in 0..count {
            let signer: Address = env.storage().instance().get(&DataKey::Signer(i)).expect("signer");
            if signer == *addr {
                return;
            }
        }
        panic!("not signer");
    }
}
"##
}

fn counter_lib() -> &'static str {
    r##"#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Env};

/// Simple counter with increment, decrement, reset, and read.
#[contract]
pub struct CounterContract;

#[contractimpl]
impl CounterContract {
    /// Return current count (defaults to 0).
    pub fn get_count(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&symbol_short!("COUNT"))
            .unwrap_or(0)
    }

    /// Increase count by one. Caller must authorize.
    pub fn increment(env: Env, caller: soroban_sdk::Address) {
        caller.require_auth();
        let count = Self::get_count(env.clone());
        env.storage().instance().set(&symbol_short!("COUNT"), &(count + 1));
    }

    /// Decrease count by one. Caller must authorize.
    pub fn decrement(env: Env, caller: soroban_sdk::Address) {
        caller.require_auth();
        let count = Self::get_count(env.clone());
        env.storage().instance().set(&symbol_short!("COUNT"), &(count - 1));
    }

    /// Reset count to zero. Caller must authorize.
    pub fn reset(env: Env, caller: soroban_sdk::Address) {
        caller.require_auth();
        env.storage().instance().set(&symbol_short!("COUNT"), &0i128);
    }
}
"##
}

fn template_files(lib: &str) -> Vec<TemplateFile> {
    vec![TemplateFile::rust("src/lib.rs", lib), TemplateFile::toml(&cargo_toml())]
}

fn all_templates_data() -> Vec<ContractTemplate> {
    vec![
        ContractTemplate {
            id: "blank".into(),
            name: "Blank Contract".into(),
            description: "Empty Soroban contract. Start from scratch.".into(),
            tags: vec!["Beginner".into()],
            files: template_files(blank_lib()),
        },
        ContractTemplate {
            id: "hello-world".into(),
            name: "Hello World".into(),
            description: "A simple contract that stores and returns a greeting.".into(),
            tags: vec!["Beginner".into()],
            files: template_files(hello_world_lib()),
        },
        ContractTemplate {
            id: "token".into(),
            name: "Token Contract (SEP-41)".into(),
            description: "Fungible token following the Stellar SEP-41 standard.".into(),
            tags: vec!["DeFi".into(), "Token".into()],
            files: template_files(token_lib()),
        },
        ContractTemplate {
            id: "nft".into(),
            name: "NFT Contract".into(),
            description: "Non-fungible token with mint, transfer, and metadata.".into(),
            tags: vec!["NFT".into()],
            files: template_files(nft_lib()),
        },
        ContractTemplate {
            id: "voting".into(),
            name: "Voting Contract".into(),
            description: "On-chain voting with proposals, votes, and results.".into(),
            tags: vec!["Governance".into()],
            files: template_files(voting_lib()),
        },
        ContractTemplate {
            id: "escrow".into(),
            name: "Escrow Contract".into(),
            description: "Hold funds until conditions are met. Supports refunds.".into(),
            tags: vec!["DeFi".into()],
            files: template_files(escrow_lib()),
        },
        ContractTemplate {
            id: "multisig".into(),
            name: "Multisig Contract".into(),
            description: "Require multiple signatures before executing a transaction.".into(),
            tags: vec!["Security".into(), "Governance".into()],
            files: template_files(multisig_lib()),
        },
        ContractTemplate {
            id: "counter".into(),
            name: "Counter Contract".into(),
            description: "Simple counter with increment, decrement, and reset.".into(),
            tags: vec!["Beginner".into()],
            files: template_files(counter_lib()),
        },
    ]
}

pub fn list_templates() -> Vec<ContractTemplate> {
    all_templates_data()
        .into_iter()
        .map(|t| ContractTemplate {
            files: t
                .files
                .into_iter()
                .map(|f| TemplateFile {
                    language: f.language,
                    path: f.path,
                    content: f.content,
                })
                .collect(),
            ..t
        })
        .collect()
}

pub fn get_template(id: &str) -> Option<ContractTemplate> {
    all_templates_data().into_iter().find(|t| t.id == id)
}

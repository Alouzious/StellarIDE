# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM rust:latest AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY src ./src
COPY migrations ./migrations

ENV SQLX_OFFLINE=true
RUN cargo build --release

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM rust:latest AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    curl \
    pkg-config \
    libssl-dev \
    libdbus-1-3 \
    libdbus-1-dev \
    && rm -rf /var/lib/apt/lists/*

# Download pre-built stellar CLI binary
RUN curl -L https://github.com/stellar/stellar-cli/releases/download/v23.4.0/stellar-cli-23.4.0-x86_64-unknown-linux-gnu.tar.gz \
    | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/stellar \
    && ln -sf /usr/local/bin/stellar /usr/local/bin/soroban

# wasm32 target for compile/test
RUN rustup target add wasm32-unknown-unknown

# Scout static analyzer for contract auditing (local execution on Render)
RUN cargo install cargo-scout-audit --version 0.3.16

# Pre-compile Scout detectors so first audit run is fast
RUN mkdir -p /tmp/scout-warmup/src && \
    echo '#![no_std]\nuse soroban_sdk::{contract, contractimpl};\n#[contract]\npub struct W;\n#[contractimpl]\nimpl W {}' \
    > /tmp/scout-warmup/src/lib.rs && \
    echo '[package]\nname="warmup"\nversion="0.1.0"\nedition="2021"\n[lib]\ncrate-type=["cdylib"]\n[dependencies]\nsoroban-sdk={version="22"}' \
    > /tmp/scout-warmup/Cargo.toml && \
    cd /tmp/scout-warmup && \
    cargo scout-audit --output-format json || true

WORKDIR /app
COPY --from=builder /app/target/release/backend ./backend
COPY --from=builder /app/migrations ./migrations

EXPOSE 8080
CMD ["./backend"]

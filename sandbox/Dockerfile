FROM rust:latest

ENV PATH="/usr/local/cargo/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    pkg-config \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# wasm32 target
RUN rustup target add wasm32-unknown-unknown

# Download pre-built stellar CLI binary instead of compiling from source
RUN curl -L https://github.com/stellar/stellar-cli/releases/download/v22.6.0/stellar-cli-22.6.0-x86_64-unknown-linux-gnu.tar.gz \
    | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/stellar \
    && ln -sf /usr/local/bin/stellar /usr/local/bin/soroban

WORKDIR /workspace

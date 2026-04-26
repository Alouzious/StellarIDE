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

WORKDIR /app
COPY --from=builder /app/target/release/backend ./backend
COPY --from=builder /app/migrations ./migrations

EXPOSE 8080
CMD ["./backend"]

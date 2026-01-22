# Anoma

**Privacy-Enhanced Cash on Solana**

👉 **Live:** [https://anoma.cash/](https://anoma.cash/)

Anoma is a privacy-focused wallet layer on Solana that reduces on-chain linkability between deposits and withdrawals through address rotation, pooled execution, and locally enforced balance abstraction. Users can deposit, manage, and withdraw SOL and SPL tokens without withdrawals being directly tied to the original deposit addresses.

---

## Overview

Anoma abstracts direct interaction with individual deposits by using a shared execution layer combined with local, device-scoped balance tracking. Deposited assets are consolidated into a platform pool and represented as locally maintained internal balance credits. Withdrawals are executed from the pool rather than from deposit addresses, reducing the ability to correlate the two on-chain.

### Key Principles

- Rotating deposit addresses  
- Pooled liquidity execution  
- Deterministic balance enforcement  
- ACASH token used for fees  
- Relay-style transaction submission  
- Local device–scoped state (no cloud database)

---

## What Anoma Provides

- Separation of deposit and withdrawal flows  
- Reduced on-chain correlation via address rotation  
- Unified pool for SOL and SPL liquidity  
- Internal balance credits tracked on the user’s device  
- Single-use enforcement of value  
- Simple fee model using **$ACASH**  
- Platform-executed transactions (no user broadcasting)  
- No cloud-hosted user database or third-party auth layer  

---

## Balance Model

credit = (asset_type, amount, reference)<br>
user_balance = Σ credits – Σ withdrawals – Σ fees


Deposits become internal balance credits stored and enforced locally on the user’s device, independent from the original on-chain transaction.

Each unit of value can be withdrawn only once, enforced through deterministic accounting rather than external database state.

---

## Protocol Flow

### 1. Deposit (User → Platform)

- User sends SOL to a rotating deposit address  
- Funds are automatically consolidated into the platform pool  
- A local internal balance credit is created  
- ACASH may be deposited to cover execution fees  
- Deposit addresses are never reused for withdrawals  

### 2. Local Accounting & Enforcement

- All SOL and SPL tokens are held collectively in the platform pool  
- User ownership is represented through locally tracked balance credits  
- Balances are enforced deterministically per device  
- Fees and deductions are applied locally and verified before execution  
- Multiple users share the same on-chain liquidity layer, without sharing local state  

### 3. Withdraw (Platform → User)

- System verifies available balance and ACASH fees using local state  
- Transfer is executed from the platform pool to the destination address  
- Spent value is marked locally as used to prevent reuse  
- Withdrawal execution is independent of the original deposit transaction  

---

## Relaying Model

Platform operations are executed through the Anoma execution layer rather than directly by the user on-chain. This abstracts transaction broadcasting from the user and separates the observable sender from the destination address.

Relayed execution works in combination with locally enforced balances, ensuring that transaction authorization does not rely on cloud-hosted user state.

---

## Keys & Addresses

- **Deposit Address (da)** – rotating Solana address used for receiving deposits  
- **Platform Execution Layer (pel)** – component that submits and coordinates consolidations and withdrawals  
- **Destination Address (wda)** – user-provided Solana address for withdrawals  

Users do not manage specialized cryptographic keys for accounting.  
Ownership is represented through balances maintained locally on the user’s device, not through remote accounts.

---

## Security Model

| Concept              | Implementation                                              |
|----------------------|-------------------------------------------------------------|
| Balance Model        | Local internal credits representing claims on pooled assets |
| Transaction Signing  | Standard Solana Ed25519 transactions                        |
| Address Rotation     | Rotating deposit addresses to reduce correlation            |
| Ledger Structure     | Deterministic accounting with single-use enforcement        |
| Value Tracking       | Credits independent from deposit transactions               |
| State Scope          | Device-local (no cloud persistence)                         |
| Execution Authority  | Platform execution layer                                   |

---

## Design Philosophy

Anoma favors local determinism over centralized state, reducing reliance on third-party infrastructure while preserving strong execution guarantees. Privacy is achieved not through obfuscation, but through structural separation of deposits, balances, and withdrawals.

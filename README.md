# Real Estate Escrow

![banner](assets/banner.jpg)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Ethereum](https://img.shields.io/badge/Ethereum-Mainnet-627EEA.svg)](https://etherscan.io)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org)

Earnest-money escrow with an inspection contingency — the escrow agent, as
code. Built on [Hardhat](https://hardhat.org),
[OpenZeppelin Contracts](https://openzeppelin.com/contracts), and
[viem](https://viem.sh).

**What it is:** a neutral smart contract holds the buyer's earnest money. The
buyer can release it to the seller or cancel for a full refund while the
inspection window is open. If the parties deadlock, a pre-agreed arbiter
resolves it either way. No escrow company, no waiting on wire cutoffs, no
"the check is in the mail."

## Quickstart

```bash
npm install
npx hardhat compile
npm run build

cp .env.example .env   # fill in RPC_URL, PRIVATE_KEY, BUYER, SELLER, ARBITER, INSPECTION_DAYS
npm run deploy         # set CONTRACT_ADDRESS in .env afterwards

# Buyer deposits earnest money (run with the BUYER's key):
AMOUNT_ETH=1.5 npm run fund

# Deal is good — buyer releases funds to the seller:
npm run release         # buyer key -> approveRelease(); arbiter key -> resolveRelease()

# Deal is bad — buyer cancels within the inspection window:
npm run refund          # buyer key -> cancel(); arbiter key -> resolveRefund()
```

## State machine

```
                    fund() [buyer]
AWAITING_FUNDING ──────────────────► FUNDED
                                        │
        ┌───────────────┬───────────────┼────────────────┐
        │               │               │                │
  approveRelease    cancel          resolveRelease   resolveRefund
  [buyer]           [buyer, before   [arbiter]        [arbiter]
                     deadline]       │                │
        │               │               │                │
        ▼               ▼               ▼                ▼
     RELEASED       REFUNDED        RELEASED         REFUNDED
   (seller paid)  (buyer refunded)
```

Terminal states (`RELEASED`, `REFUNDED`) are one-way — once funds move, the
escrow is done. There is no re-funding an existing escrow; deploy a fresh one
per transaction.

## Contract reference

| Function | Who | When | Effect |
|---|---|---|---|
| `fund()` | buyer | `AWAITING_FUNDING`, `msg.value > 0` | → `FUNDED` |
| `approveRelease()` | buyer | `FUNDED` | pays seller → `RELEASED` |
| `cancel()` | buyer | `FUNDED`, before `inspectionDeadline` | refunds buyer → `REFUNDED` |
| `resolveRelease()` | arbiter | `FUNDED` | pays seller → `RELEASED` |
| `resolveRefund()` | arbiter | `FUNDED` | refunds buyer → `REFUNDED` |

Events: `Funded`, `Released`, `Refunded`, `Resolved`.

## Security notes

- **The arbiter is trusted — by design.** `resolveRelease` / `resolveRefund`
  let the arbiter move the full balance either way, at any time while funded.
  Pick someone both parties genuinely trust (title attorney, broker of record),
  never a party to the deal. The constructor enforces three distinct,
  non-zero addresses.
- **Deadlines are on-chain.** The inspection window is measured in
  `block.timestamp`. Miners can skew it by seconds, not days — fine for a
  multi-day window, not for a one-hour one.
- **Transfers use `call` with a reentrancy guard**, and state is set before
  any external call (checks-effects-interactions). If the seller or buyer is
  a contract that rejects ETH, the payout reverts and funds stay locked —
  use EOAs or ETH-compatible receivers.
- **This template has not been audited.** Do not escrow real money until the
  contract — and your off-chain purchase agreement referencing it — has been
  reviewed by qualified professionals. The contract enforces the money flow;
  it does not replace the legal purchase contract.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).

# 🗳️ African Cities Vote

An on-chain voting app built on the **Stacks blockchain**. Vote for Africa's greatest city — Lagos, Nairobi, Accra, or Cairo. One wallet, one vote. Forever on-chain.

**Live contract:** `SP1MQ1TJJE8PQRDW2WBCFQSVHCZMWTHJSDM5EJBBQ.african-cities-vote`

---

## Tech Stack

- **React 18** — frontend framework
- **@stacks/connect** — wallet connection (Leather / Xverse)
- **@stacks/transactions** — Clarity contract interaction
- **Stacks Mainnet** — blockchain

---

## Getting Started

### Prerequisites
- Node.js 16+
- A Stacks wallet: [Leather](https://leather.io) or [Xverse](https://xverse.app)

### Install & Run

```bash
npm install
npm start
```

Opens at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

---

## Deploy on Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import repository
3. Click **Deploy** — no extra config needed

---

## Project Structure

```
src/
├── App.jsx              # Main app logic & layout
├── App.module.css       # App styles
├── stacksUtils.js       # Contract config & Stacks helpers
├── index.js             # React entry point
├── index.css            # Global styles
└── components/
    ├── WalletConnect.jsx        # Wallet connect button
    ├── WalletConnect.module.css
    ├── CityCard.jsx             # Individual city vote card
    ├── CityCard.module.css
    ├── StatusMessage.jsx        # Status / error / success messages
    └── StatusMessage.module.css
```

---

## Built for the Stacks Builder Challenge on Talent Protocol

// ─── Wallet address ───────────────────────────────────────────────────────────
export const DEPLOYER = 'SP1MQ1TJJE8PQRDW2WBCFQSVHCZMWTHJSDM5EJBBQ';
export const STACKS_API = 'https://api.hiro.so';
export const NETWORK = 'mainnet';

// ─── All 5 polls ──────────────────────────────────────────────────────────────
export const POLLS = [
  {
    id: 'african-cities-vote',
    title: 'Best African City for Tech',
    question: 'Which city leads Africa\'s tech scene?',
    emoji: '🏙️',
    options: [
      { id: 'lagos',   label: 'Lagos',   detail: 'Nigeria 🇳🇬' },
      { id: 'nairobi', label: 'Nairobi', detail: 'Kenya 🇰🇪' },
      { id: 'accra',   label: 'Accra',   detail: 'Ghana 🇬🇭' },
      { id: 'cairo',   label: 'Cairo',   detail: 'Egypt 🇪🇬' },
    ],
  },
  {
    id: 'africa-crypto-hub',
    title: 'Best Crypto Hub in Africa',
    question: 'Which city is Africa\'s crypto capital?',
    emoji: '₿',
    options: [
      { id: 'lagos',    label: 'Lagos',      detail: 'Nigeria 🇳🇬' },
      { id: 'capetown', label: 'Cape Town',  detail: 'South Africa 🇿🇦' },
      { id: 'nairobi',  label: 'Nairobi',    detail: 'Kenya 🇰🇪' },
      { id: 'cairo',    label: 'Cairo',      detail: 'Egypt 🇪🇬' },
    ],
  },
  {
    id: 'africa-best-stack',
    title: 'Most Popular Dev Stack in Africa',
    question: 'What do African devs build with most?',
    emoji: '⚡',
    options: [
      { id: 'react',    label: 'React',    detail: 'Frontend / Web' },
      { id: 'python',   label: 'Python',   detail: 'Backend / AI' },
      { id: 'rust',     label: 'Rust',     detail: 'Systems / Web3' },
      { id: 'solidity', label: 'Solidity', detail: 'Smart Contracts' },
    ],
  },
  {
    id: 'africa-blockchain',
    title: 'Best Blockchain for African Devs',
    question: 'Which chain do African builders prefer?',
    emoji: '🔗',
    options: [
      { id: 'stacks',   label: 'Stacks',   detail: 'Bitcoin L2' },
      { id: 'ethereum', label: 'Ethereum', detail: 'EVM / DeFi' },
      { id: 'solana',   label: 'Solana',   detail: 'High Speed' },
      { id: 'cardano',  label: 'Cardano',  detail: 'Peer Reviewed' },
    ],
  },
  {
    id: 'africa-startup-city',
    title: 'Best African City to Launch a Startup',
    question: 'Where should African founders build?',
    emoji: '🚀',
    options: [
      { id: 'lagos',   label: 'Lagos',   detail: 'Nigeria 🇳🇬' },
      { id: 'kigali',  label: 'Kigali',  detail: 'Rwanda 🇷🇼' },
      { id: 'nairobi', label: 'Nairobi', detail: 'Kenya 🇰🇪' },
      { id: 'accra',   label: 'Accra',   detail: 'Ghana 🇬🇭' },
    ],
  },
];

// ─── Fetch vote counts for a contract ────────────────────────────────────────
export async function fetchVoteCounts(contractName) {
  try {
    const res = await fetch(
      `${STACKS_API}/v2/contracts/call-read/${DEPLOYER}/${contractName}/get-votes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: DEPLOYER, arguments: [] }),
      }
    );
    const json = await res.json();
    if (!json.okay || !json.result) return null;
    return decodeTupleUints(json.result);
  } catch {
    return null;
  }
}

// ─── Check if wallet has voted ────────────────────────────────────────────────
export async function checkHasVoted(contractName, walletAddress) {
  try {
    const principalHex = '0x' + Array.from(walletAddress)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    const res = await fetch(
      `${STACKS_API}/v2/contracts/call-read/${DEPLOYER}/${contractName}/has-wallet-voted`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: walletAddress, arguments: [principalHex] }),
      }
    );
    const json = await res.json();
    return json?.result?.includes('03') ?? false;
  } catch {
    return false;
  }
}

// ─── Encode Clarity string-ascii CV ──────────────────────────────────────────
export function encodeStringAsciiCV(str) {
  const hex = Array.from(str)
    .map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  return '0x0d' + str.length.toString(16).padStart(8, '0') + hex;
}

// ─── Decode Clarity (ok (tuple ...)) hex → { key: number } ───────────────────
function decodeTupleUints(hexResult) {
  try {
    const clean = hexResult.startsWith('0x') ? hexResult.slice(2) : hexResult;
    const bytes = clean.match(/.{1,2}/g).map(b => parseInt(b, 16));
    const uints = [];
    for (let i = 0; i < bytes.length - 16; i++) {
      if (bytes[i] === 0x01) {
        const val = bytes.slice(i + 1, i + 17)
          .reduce((acc, b) => acc * 256 + b, 0);
        uints.push(val);
        i += 16;
      }
    }
    return uints; // returned as array; caller maps by index (alphabetical key order)
  } catch {
    return [];
  }
}

// ─── Map raw uint array to option ids (alphabetical Clarity key order) ────────
export function mapVotesToOptions(uints, options) {
  // Clarity tuples are alphabetically sorted by key
  const sorted = [...options].sort((a, b) => a.id.localeCompare(b.id));
  const result = {};
  sorted.forEach((opt, i) => {
    result[opt.id] = uints[i] ?? 0;
  });
  return result;
}

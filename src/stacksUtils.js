// ─── Contract Config ──────────────────────────────────────────────────────────
export const CONTRACT_ADDRESS = 'SP1MQ1TJJE8PQRDW2WBCFQSVHCZMWTHJSDM5EJBBQ';
export const CONTRACT_NAME    = 'african-cities-vote';
export const STACKS_API       = 'https://api.hiro.so';
export const NETWORK          = 'mainnet';

export const CITIES = [
  { id: 'lagos',   label: 'Lagos',   country: 'Nigeria', flag: '🇳🇬' },
  { id: 'nairobi', label: 'Nairobi', country: 'Kenya',   flag: '🇰🇪' },
  { id: 'accra',   label: 'Accra',   country: 'Ghana',   flag: '🇬🇭' },
  { id: 'cairo',   label: 'Cairo',   country: 'Egypt',   flag: '🇪🇬' },
];

// ─── Fetch live vote counts from contract ─────────────────────────────────────
export async function fetchVoteCounts() {
  const res = await fetch(`${STACKS_API}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender: CONTRACT_ADDRESS, arguments: [] }),
  });
  const json = await res.json();

  if (!json.okay || !json.result) return null;

  // Decode Clarity (ok (tuple ...)) hex response
  return decodeTupleResponse(json.result);
}

// ─── Check if a wallet has already voted ─────────────────────────────────────
export async function checkHasVoted(walletAddress) {
  try {
    const principalCV = encodePrincipalCV(walletAddress);
    const res = await fetch(`${STACKS_API}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/has-wallet-voted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: walletAddress, arguments: [principalCV] }),
    });
    const json = await res.json();
    if (!json.okay || !json.result) return false;
    // Clarity bool true = ends with '03'
    return json.result.includes('03');
  } catch {
    return false;
  }
}

// ─── Encode city string as Clarity string-ascii CV ───────────────────────────
export function encodeStringAsciiCV(str) {
  const hex = Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  const lenHex = str.length.toString(16).padStart(8, '0');
  return '0x0d' + lenHex + hex;
}

// ─── Encode principal CV ──────────────────────────────────────────────────────
function encodePrincipalCV(address) {
  const hex = Array.from(address).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  return '0x' + hex;
}

// ─── Decode Clarity tuple hex to JS object ────────────────────────────────────
function decodeTupleResponse(hexResult) {
  // The result is a hex-encoded Clarity value. We parse it manually for uints.
  // Format: (ok (tuple (accra uint) (cairo uint) (lagos uint) (nairobi uint)))
  // Each uint is encoded as: 0x01 + 16 bytes big-endian
  try {
    const clean = hexResult.startsWith('0x') ? hexResult.slice(2) : hexResult;
    const bytes  = clean.match(/.{1,2}/g).map(b => parseInt(b, 16));

    // Walk bytes to find uint (type=0x01) values — they appear in alphabetical key order
    const uints = [];
    for (let i = 0; i < bytes.length - 16; i++) {
      if (bytes[i] === 0x01) {
        const hexValue = bytes
          .slice(i + 1, i + 17)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        uints.push(Number.parseInt(hexValue, 16));
        i += 16;
      }
    }

    if (uints.length === 4) {
      return {
        accra:   uints[0],
        cairo:   uints[1],
        lagos:   uints[2],
        nairobi: uints[3],
      };
    }
    return { lagos: 0, nairobi: 0, accra: 0, cairo: 0 };
  } catch {
    return { lagos: 0, nairobi: 0, accra: 0, cairo: 0 };
  }
}

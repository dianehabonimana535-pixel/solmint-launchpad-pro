import { Keypair } from "@solana/web3.js";

// Base58 alphabet used by Solana addresses (excludes 0, O, I, l to avoid
// visual ambiguity).
const VALID_BASE58 = /^[1-9A-HJ-NP-Za-km-z]*$/;

export function isValidVanityPrefix(prefix: string): boolean {
  return VALID_BASE58.test(prefix);
}

/**
 * Roughly how many keypairs need to be generated on average to find one
 * whose address starts with a prefix of this length. Used to warn the user
 * before they start a long-running grind.
 */
export function estimatedAttempts(prefixLength: number, caseSensitive: boolean): number {
  const base = caseSensitive ? 58 : 33; // rough case-insensitive alphabet size
  return Math.pow(base, prefixLength);
}

export interface VanityGrindOptions {
  prefix: string;
  caseSensitive?: boolean;
  onProgress?: (attempts: number) => void;
  signal?: AbortSignal;
  /** How many keypairs to try per chunk before yielding back to the UI thread. */
  chunkSize?: number;
}

export interface VanityGrindResult {
  keypair: Keypair;
  attempts: number;
}

/**
 * Grinds random Solana keypairs entirely client-side (nothing is sent over
 * the network) until one is found whose base58 public key starts with the
 * given prefix. Runs in small chunks with a yield back to the event loop
 * between each one, so the page stays responsive on a phone.
 */
export async function grindVanityAddress({
  prefix,
  caseSensitive = true,
  onProgress,
  signal,
  chunkSize = 300,
}: VanityGrindOptions): Promise<VanityGrindResult> {
  if (!prefix) throw new Error("Enter a prefix first");
  if (!isValidVanityPrefix(prefix)) {
    throw new Error("Prefix can only contain base58 characters (no 0, O, I, or l)");
  }

  const target = caseSensitive ? prefix : prefix.toLowerCase();
  let attempts = 0;

  for (;;) {
    if (signal?.aborted) {
      throw new DOMException("Vanity address search cancelled", "AbortError");
    }

    for (let i = 0; i < chunkSize; i++) {
      const kp = Keypair.generate();
      attempts++;
      const address = kp.publicKey.toBase58();
      const candidate = caseSensitive ? address : address.toLowerCase();
      if (candidate.startsWith(target)) {
        onProgress?.(attempts);
        return { keypair: kp, attempts };
      }
    }

    onProgress?.(attempts);
    // Yield to the event loop so the UI (and the cancel button) stays responsive.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

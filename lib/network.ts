import { Connection, clusterApiUrl } from "@solana/web3.js";

export const SOLANA_NETWORK =
  process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet" ? "devnet" : "mainnet-beta";

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL && process.env.NEXT_PUBLIC_SOLANA_RPC_URL.length > 0
    ? process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    : clusterApiUrl(SOLANA_NETWORK);

export function getConnection(): Connection {
  return new Connection(RPC_ENDPOINT, "confirmed");
}

const EXPLORER_CLUSTER_SUFFIX = SOLANA_NETWORK === "devnet" ? "?cluster=devnet" : "";

export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}${EXPLORER_CLUSTER_SUFFIX}`;
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}${EXPLORER_CLUSTER_SUFFIX}`;
}

const SOLSCAN_CLUSTER_SUFFIX = SOLANA_NETWORK === "devnet" ? "?cluster=devnet" : "";

export function solscanAddressUrl(address: string): string {
  return `https://solscan.io/token/${address}${SOLSCAN_CLUSTER_SUFFIX}`;
}

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}${SOLSCAN_CLUSTER_SUFFIX}`;
}

const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";

export function raydiumCreatePoolUrl(mintAddress: string): string {
  return `https://raydium.io/liquidity/create-pool/?base=${mintAddress}&quote=${NATIVE_SOL_MINT}`;
}

export const PLATFORM_FEE_WALLET =
  process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET &&
  process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET.length > 0
    ? process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET
    : "63kE7LaqwammEdKgaoygvCEGmbEkazZLBTRn2gJYzhhy";

export const SITE_URL = "https://luna-launch.vercel.app";

/**
 * Builds a pre-filled "Share on X" intent URL for a created token. Used both
 * right after mint and from the History page for past tokens.
 */
export function buildShareOnXUrl(
  name: string,
  symbol: string,
  mintAddress: string,
  revokedCount?: number
): string {
  const trustLine =
    revokedCount === 3
      ? "All authorities revoked, zero rug pull risk."
      : typeof revokedCount === "number" && revokedCount > 0
      ? `${revokedCount}/3 authorities revoked.`
      : "";

  const text = `🚀 ${name} ($${symbol}) just launched on Solana! ${trustLine}\n\nCA: ${mintAddress}\n${solscanAddressUrl(
    mintAddress
  )}\n${SITE_URL}`;

  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

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

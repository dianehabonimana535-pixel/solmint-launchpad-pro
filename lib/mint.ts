import { PublicKey, Connection, SystemProgram, Keypair } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  AuthorityType,
  createSetAuthorityInstruction,
} from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  fromWeb3JsInstruction,
  fromWeb3JsKeypair,
} from "@metaplex-foundation/umi-web3js-adapters";
import {
  mplTokenMetadata,
  createV1,
  mintV1,
  updateV1,
  TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createSignerFromKeypair,
  generateSigner,
  percentAmount,
  publicKey as toUmiPublicKey,
  sol,
  transactionBuilder,
  type WrappedInstruction,
} from "@metaplex-foundation/umi";
import { mplToolbox, transferSol } from "@metaplex-foundation/mpl-toolbox";
import bs58 from "bs58";
import { RPC_ENDPOINT, PLATFORM_FEE_WALLET } from "./network";
import { PLATFORM_CREATION_FEE_SOL, PLATFORM_REVOKE_FEE_SOL } from "./fees";

export interface CreateTokenParams {
  wallet: WalletContextState;
  connection: Connection;
  name: string;
  symbol: string;
  decimals: number;
  supply: number;
  metadataUri: string;
  recipient: string;
  revokeMint: boolean;
  revokeFreeze: boolean;
  revokeUpdate: boolean;
  creatorAddress?: string;
  mintKeypair?: Keypair; // optional vanity address keypair
  onStep?: (step: MintStep) => void;
}

export type MintStep =
  | "building"
  | "creating-mint"
  | "minting-supply"
  | "revoking-authorities"
  | "confirming"
  | "complete";

export interface CreateTokenResult {
  mintAddress: string;
  signature: string;
}

export async function createToken(params: CreateTokenParams): Promise<CreateTokenResult> {
  const {
    wallet,
    name,
    symbol,
    decimals,
    supply,
    metadataUri,
    recipient,
    revokeMint,
    revokeFreeze,
    revokeUpdate,
    creatorAddress,
    mintKeypair,
    onStep,
  } = params;

  if (!wallet.publicKey || !wallet.signAllTransactions) {
    throw new Error("Wallet not connected");
  }

  const recipientPubkey = new PublicKey(recipient);

  const umi = createUmi(RPC_ENDPOINT)
    .use(walletAdapterIdentity(wallet))
    .use(mplTokenMetadata())
    .use(mplToolbox());

  // Use the caller-supplied vanity keypair if provided, otherwise generate
  // a random mint keypair as before.
  const mintSigner = mintKeypair
    ? createSignerFromKeypair(umi, fromWeb3JsKeypair(mintKeypair))
    : generateSigner(umi);
  const authority = umi.identity;
  const mintPubkeyWeb3 = new PublicKey(mintSigner.publicKey.toString());

  const creatorPubkey = creatorAddress
    ? toUmiPublicKey(creatorAddress)
    : authority.publicKey;
  const creatorVerified = !creatorAddress;

  onStep?.("building");

  let builder = transactionBuilder()
    .add(
      createV1(umi, {
        mint: mintSigner,

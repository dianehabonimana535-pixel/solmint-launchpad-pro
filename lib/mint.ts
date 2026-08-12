import { PublicKey, Connection, SystemProgram } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  AuthorityType,
  createSetAuthorityInstruction,
} from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { fromWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import {
  mplTokenMetadata,
  createV1,
  mintV1,
  updateV1,
  TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  generateSigner,
  percentAmount,
  publicKey as toUmiPublicKey,
  sol,
  transactionBuilder,
  type WrappedInstruction,
} from "@metaplex-foundation/umi";
import { mplToolbox, transferSol, setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox";
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
  onStep?: (step: MintStep) => void;
}

// These reflect the real, distinct asynchronous boundaries of the single
// on-chain transaction: building it, waiting on the wallet to sign it,
// having obtained the signature, broadcasting it, and confirming it.
// There is only one transaction (mint + supply + authority revocations +
// fee transfer are all bundled together), so these are the only points
// where we can honestly report progress -- nothing here is simulated.
export type MintStep =
  | "building"
  | "awaiting-signature"
  | "signed"
  | "sent"
  | "confirmed"
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

  const mintSigner = generateSigner(umi);
  const authority = umi.identity;
  const mintPubkeyWeb3 = new PublicKey(mintSigner.publicKey.toString());

  const creatorPubkey = creatorAddress
    ? toUmiPublicKey(creatorAddress)
    : authority.publicKey;
  const creatorVerified = !creatorAddress;

  onStep?.("building");

  let builder = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      createV1(umi, {
        mint: mintSigner,
        authority,
        name,
        symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: percentAmount(0, 2),
        decimals,
        tokenStandard: TokenStandard.Fungible,
        creators: [{ address: creatorPubkey, verified: creatorVerified, share: 100 }],
      })
    )
    .add(
      mintV1(umi, {
        mint: mintSigner.publicKey,
        authority,
        amount: BigInt(Math.round(supply * 10 ** decimals)),
        tokenOwner: toUmiPublicKey(recipientPubkey.toBase58()),
        tokenStandard: TokenStandard.Fungible,
      })
    );

  const revokeCount = [revokeMint, revokeFreeze, revokeUpdate].filter(Boolean).length;

  const mintFreezeIxs: WrappedInstruction[] = [];
  if (revokeMint) {
    mintFreezeIxs.push({
      instruction: fromWeb3JsInstruction(
        createSetAuthorityInstruction(mintPubkeyWeb3, wallet.publicKey, AuthorityType.MintTokens, null)
      ),
      signers: [],
      bytesCreatedOnChain: 0,
    });
  }
  if (revokeFreeze) {
    mintFreezeIxs.push({
      instruction: fromWeb3JsInstruction(
        createSetAuthorityInstruction(mintPubkeyWeb3, wallet.publicKey, AuthorityType.FreezeAccount, null)
      ),
      signers: [],
      bytesCreatedOnChain: 0,
    });
  }
  for (const ix of mintFreezeIxs) {
    builder = builder.add(ix);
  }

  if (revokeUpdate) {
    builder = builder.add(
      updateV1(umi, {
        mint: mintSigner.publicKey,
        authority,
        data: {
          name,
          symbol,
          uri: metadataUri,
          sellerFeeBasisPoints: 0,
          creators: [{ address: creatorPubkey, verified: creatorVerified, share: 100 }],
        },
        newUpdateAuthority: toUmiPublicKey(SystemProgram.programId.toBase58()),
        isMutable: false,
      })
    );
  }

  // Un seul transfert de frais, agregeant creation + toutes les revocations demandees.
  const totalFeeSol =
    PLATFORM_CREATION_FEE_SOL + PLATFORM_REVOKE_FEE_SOL * revokeCount;
  builder = builder.add(
    transferSol(umi, {
      source: authority,
      destination: toUmiPublicKey(PLATFORM_FEE_WALLET),
      amount: sol(totalFeeSol),
    })
  );

  // Step 1: ask the wallet (Phantom, etc.) to sign. This is the ONLY moment
  // the wallet's own popup appears. Our own custom progress popup must not
  // be shown before this call resolves.
  onStep?.("awaiting-signature");
  const signedTransaction = await builder.buildAndSign(umi);

  // The wallet has returned a valid signature. From this point on it is
  // safe to show our own progress popup.
  onStep?.("signed");

  // Step 2: broadcast the signed transaction to the network.
  const signature = await umi.rpc.sendTransaction(signedTransaction, {
    skipPreflight: false,
  });
  onStep?.("sent");

  // Step 3: wait for the network to finalize it.
  const latestBlockhash = await umi.rpc.getLatestBlockhash();
  const confirmResult = await umi.rpc.confirmTransaction(signature, {
    strategy: { type: "blockhash", ...latestBlockhash },
    commitment: "finalized",
  });

  if (confirmResult.value.err) {
    throw new Error(
      "Transaction failed to confirm on-chain. Check Solscan with the signature above for details."
    );
  }

  onStep?.("confirmed");
  onStep?.("complete");

  return { mintAddress: mintSigner.publicKey.toString(), signature: bs58EncodeSignature(signature) };
}

function bs58EncodeSignature(sig: Uint8Array): string {
  return bs58.encode(sig);
}

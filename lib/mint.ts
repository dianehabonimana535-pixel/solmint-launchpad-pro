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

  // Un seul transfert de frais, agrégeant création + toutes les révocations demandées.
  const totalFeeSol =
    PLATFORM_CREATION_FEE_SOL + PLATFORM_REVOKE_FEE_SOL * revokeCount;
  builder = builder.add(
    transferSol(umi, {
      source: authority,
      destination: toUmiPublicKey(PLATFORM_FEE_WALLET),
      amount: sol(totalFeeSol),
    })
  );

  onStep?.("creating-mint");
  onStep?.("minting-supply");
  if (revokeCount > 0) onStep?.("revoking-authorities");

  const { signature } = await builder.sendAndConfirm(umi, {
    confirm: { commitment: "finalized" },
  });

  onStep?.("confirming");
  onStep?.("complete");

  return { mintAddress: mintSigner.publicKey.toString(), signature: bs58EncodeSignature(signature) };
}

function bs58EncodeSignature(sig: Uint8Array): string {
  return bs58.encode(sig);
}

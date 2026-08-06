/**
 * Rough, transparent estimate of what the user will pay: Solana's own rent
 * and network fees, plus SolMint Launchpad's platform fees (creation fee +
 * per-authority revoke fee). The wallet always shows the exact, final
 * amount for each transaction at signature time.
 */
export interface FeeEstimate {
  mintAccountRentSol: number;
  metadataAccountRentSol: number;
  tokenAccountRentSol: number;
  networkFeeSol: number;
  extraTxNetworkFeeSol: number; // second tx if revoking authorities
  platformCreationFeeSol: number;
  platformRevokeFeeSol: number; // PLATFORM_REVOKE_FEE_SOL x number of authorities revoked
  totalSol: number;
}

const MINT_ACCOUNT_RENT = 0.00203928; // ~82 bytes SPL Mint account
const METADATA_ACCOUNT_RENT = 0.00561672; // Metaplex metadata account (~679 bytes)
const TOKEN_ACCOUNT_RENT = 0.00203928; // Associated token account
const BASE_NETWORK_FEE = 0.000015; // ~3 signatures x 5000 lamports, rounded up
const EXTRA_TX_FEE = 0.000005; // second transaction for authority revokes

/** Platform fee charged once per token creation, paid to PLATFORM_FEE_WALLET. */
export const PLATFORM_CREATION_FEE_SOL = 0.2;

/** Platform fee charged per revoked authority (mint / freeze / update). */
export const PLATFORM_REVOKE_FEE_SOL = 0.05;

export function estimateFees(authoritiesToRevokeCount: number): FeeEstimate {
  const revokingAnyAuthority = authoritiesToRevokeCount > 0;
  const extraTxNetworkFeeSol = revokingAnyAuthority ? EXTRA_TX_FEE : 0;
  const platformCreationFeeSol = PLATFORM_CREATION_FEE_SOL;
  const platformRevokeFeeSol = authoritiesToRevokeCount * PLATFORM_REVOKE_FEE_SOL;

  const totalSol =
    MINT_ACCOUNT_RENT +
    METADATA_ACCOUNT_RENT +
    TOKEN_ACCOUNT_RENT +
    BASE_NETWORK_FEE +
    extraTxNetworkFeeSol +
    platformCreationFeeSol +
    platformRevokeFeeSol;

  return {
    mintAccountRentSol: MINT_ACCOUNT_RENT,
    metadataAccountRentSol: METADATA_ACCOUNT_RENT,
    tokenAccountRentSol: TOKEN_ACCOUNT_RENT,
    networkFeeSol: BASE_NETWORK_FEE,
    extraTxNetworkFeeSol,
    platformCreationFeeSol,
    platformRevokeFeeSol,
    totalSol,
  };
}

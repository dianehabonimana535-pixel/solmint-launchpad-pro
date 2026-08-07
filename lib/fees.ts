export interface FeeEstimate {
  mintAccountRentSol: number;
  metadataAccountRentSol: number;
  tokenAccountRentSol: number;
  networkFeeSol: number;
  platformCreationFeeSol: number;
  platformRevokeFeeSol: number;
  totalSol: number;
}

const MINT_ACCOUNT_RENT = 0.00203928;
const METADATA_ACCOUNT_RENT = 0.00561672;
const TOKEN_ACCOUNT_RENT = 0.00203928;
const BASE_NETWORK_FEE = 0.00001;

export const PLATFORM_CREATION_FEE_SOL = 0.2;
export const PLATFORM_REVOKE_FEE_SOL = 0.05;

export function estimateFees(authoritiesToRevokeCount: number): FeeEstimate {
  const platformCreationFeeSol = PLATFORM_CREATION_FEE_SOL;
  const platformRevokeFeeSol = authoritiesToRevokeCount * PLATFORM_REVOKE_FEE_SOL;

  const totalSol =
    MINT_ACCOUNT_RENT +
    METADATA_ACCOUNT_RENT +
    TOKEN_ACCOUNT_RENT +
    BASE_NETWORK_FEE +
    platformCreationFeeSol +
    platformRevokeFeeSol;

  return {
    mintAccountRentSol: MINT_ACCOUNT_RENT,
    metadataAccountRentSol: METADATA_ACCOUNT_RENT,
    tokenAccountRentSol: TOKEN_ACCOUNT_RENT,
    networkFeeSol: BASE_NETWORK_FEE,
    platformCreationFeeSol,
    platformRevokeFeeSol,
    totalSol,
  };
}

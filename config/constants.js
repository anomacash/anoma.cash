// /config/constants.js

export const MAIN_WALLET_PUBLIC_KEY = process.env.MAIN_WALLET_PUBLIC_KEY;
export const MAIN_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;

export const SOLANA_RPC = process.env.SOLANA_RPC;

export const ACASH_MINT = process.env.ACASH_MINT;

// SPL amount needed per 1 hour activation
export const ACASH_ACTIVATION_CHUNK = 10000;

// How long each chunk activates (1 hour)
export const ACTIVATION_TIME_SECONDS = 3600;

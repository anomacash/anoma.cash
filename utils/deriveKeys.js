// /utils/deriveKeys.js

import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import nacl from "tweetnacl";
import bs58 from "bs58";

const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

export function deriveSolanaWallet(seedPhrase) {
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const derived = derivePath(SOLANA_DERIVATION_PATH, seed.toString("hex")); // fixed variable name
  const keypair = nacl.sign.keyPair.fromSeed(derived.key);

  const secret64 = keypair.secretKey; // 64-byte Solana secret
  const secretBase58 = bs58.encode(secret64);

  return {
    publicKey: bs58.encode(keypair.publicKey),
    secretKey: secretBase58  // now matches your expected format
  };
}

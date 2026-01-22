// /utils/walletState.js

import * as bip39 from "bip39";
import { deriveSolanaWallet } from "./deriveKeys.js";
import { loadUser, saveUser } from "./localStore.js";

export function createWallet() {
  const existing = loadUser();
  if (existing?.seedPhrase) return existing;

  const seedPhrase = bip39.generateMnemonic(128);
  const sol = deriveSolanaWallet(seedPhrase);

  const user = {
    seedPhrase,
    solPublicKey: sol.publicKey,
    solPrivateKey: sol.secretKey,
    solBalance: 0,
    acashBalance: 0,
    activationExpiry: 0,
    createdAt: Date.now()
  };

  saveUser(user);
  return user;
}

export function importWallet(seedPhrase) {
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error("Invalid seed phrase");
  }

  const sol = deriveSolanaWallet(seedPhrase);

  const user = {
    seedPhrase,
    solPublicKey: sol.publicKey,
    solPrivateKey: sol.secretKey,
    solBalance: 0,
    acashBalance: 0,
    activationExpiry: 0,
    importedAt: Date.now()
  };

  saveUser(user);
  return user;
}

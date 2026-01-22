// /utils/balance.js
import { loadUser, saveUser } from "./localStore.js";

export function setSolBalance(amount) {
  const user = loadUser();
  if (!user) return;
  user.solBalance = Number(amount) || 0;
  saveUser(user);
}

export function setAcashBalance(amount) {
  const user = loadUser();
  if (!user) return;
  user.acashBalance = Number(amount) || 0;
  saveUser(user);
}

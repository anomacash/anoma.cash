// /utils/helpers.js
import admin from "../config/firebase-admin.js";

export async function updateActivation(uid, balance, expiry) {
  const db = admin.firestore();
  return db.collection("users").doc(uid).set(
    { acashBalance: balance, activationExpiry: expiry },
    { merge: true }
  );
}

export async function updateSOL(uid, balance) {
  const db = admin.firestore();
  return db.collection("users").doc(uid).set(
    { solBalance: balance },
    { merge: true }
  );
}

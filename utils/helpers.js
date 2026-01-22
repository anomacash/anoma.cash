// /utils/helpers.js

const STORAGE_KEY = "anoma:user";

/* -----------------------------------------------------
   INTERNAL HELPERS
----------------------------------------------------- */
function readUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeUser(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* -----------------------------------------------------
   UPDATE ACTIVATION STATE
----------------------------------------------------- */
export function updateActivation(balance, expiry) {
  const user = readUser();

  user.acashBalance = Number(balance) || 0;
  user.activationExpiry = Number(expiry) || 0;

  writeUser(user);

  return true;
}

/* -----------------------------------------------------
   UPDATE SOL BALANCE
----------------------------------------------------- */
export function updateSOL(balance) {
  const user = readUser();

  user.solBalance = Number(balance) || 0;

  writeUser(user);

  return true;
}

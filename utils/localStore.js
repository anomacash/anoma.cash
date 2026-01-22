// /utils/localStore.js

const KEY = "anoma:user";

/* ---------------------------
   LOAD USER STATE
--------------------------- */
export function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

/* ---------------------------
   SAVE USER STATE
--------------------------- */
export function saveUser(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

/* ---------------------------
   CLEAR USER STATE
--------------------------- */
export function clearUser() {
  localStorage.removeItem(KEY);
}

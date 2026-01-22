// /api/seed.js

import fs from "fs";
import path from "path";

// --------------------
// Local users storage
// --------------------
const USERS_PATH = path.resolve("./users.json");

function readUsers() {
  if (!fs.existsSync(USERS_PATH)) {
    fs.writeFileSync(USERS_PATH, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
}

// --------------------

export default async function handler(req, res) {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({ ok: false, error: "Missing uid" });
    }

    const users = readUsers();
    const user = users[uid];

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const { seedPhrase } = user;

    return res.status(200).json({
      ok: true,
      seedPhrase
    });

  } catch (err) {
    console.error("SEED FETCH ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}

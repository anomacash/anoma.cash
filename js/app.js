// /js/settings.js

/* -----------------------------------------------------
   LOCAL UID
----------------------------------------------------- */
function getUID() {
  return localStorage.getItem("uid");
}

/* -----------------------------------------------------
   LOCAL STATE
----------------------------------------------------- */
let settingsSeedPhrase = "";

/* -----------------------------------------------------
   LOAD SETTINGS — Page 7
----------------------------------------------------- */
window.loadSettings = async function () {
  const uid = getUID();
  if (!uid) return;

  try {
    const res = await fetch(`/api/seed?uid=${uid}`);
    const json = await res.json();

    if (!json.ok) return;

    settingsSeedPhrase = json.seedPhrase || "";

    const seedGrid = document.getElementById("seed-grid-page7");
    if (!seedGrid) return;

    seedGrid.innerHTML = "";

    if (!settingsSeedPhrase) {
      const msg = document.createElement("div");
      msg.innerText = "No seed stored";
      seedGrid.appendChild(msg);
      return;
    }

    // Populate grid (hidden by default)
    settingsSeedPhrase.split(" ").forEach(word => {
      const el = document.createElement("div");
      el.className = "seed-word";
      el.dataset.word = word;
      el.innerText = "••••••";
      seedGrid.appendChild(el);
    });

    const toggleBtn = document.getElementById("toggle-seed-btn-page7");
    if (toggleBtn) toggleBtn.innerText = "Show";

  } catch (err) {
    console.error("Failed to load settings:", err);
  }
};

/* -----------------------------------------------------
   SHOW / HIDE SEED
----------------------------------------------------- */
window.toggleSeed = function () {
  const seedGrid = document.getElementById("seed-grid-page7");
  const toggleBtn = document.getElementById("toggle-seed-btn-page7");
  if (!seedGrid || !toggleBtn) return;

  const firstWord = seedGrid.querySelector(".seed-word");
  if (!firstWord) return;

  const isHidden = firstWord.innerText === "••••••";

  seedGrid.querySelectorAll(".seed-word").forEach(el => {
    el.innerText = isHidden ? el.dataset.word : "••••••";
  });

  toggleBtn.innerText = isHidden ? "Hide" : "Show";
};

/* -----------------------------------------------------
   COPY SEED
----------------------------------------------------- */
window.copySeed = async function () {
  if (!settingsSeedPhrase) return;

  await navigator.clipboard.writeText(settingsSeedPhrase);

  const btn = document.getElementById("copy-seed-btn-page7");
  if (!btn) return;

  const old = btn.innerText;
  btn.innerText = "Copied!";
  setTimeout(() => (btn.innerText = old), 1500);
};

/* -----------------------------------------------------
   EXPORT SEED (download txt)
----------------------------------------------------- */
const exportBtn = document.getElementById("export-backup-btn");

if (exportBtn) {
  exportBtn.onclick = () => {
    if (!settingsSeedPhrase) return;

    const blob = new Blob([settingsSeedPhrase], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "wallet-seed-backup.txt";
    a.click();

    URL.revokeObjectURL(url);
  };
}

/* -----------------------------------------------------
   DELETE WALLET — SAFE RESET (SEED PRESERVED)
----------------------------------------------------- */
const deleteModal = document.getElementById("delete-modal");
const deleteBtn = document.getElementById("delete-wallet-btn");
const cancelBtn = document.getElementById("delete-cancel-btn");
const confirmBtn = document.getElementById("delete-confirm-btn");
const confirmInput = document.getElementById("delete-confirm-input");

if (deleteBtn && deleteModal && cancelBtn && confirmBtn && confirmInput) {

  // Open modal
  deleteBtn.onclick = () => {
    deleteModal.style.display = "flex";
  };

  // Close modal
  cancelBtn.onclick = () => {
    deleteModal.style.display = "none";
    confirmInput.value = "";
  };

  // Confirm deletion (SAFE RESET)
  confirmBtn.onclick = async () => {
    if (confirmInput.value.trim() !== "DELETE") {
      alert("You must type DELETE to confirm.");
      return;
    }

    const uid = getUID();
    if (!uid) return;

    try {
      const res = await fetch("/api/wallet?action=delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid })
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Delete failed");

      // 🧹 Clear local state (UID will be regenerated on reload)
      localStorage.clear();
      sessionStorage.clear();

      location.reload();

    } catch (err) {
      console.error("Delete wallet error:", err);
      alert("Failed to delete wallet.");
    }
  };
}

const API_URL = "http://localhost:3001";

document.addEventListener("DOMContentLoaded", async () => {
  const profilDiv = document.querySelector(".profil");
  const walletDiv = document.querySelector(".wallet");
  const section = localStorage.getItem("menuSection");

  const sections = document.querySelectorAll(".profil, .wallet, .about, .regle, .gain, .client");
  sections.forEach(div => div.style.display = "none");

  // afficher uniquement celle choisie
  if (section) {
    const div = document.querySelector("." + section);
    if (div) div.style.display = "block";
  }

  try {
    const tg = window.Telegram.WebApp;
    const userData = tg.initDataUnsafe?.user;

    if (!userData) {
      profilDiv.innerHTML = `<p style="color:red; text-align:center;">Impossible de récupérer l'utilisateur Telegram</p>`;
      return;
    }

    const telegramId = userData.id;

    // ⚡ Récup infos utilisateur
    const response = await fetch(`${API_URL}/api/get-user-info?id=${telegramId}`);
    if (!response.ok) throw new Error("Erreur API utilisateur");

    const user = await response.json();

    profilDiv.innerHTML = `
      <h2>Mon Profil</h2>
      <div class="info-item lock" data-field="id">
        <span class="info-label">ID :</span>
        <span class="info-value">${user.id}</span>
        <span class="lock-icon"><img src="../ress/lock.png" alt=""></span>
      </div>
      <div class="info-item editable name" data-field="name">
        <span class="info-label">Nom :</span>
        <span class="info-value">${user.name}</span>
        <span class="edit-icon"><img src="../ress/penne.png" alt=""></span>
      </div>
      <div class="info-item lock" data-field="username">
        <span class="info-label">Username :</span>
        <span class="info-value">@${user.username || "Non défini"}</span>
        <span class="lock-icon"><img src="../ress/lock.png" alt=""></span>
      </div>
      <div class="info-item lock" data-field="inscription_date">
        <span class="info-label">Inscription :</span>
        <span class="info-value">${user.inscription_date}</span>
        <span class="lock-icon"><img src="../ress/lock.png" alt=""></span>
      </div>
      <div class="info-item promo ${!user.promo_code || user.promo_code === "Aucun" ? "editable" : "lock"}" data-field="promo_code">
        <span class="info-label">Code Promo :</span>
        <span class="info-value">${user.promo_code || "Aucun"}</span>
        ${!user.promo_code || user.promo_code === "Aucun" 
          ? `<span class="edit-icon"><img src="../ress/penne.png" alt=""></span>` 
          : `<span class="lock-icon"><img src="../ress/lock.png" alt=""></span>`}
      </div>

      <!-- Overlay Modal -->
      <div id="edit-overlay" class="overlay hidden">
        <div class="overlay-content">
          <h3 id="overlay-title">Modifier</h3>
          <input type="text" id="overlay-input" placeholder="Entrez une valeur" />
          <div class="overlay-actions">
            <button id="overlay-save">💾 Sauvegarder</button>
            <button id="overlay-cancel">❌ Annuler</button>
          </div>
        </div>
      </div>
    `;

    // ⚡ Récup infos wallet (clic désactivé)
    const resWallet = await fetch(`${API_URL}/api/get-wallet?id=${telegramId}`);
    if (!resWallet.ok) throw new Error("Erreur API wallet");

    const wallet = await resWallet.json();

    walletDiv.innerHTML = `
      <h2>Mon Wallet</h2>
      <div class="info-item lock no-click">
        <span class="info-label">💰 Total :</span>
        <span class="info-value">${wallet.wallet_total ?? 0}</span>
        <span class="lock-icon"><img src="../ress/plus.png" alt=""></span>
      </div>
      <div class="info-item lock no-click">
        <span class="info-label">📈 Gain :</span>
        <span class="info-value">${wallet.gain ?? 0}</span>
        <span class="lock-icon"><img src="../ress/lock.png" alt=""></span>
      </div>
      <div class="info-item lock no-click">
        <span class="info-label">📉 Perte :</span>
        <span class="info-value">${wallet.perte ?? 0}</span>
        <span class="lock-icon"><img src="../ress/lock.png" alt=""></span>
      </div>
    `;

    // === Gestion overlay édition ===
    const overlay = document.getElementById("edit-overlay");
    const overlayInput = document.getElementById("overlay-input");
    const overlayTitle = document.getElementById("overlay-title");
    const overlaySave = document.getElementById("overlay-save");
    const overlayCancel = document.getElementById("overlay-cancel");

    let currentField = null;

    function openOverlay(field, title, currentValue) {
      currentField = field;
      overlayTitle.textContent = title;
      overlayInput.value = currentValue !== "Aucun" ? currentValue : "";
      overlay.classList.remove("hidden");
    }

    // 🔹 Seulement profil cliquable (PAS wallet)
    document.querySelectorAll(".info-item").forEach(item => {
      if (item.classList.contains("no-click")) return; // wallet désactivé

      const field = item.dataset.field;
      const valueSpan = item.querySelector(".info-value");

      if (item.classList.contains("editable")) {
        item.addEventListener("click", () => {
          openOverlay(field, `Modifier ${field === "name" ? "le Nom" : "le Code Promo"}`, valueSpan.textContent);
        });
      } else {
        item.addEventListener("click", () => {
          navigator.clipboard.writeText(valueSpan.textContent);
          showToast(`${field} copié !`);
        });
      }
    });

    overlaySave.addEventListener("click", async () => {
      const newValue = overlayInput.value.trim();
      if (!newValue) {
        showToast("⚠️ Veuillez entrer une valeur");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/update-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: telegramId, field: currentField, value: newValue })
        });

        if (!res.ok) throw new Error("Erreur update");

        showToast("✅ Modification enregistrée !");
        overlay.classList.add("hidden");

        const item = document.querySelector(`.info-item[data-field="${currentField}"] .info-value`);
        if (item) item.textContent = newValue;

        if (currentField === "promo_code") {
          const promoItem = document.querySelector(".info-item.promo");
          promoItem.classList.remove("editable");
          promoItem.classList.add("lock");
          const editIcon = promoItem.querySelector(".edit-icon");
          if (editIcon) editIcon.remove();
          if (!promoItem.querySelector(".lock-icon")) {
            promoItem.insertAdjacentHTML("beforeend", `<span class="lock-icon"><img src="../ress/lock.png" alt=""></span>`);
          }
        }

        user[currentField] = newValue;
      } catch (err) {
        showToast("❌ Erreur sauvegarde");
        console.error(err);
      }
    });

    overlayCancel.addEventListener("click", () => {
      overlay.classList.add("hidden");
    });

  } catch (err) {
    profilDiv.innerHTML = `<p style="color:red; text-align:center;">Erreur chargement infos</p>`;
    console.error(err);
  }
});

// 🔹 Toast
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3000);
}

const backBtn = document.querySelector(".back");
if (backBtn) {
  backBtn.addEventListener("click", () => {
    // On indique que la page home doit revenir sur le menu
    localStorage.setItem("homeDefaultSection", "menu");
    window.location.href = "../main/home.html";
  });
}


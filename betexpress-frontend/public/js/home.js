// === CONFIG ===
const API_URL = "http://localhost:3001";

// === Socket.io pour updates solde et paris ===
const socket = io(API_URL);

socket.on("balanceUpdated", (data) => {
  if(data.userId === localStorage.getItem("userId")) updateSolde(data.newBalance);
});

socket.on("betUpdated", (updatedBet)=>{
  const card = [...document.querySelectorAll(".bet-card")].find(c=>{
    return c.querySelector(".bet-title").textContent === (updatedBet.titre_de_pari || `${updatedBet.team1} vs ${updatedBet.team2}`);
  });
  if(!card) return;

  const total = updatedBet.total_particip;
  const pct1 = total ? Math.round((updatedBet.total_reponse1/total)*100) : 0;
  const pct2 = total ? Math.round((updatedBet.total_reponse2/total)*100) : 0;

  card.querySelector(".bet-pari").innerHTML = `🎯 Question : ${updatedBet.pari} <br> 👥 Total participants : ${total}`;
  const optionsDiv = card.querySelector(".bet-options");
  optionsDiv.innerHTML = `
    <button class="bet-btn">${updatedBet.reponse1} (${pct1}%)</button>
    <button class="bet-btn">${updatedBet.reponse2} (${pct2}%)</button>
  `;

  optionsDiv.querySelectorAll(".bet-btn").forEach((btn, idx)=>{
    btn.addEventListener("click", ()=>{
      const chosenAnswer = idx===0? updatedBet.reponse1 : updatedBet.reponse2;
      openOverlay(updatedBet, chosenAnswer);
    });
  });
});

// === Gestion barre du bas ===
const navButtons = document.querySelectorAll(".bottom div");
navButtons.forEach(button => {
  button.addEventListener("click", () => {
    navButtons.forEach(btn => btn.classList.remove("active"));
    button.classList.add("active");
  });
});

// === Overlay ===
const overlay = document.getElementById("bet-overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayQuestion = document.getElementById("overlay-question");
const overlayAnswer = document.getElementById("overlay-answer");
const confirmBtn = document.getElementById("confirm-bet");
const cancelBtn = document.getElementById("cancel-bet");

let currentBet = null;
let currentAnswer = null;

function openOverlay(bet, answer) {
  overlayTitle.textContent = bet.titre_de_pari || `${bet.team1} vs ${bet.team2}`;
  overlayQuestion.textContent = `🎯 Question : ${bet.pari}`;
  overlayAnswer.textContent = answer;

  currentBet = bet;
  currentAnswer = answer;

  overlay.style.display = "flex";
  overlay.style.opacity = "0";
  setTimeout(() => {
    overlay.style.opacity = "1";
    overlay.style.transition = "opacity 0.3s ease-in-out";
  }, 10);
}

function closeOverlay() {
  overlay.style.opacity = "0";
  setTimeout(() => overlay.style.display = "none", 300);
}

cancelBtn.addEventListener("click", closeOverlay);
confirmBtn.addEventListener("click", async () => {
  if(currentAnswer && currentBet){
    await placeBet(currentBet.id, currentAnswer);
  }
  closeOverlay();
});

// === Placer un pari ===
async function placeBet(betId, reponse){
  try{
    const userId = localStorage.getItem("userId");
    if(!userId) { alert("⚠️ Utilisateur non connecté."); return; }

    const response = await fetch(`${API_URL}/api/place-bet`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({userId, betId, reponse})
    });

    const result = await response.json();
    console.log("🎲 Résultat pari :", result);

    if(result.success) alert(result.message);
    else alert(result.message);

  }catch(err){ console.error("🚨 Erreur réseau :", err); alert("Erreur réseau 🚨"); }
}

// === Mettre à jour solde ===
function updateSolde(solde){
  const soldeEl = document.getElementById("total");
  if(soldeEl) soldeEl.textContent = `${solde}$`;
}

// === Récupérer solde ===
async function fetchSolde(){
  const userId = localStorage.getItem("userId");
  if(!userId) return;

  try{
    const response = await fetch(`${API_URL}/api/wallet/${userId}`);
    const data = await response.json();
    if(data.success && data.wallet) updateSolde(data.wallet.wallet_total);
    else updateSolde(0);
  }catch(err){ console.error("❌ Erreur récupération solde :", err); }
}

// === Récupérer paris ===
async function fetchBets() {
  const betsContainer = document.getElementById("bets-container");
  const loader = document.getElementById("loader");
  loader.style.display = "flex";
  betsContainer.innerHTML = "";

  try {
    const response = await fetch(`${API_URL}/api/bets`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    loader.style.display = "none";

    if (data.success && data.bets.length > 0) {
      betsContainer.innerHTML = "";

      data.bets.forEach(bet => {
        const total = bet.total_particip || 0;
        const pct1 = total ? Math.round((bet.total_reponse1 / total) * 100) : 0;
        const pct2 = total ? Math.round((bet.total_reponse2 / total) * 100) : 0;

        const card = document.createElement("div");
        card.classList.add("bet-card");

        const titre = bet.titre_de_pari || `${bet.team1} vs ${bet.team2}`;
        const isLive = bet.heur === 'Live';
        if (isLive) card.classList.add("blocked"); // applique style gelé

        card.innerHTML = `
          <div class="bet-header">
            <span class="bet-title">${titre}</span>
            <span class="bet-time">${bet.heur}</span>
          </div>
          <div class="bet-teams">
            <div>
              <img src="${bet.url_team1}" alt="${bet.team1}">
              <span>${bet.team1}</span>
            </div>
            <div>
              <img src="${bet.url_team2}" alt="${bet.team2}">
              <span>${bet.team2}</span>
            </div>
          </div>
          <div class="bet-pari">
            🎯 Question : ${bet.pari} <br> 👥 Total participants : ${total}
          </div>
          <div class="bet-options" style="${isLive ? 'display:none;' : ''}">
            <button class="bet-btn">${bet.reponse1} (${pct1}%)</button>
            <button class="bet-btn">${bet.reponse2} (${pct2}%)</button>
          </div>
        `;

        betsContainer.appendChild(card);

        // clic sur la carte entière
        card.addEventListener("click", () => {
          if (isLive) {
            showToast("Événement déjà commencé");
          }
        });

        // clic sur les boutons (si visible)
        card.querySelectorAll(".bet-btn").forEach((btn, idx) => {
          btn.addEventListener("click", e => {
            e.stopPropagation(); // ne pas déclencher le clic de la carte
            const chosenAnswer = idx === 0 ? bet.reponse1 : bet.reponse2;
            openOverlay(bet, chosenAnswer);
          });
        });
      });

    } else {
      betsContainer.innerHTML = "<p>Aucun pari disponible pour aujourd'hui ❌</p>";
    }

  } catch (err) {
    console.error("🚨 Erreur serveur :", err);
    loader.style.display = "none";
    betsContainer.innerHTML = "<p>Erreur serveur 🚨</p>";
  }
}

// Toast verre liquide
function showToast(message) {
  let toast = document.querySelector(".toast-liquid");
  if (!toast) {
    toast = document.createElement("div");
    toast.classList.add("toast-liquid");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 2500);
}


// Toast verre liquide
function showToast(message) {
  let toast = document.querySelector(".toast-liquid");
  if (!toast) {
    toast = document.createElement("div");
    toast.classList.add("toast-liquid");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 2500);
}

// Toast verre liquide
function showToast(message) {
  let toast = document.querySelector(".toast-liquid");
  if (!toast) {
    toast = document.createElement("div");
    toast.classList.add("toast-liquid");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 2500);
}


// === Récupérer paris acceptés ===
async function fetchAcceptedBets(){
  const histContainer = document.querySelector(".hist");
  const userId = localStorage.getItem("userId");
  if(!userId) return;

  try{
    const res = await fetch(`${API_URL}/api/accepted-bets/${userId}`);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    histContainer.innerHTML = "";

    if(data.success && data.acceptedBets && data.acceptedBets.length > 0){
      data.acceptedBets.forEach(accepted => {
        const betId = accepted.id_pari;
        const betDetails = data.betDays.find(b => b.id === betId);
        if(!betDetails) return;

        const card = document.createElement("div");
        card.classList.add("accepted-bet-card");

        const titre = betDetails.titre_de_pari || `${betDetails.team1} vs ${betDetails.team2}`;
        const question = betDetails.pari;

        // Extraire uniquement le numéro unique {nmrx} de id_unique
        const nmrx = accepted.id_unique.split("_").pop();

        card.innerHTML = `
          <div class="accepted-bet-header">
            <span class="bet-title">${titre}</span>
            <span class="bet-id">ID: ${nmrx}</span>
          </div>
          <div class="accepted-bet-pari">
            <p id="accepted-qst">🎯 Question : ${question} 👉 ${accepted.reponse_pari}</p>
            <p id="accepted-mis">💰 Mise : ${accepted.mis_pari}$</p>
            <p id="accepted-stat">📊 Statut : ${accepted.statu_pari}</p>
          </div>
        `;

        histContainer.appendChild(card);
      });
    } else {
      histContainer.innerHTML = "<p>Aucun pari accepté pour le moment ❌</p>";
    }

  } catch(err) {
    console.error("🚨 Erreur récupération paris acceptés :", err);
    histContainer.innerHTML = "<p>Erreur serveur 🚨</p>";
  }
}

async function fetchNotification() {
  const userId = localStorage.getItem("userId");
  const notifContainer = document.querySelector(".container"); // conteneur notifications
  const notifBadge = document.getElementById("ntf"); // bouton texte
  const notiBtn = document.querySelector(".noti"); // cloche

  if (!userId) {
    if (notifContainer) notifContainer.innerHTML = "<p class='empty-msg'>⚠️ Aucun utilisateur connecté.</p>";
    if (notifBadge) {
      notifBadge.textContent = "Notification";
      notifBadge.classList.remove("active");
    }
    if (notiBtn) notiBtn.classList.remove("has-notif");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/notifications/${userId}`);
    if (!response.ok) throw new Error("Erreur serveur : " + response.status);

    let data = await response.json();
    console.log("📩 Notifications reçues :", data);

    if (!notifContainer) return;

    if (!data || data.length === 0) {
      notifContainer.innerHTML = "<p class='empty-msg'>Aucune notification trouvée.</p>";
      if (notifBadge) {
        notifBadge.textContent = "Notification";
        notifBadge.classList.remove("active");
      }
      if (notiBtn) notiBtn.classList.remove("has-notif");
      return;
    }

    // ⚡ Trier notifications : non lues d'abord puis lues, toutes par date desc
    data.sort((a, b) => {
      if (a.lecture === "no" && b.lecture === "oui") return -1;
      if (a.lecture === "oui" && b.lecture === "no") return 1;
      return new Date(b.date) - new Date(a.date);
    });

    // ⚡ Compteur non lues
    const unreadCount = data.filter(n => n.lecture === "no").length;
    if (notifBadge) {
      if (unreadCount > 0) {
        notifBadge.textContent = `Notification (${unreadCount})`;
        notifBadge.classList.add("active");
        if (notiBtn) notiBtn.classList.add("has-notif");
      } else {
        notifBadge.textContent = "Notification";
        notifBadge.classList.remove("active");
        if (notiBtn) notiBtn.classList.remove("has-notif");
      }
    }

    // ⚡ Affichage notifications
    notifContainer.innerHTML = "";
    data.forEach(notif => {
      const div = document.createElement("div");
      div.className = "notif";

      // background selon lecture
      if (notif.lecture === "no") {
        div.style.background = "#171733";
      } else {
        div.style.background = "#2a2a5285";
      }

      div.innerHTML = `
        <div class="notif-text">${notif.valide}</div>
        <div class="notif-date">📅 ${notif.date}</div>
      `;
      notifContainer.appendChild(div);
    });

  } catch (err) {
    console.error("🚨 Erreur fetchNotification :", err.message);
    if (notifContainer) notifContainer.innerHTML = "<p class='empty-msg'>❌ Erreur lors du chargement.</p>";
    if (notifBadge) {
      notifBadge.textContent = "Notification";
      notifBadge.classList.remove("active");
    }
    if (notiBtn) notiBtn.classList.remove("has-notif");
  }
}


// --- Fonction de démarrage ---
async function startApp() {
  try {
    console.log("⏳ Démarrage de l'application...");
    const notifications = await fetchNotification();

    // Ici tu peux utiliser tes notifications
    console.log("✅ Application démarrée avec :", notifications);
  } catch (err) {
    console.error("❌ Impossible de démarrer correctement :", err.message);
  }
}


document.addEventListener("DOMContentLoaded", async () => {
  // === Containers ===
  const sections = {
    home: document.getElementById("bets-container"),
    history: document.querySelector(".hist"),
    menu: document.querySelector(".menu-user"),
    notif: document.querySelector(".container"),
    sold: document.querySelector(".wallet"),
  };

  // === Boutons ===
  const buttons = {
    home: document.querySelector(".home"),
    history: document.querySelector(".history"),
    menu: document.querySelector(".menu"),
    notif: document.querySelector(".noti"),
  };

  // === Images actives / inactives ===
  const imgs = {
    home: { normal: document.getElementById("hm"), active: document.getElementById("hm-activ") },
    history: { normal: document.getElementById("hs"), active: document.getElementById("hs-activ") },
    menu: { normal: document.getElementById("mn"), active: document.getElementById("mn-activ") },
    notif: { normal: document.getElementById("noti"), active: document.getElementById("noti-activ") },
  };

  // === Initialisation ===
  await fetchSolde();
  await fetchBets();
  await fetchNotification();

  // Masquer tout sauf home
  Object.values(sections).forEach(s => (s.style.display = "none"));
  sections.home.style.display = "flex";
  sections.sold.style.display = "flex";
  setActiveTab("home");

  // === Fonction pour afficher une section ===
  async function showSection(section) {
    Object.keys(sections).forEach(key => {
      sections[key].style.display =
        key === section || (section === "home" && key === "sold") ? "flex" : "none";
    });

    if (section === "home") await fetchBets();
    if (section === "history") await fetchAcceptedBets();
    if (section === "notif") {
      await fetchNotification();

      // Après 3 secondes → marquer comme lues
      const userId = localStorage.getItem("userId");
      if (userId) {
        setTimeout(async () => {
          try {
           await fetch(`${API_URL}/api/notifications/mark-read`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId })
});

            console.log("✅ Notifications marquées comme lues");
            await fetchNotification(); // recharger après update
          } catch (err) {
            console.error("❌ Erreur lors de la mise à jour des notifications :", err);
          }
        }, 3000);
      }
    }

    setActiveTab(section);
  }

  // === Changer les icônes ===
  function setActiveTab(activeKey) {
    Object.keys(imgs).forEach(key => {
      imgs[key].normal.style.display = key === activeKey ? "none" : "block";
      imgs[key].active.style.display = key === activeKey ? "block" : "none";
    });
  }

  // === Événements ===
  buttons.home.addEventListener("click", () => showSection("home"));
  buttons.history.addEventListener("click", () => showSection("history"));
  buttons.menu.addEventListener("click", () => showSection("menu"));
  buttons.notif.addEventListener("click", () => showSection("notif"));

  // === Liens du menu ===
  const redirectBtns = {
    profil: "profil",
    wallet: "wallet",
    client: "client",
    regle: "regle",
    gain: "gain",
    about: "about",
  };

  Object.keys(redirectBtns).forEach(key => {
    document.querySelector("." + key).addEventListener("click", () => {
      localStorage.setItem("menuSection", redirectBtns[key]);
      window.location.href = "../main/menu.html";
    });
  });

  // Dépôt direct
  document.querySelector(".wallet").addEventListener("click", () => {
    window.location.href = "../main/depot.html";
  });
});

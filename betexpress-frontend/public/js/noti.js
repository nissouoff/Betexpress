document.addEventListener("DOMContentLoaded", async () => {
  const userId = localStorage.getItem("userId"); // 🔑 ID Telegram stocké localement
  const notifContainer = document.getElementById("notif-container");

  if (!userId) {
    notifContainer.innerHTML = "<p class='empty-msg'>⚠️ Aucun utilisateur connecté.</p>";
    return;
  }
q
  try {
    const res = await fetch(`http://localhost:3001/api/notifications/${userId}`);
    const data = await res.json();

    if (!data || data.length === 0) {
      notifContainer.innerHTML = "<p class='empty-msg'>Aucune notification trouvée.</p>";
      return;
    }

    notifContainer.innerHTML = ""; // Clear le message de chargement
    data.forEach(notif => {
      const div = document.createElement("div");
      div.className = "notif";
      div.innerHTML = `
        <div class="notif-text">${notif.valide}</div>
        <div class="notif-date">📅 ${notif.date}</div>
      `;
      notifContainer.appendChild(div);
    });
  } catch (err) {
    console.error("Erreur chargement notifications:", err);
    notifContainer.innerHTML = "<p class='empty-msg'>❌ Erreur lors du chargement.</p>";
  }
});


// Charger le SDK Telegram
const script = document.createElement("script");
script.src = "https://telegram.org/js/telegram-web-app.js";
document.head.appendChild(script);

script.onload = () => {
  const tg = window.Telegram.WebApp;
  tg.expand(); // Plein écran

  // Dès que la page est chargée
  window.addEventListener("DOMContentLoaded", async () => {
    const user = tg.initDataUnsafe?.user;

    if (!user) {
      alert("Impossible de récupérer vos données Telegram ❌");
      return;
    }

    // Construire l’objet user
    const userData = {
      id: user.id,
      username: user.username || "",
      name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      number: tg.initDataUnsafe?.user?.phone_number || ""
    };

    console.log("📩 Données récupérées :", userData);

    try {
      // Envoi au backend pour enregistrement
      const response = await fetch("http://localhost:3001/api/telegram-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
      });

      const result = await response.json();

      if (result.success) {
        console.log("✅ Connexion réussie :", result.message);

        // Sauvegarder l'ID dans localStorage pour les futures requêtes
        localStorage.setItem("userId", userData.id);

        // Redirection vers la page principale
        window.location.href = "./main/home.html";
      } else {
        alert("Erreur de connexion ❌");
      }
    } catch (err) {
      console.error("🚨 Erreur serveur :", err);
      alert("Erreur serveur 🚨");
    }
  });
};

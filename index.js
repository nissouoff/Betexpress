const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { exec } = require("child_process");

const app = express();
const PORT = 3001;

app.use(cors({
  origin: "*",   // ou spécifie ton front
  methods: ["GET","POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// === Connexion DB ===
const DB_PATH = path.join(__dirname, "users.db");
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("❌ Erreur connexion DB :", err);
  else console.log("✅ Connecté à SQLite :", DB_PATH);
});


// === Fonction : Sauvegarder un utilisateur ===
function saveUser(user, callback) {
  const dateNow = new Date().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  db.get("SELECT * FROM users WHERE id = ?", [user.id], (err, row) => {
    if (err) return callback({ success: false, message: "Erreur DB ❌" });

    if (row) {
      console.log(`ℹ️ Utilisateur déjà inscrit : ${row.username || row.name}`);
      return callback({ success: true, message: "Utilisateur déjà inscrit ✅", user: row });
    } else {
      const sql = `
        INSERT INTO users (id, username, name, inscription_date, promo_code)
        VALUES (?, ?, ?, ?, ?)
      `;
      db.run(
        sql,
        [user.id, user.username || "", user.name || "", dateNow, ""],
        function (err) {
          if (err) return callback({ success: false, message: "Erreur insertion ❌" });
          console.log(`✅ Nouvel utilisateur ajouté : ${user.username || user.name}`);
          callback({
            success: true,
            message: "Nouvel utilisateur ajouté ✅",
            user: {
              id: user.id,
              username: user.username,
              name: user.name,
              inscription_date: dateNow,
              promo_code: ""
            },
          });
        }
      );
    }
  });
}

// === API ===

// Ajout/connexion via Telegram
app.post("/api/telegram-login", (req, res) => {
  const user = req.body;
  if (!user || !user.id) return res.status(400).json({ success: false, message: "User ID manquant ❌" });

  saveUser(user, (result) => res.json(result));
});

// Voir tous les utilisateurs
app.get("/api/users", (req, res) => {
  db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Erreur DB ❌" });
    res.json({ success: true, users: rows });
  });
});


// Récupérer les paris
app.get("/api/bets", (req, res) => {
  const sql = "SELECT * FROM betDays";
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("❌ Erreur récupération bets :", err.message);
      return res.json({ success: true, bets: [] }); // ⚠️ renvoyer tableau vide
    }

    console.log("📊 Résultat SQL :", rows);

    const bets = rows.map(row => ({
      titre_de_pari: `${row.team1} vs ${row.team2}`,
      heur: row.heur,
      team1: row.team1,
      team2: row.team2,
      url_team1: row.url_team1,
      url_team2: row.url_team2,
      pari: row.pari,
      reponse1: row.reponse1,
      reponse2: row.reponse2,
    }));

    res.json({ success: true, bets });
  });
});


// === Lancer serveur ===
app.listen(PORT, () => {
  console.log(`🚀 Backend lancé sur http://localhost:${PORT}`);
});


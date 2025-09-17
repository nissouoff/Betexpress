// backend.js
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 3001;

app.use(cors({
  origin: "*",   // adapte si tu veux limiter au frontend
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

    const proceedWallet = () => {
      db.get("SELECT * FROM wallet_users WHERE user_id = ?", [user.id], (err2, walletRow) => {
        if (err2) return console.error("❌ Erreur DB wallet_users :", err2.message);

        if (!walletRow) {
          const sqlWallet = `
            INSERT INTO wallet_users 
            (user_id, username, wallet_total, gain, perte, last_update)
            VALUES (?, ?, 0, 0, 0, ?)
          `;
          db.run(sqlWallet, [user.id, user.username || "", dateNow], (err3) => {
            if (err3) console.error("❌ Erreur insertion wallet_users :", err3.message);
            else console.log(`✅ Wallet créé pour : ${user.username || user.name}`);
          });
        }
      });
    };

    if (row) {
      proceedWallet();
      return callback({ success: true, message: "Utilisateur déjà inscrit ✅", user: row });
    } else {
      const sql = `
        INSERT INTO users (id, username, name, inscription_date, promo_code)
        VALUES (?, ?, ?, ?, ?)
      `;
      db.run(sql, [user.id, user.username || "", user.name || "", dateNow, ""], function (err) {
        if (err) return callback({ success: false, message: "Erreur insertion ❌" });

        proceedWallet();
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
      });
    }
  });
}

// === ROUTES EXISTANTES ===

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
      return res.json({ success: true, bets: [] });
    }

    const bets = rows.map(row => ({
      id: row.id,
      titre_de_pari: row.titre_de_pari || `${row.team1} vs ${row.team2}`,
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

// === NOUVELLE ROUTE : CONFIRMATION DE MISE ===
app.post("/api/place-bet", (req, res) => {
  const { userId, betId, reponse } = req.body;
  const mise = 1; // toujours 1$
  const dateNow = new Date().toISOString();

  if (!userId || !betId || !reponse) {
    return res.status(400).json({ success: false, message: "Paramètres manquants ❌" });
  }

  // Vérifier solde utilisateur
  db.get("SELECT wallet_total FROM wallet_users WHERE user_id = ?", [userId], (err, wallet) => {
    if (err) {
      console.error("❌ Erreur DB :", err.message);
      return res.status(500).json({ success: false, message: "Erreur serveur DB ❌" });
    }

    if (!wallet) {
      return res.status(404).json({ success: false, message: "Utilisateur introuvable ❌" });
    }

    if (wallet.wallet_total < mise) {
      return res.json({ success: false, message: "Solde insuffisant, veuillez recharger votre solde ❌" });
    }

    // Débiter l’utilisateur
    const newSolde = wallet.wallet_total - mise;
    db.run("UPDATE wallet_users SET wallet_total = ?, last_update = ? WHERE user_id = ?", 
      [newSolde, dateNow, userId], 
      (err2) => {
        if (err2) {
          console.error("❌ Erreur update solde :", err2.message);
          return res.status(500).json({ success: false, message: "Erreur serveur update ❌" });
        }

        // Enregistrer la mise dans accept_pari
        const id_unique = `${userId}_${betId}_${Date.now()}`;
        const sqlInsert = `
          INSERT INTO accept_pari (id_unique, id_user, id_pari, mis_pari, reponse_pari, statu_pari, date_pari)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(sqlInsert, [id_unique, userId, betId, mise, reponse, "Accepter", dateNow], (err3) => {
          if (err3) {
            console.error("❌ Erreur insertion accept_pari :", err3.message);
            return res.status(500).json({ success: false, message: "Erreur serveur insertion ❌" });
          }

          console.log(`✅ Mise acceptée : ${userId} -> pari ${betId} (${reponse})`);
          res.json({ success: true, message: `Mise de ${mise}$ placée sur ${reponse} ✅`, newSolde });
        });
      }
    );
  });
});

// === Lancer serveur ===
app.listen(PORT, () => {
  console.log(`🚀 Backend lancé sur http://localhost:${PORT}`);
});

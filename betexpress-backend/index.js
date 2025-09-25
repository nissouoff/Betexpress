const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const { ethers } = require("ethers");
const axios = require('axios');
const crypto = require('crypto');
const { Web3 } = require('web3'); // Importation destructurée

const app = express();
const PORT = process.env.PORT || 3001;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API BetExpress en ligne ✅");
});

// === SOCKET.IO ===
io.on("connection", (socket) => {
  console.log("🟢 Un utilisateur est connecté :", socket.id);
  socket.on("disconnect", () => {
    console.log("🔴 Utilisateur déconnecté :", socket.id);
  });
});

// === CONNEXION DB ===
const DB_PATH = path.join(__dirname, "users.db");
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("❌ Erreur connexion DB :", err);
  else console.log("✅ Connecté à SQLite :", DB_PATH);
});

const BINANCE_API_KEY = 'jf7pRrp3j7FaN7B2r95heXwBD42hOtMYTabfFV23efUlLqKN39IghJhsk2I8kF0b';
const BINANCE_API_SECRET = 'x7zvo58LkAjt8SJxJ3kIdEMZXQT0p4gwlMQynnRw8Nkc10umiiYFNtMaLsa3xwon';
const POLYGON_RPC_URL = 'https://polygon-mainnet.infura.io/v3/VIQDKTTZNTG6EXB341ZS28Q3Y1XHEXE11PT';
const DEPOSIT_ADDRESS = '0xe3578e7cbfc81ed8e7ae572764f8373cd8182de5'.toLowerCase();
const USDT_CONTRACT = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'.toLowerCase();
const TRANSFER_METHOD_ID = '0xa9059cbb';

const web3 = new Web3(POLYGON_RPC_URL); // Utilisation directe de l'URL

function signBinanceQuery(queryString) {
    return crypto.createHmac('sha256', BINANCE_API_SECRET).update(queryString).digest('hex');
}

// === Sauvegarder utilisateur ===
function saveUser(user, callback) {
  const dateNow = new Date().toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  db.get("SELECT * FROM users WHERE id = ?", [user.id], (err, row) => {
    if (err) return callback({ success: false, message: "Erreur DB ❌" });

    const proceedWallet = () => {
      db.get("SELECT * FROM wallet_users WHERE user_id = ?", [user.id], (err2, walletRow) => {
        if (err2) return console.error("❌ Erreur DB wallet_users :", err2.message);

        if (!walletRow) {
          const sqlWallet = `INSERT INTO wallet_users (user_id, username, wallet_total, gain, perte, last_update)
                             VALUES (?, ?, 0, 0, 0, ?)`;
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
      const sql = `INSERT INTO users (id, username, name, inscription_date, promo_code) VALUES (?, ?, ?, ?, ?)`;
      db.run(sql, [user.id, user.username || "", user.name || "", dateNow, ""], function (err) {
        if (err) return callback({ success: false, message: "Erreur insertion ❌" });
        proceedWallet();
        callback({ success: true, message: "Nouvel utilisateur ajouté ✅", user: { id: user.id, username: user.username, name: user.name, inscription_date: dateNow, promo_code: "" } });
      });
    }
  });
}

// === ROUTES ===

// Telegram login
app.post("/api/telegram-login", (req, res) => {
  const user = req.body;
  if (!user || !user.id) return res.status(400).json({ success: false, message: "User ID manquant ❌" });
  saveUser(user, (result) => res.json(result));
});

// Tous les utilisateurs
app.get("/api/users", (req, res) => {
  db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Erreur DB ❌" });
    res.json({ success: true, users: rows });
  });
});

// Récupérer tous les paris
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
      total_particip: row.total_particip || 0,
      total_reponse1: row.total_reponse1 || 0,
      total_reponse2: row.total_reponse2 || 0,
    }));

    res.json({ success: true, bets });
  });
});

// Placer un pari
app.post("/api/place-bet", (req, res) => {
  const { userId, betId, reponse } = req.body;
  const mise = 1;
  const dateNow = new Date().toISOString();

  if (!userId || !betId || !reponse)
    return res.status(400).json({ success: false, message: "Paramètres manquants ❌" });

  // Vérifier le solde de l'utilisateur
  db.get("SELECT wallet_total FROM wallet_users WHERE user_id = ?", [userId], (err, wallet) => {
    if (err) return res.status(500).json({ success: false, message: "Erreur serveur DB ❌" });
    if (!wallet) return res.status(404).json({ success: false, message: "Utilisateur introuvable ❌" });
    if (wallet.wallet_total < mise) return res.json({ success: false, message: "Solde insuffisant ❌" });

    const newSolde = wallet.wallet_total - mise;

    db.run(
      "UPDATE wallet_users SET wallet_total = ?, last_update = ? WHERE user_id = ?",
      [newSolde, dateNow, userId],
      (err2) => {
        if (err2) return res.status(500).json({ success: false, message: "Erreur serveur update ❌" });

        const id_unique = `${userId}_${betId}_${Date.now()}`;
        const sqlInsert = `INSERT INTO accept_pari (id_unique, id_user, id_pari, mis_pari, reponse_pari, statu_pari, date_pari)
                           VALUES (?, ?, ?, ?, ?, ?, ?)`;

        db.run(sqlInsert, [id_unique, userId, betId, mise, reponse, "Accepter", dateNow], (err3) => {
          if (err3) return res.status(500).json({ success: false, message: "Erreur serveur insertion ❌" });

          // === Mettre à jour total participants correctement ===
          db.get("SELECT * FROM betDays WHERE id = ?", [betId], (errBet, bet) => {
            if (errBet) return console.error("❌ Erreur récupération betDays :", errBet.message);

            let colUpdate;
            if (reponse === bet.reponse1) colUpdate = "total_reponse1";
            else if (reponse === bet.reponse2) colUpdate = "total_reponse2";
            else return console.error("⚠️ Réponse invalide :", reponse);

            const sqlUpdate = `UPDATE betDays SET total_particip = total_particip + 1, ${colUpdate} = ${colUpdate} + 1 WHERE id = ?`;
            db.run(sqlUpdate, [betId], (err4) => {
              if (err4) console.error("❌ Erreur update betDays :", err4.message);

              // Récupérer le pari mis à jour et broadcast
              db.get("SELECT * FROM betDays WHERE id = ?", [betId], (err5, updatedBet) => {
                if (err5) console.error("❌ Erreur récupération betDays :", err5.message);
                else io.emit("betUpdated", updatedBet); // Envoie à tous les clients
              });
            });
          });

          io.emit("balanceUpdated", { userId, newBalance: newSolde });
          res.json({ success: true, message: `Mise de ${mise}$ placée sur "${reponse}" ✅`, newSolde });
        });
      }
    );
  });
});

// Solde utilisateur
app.get("/api/wallet/:id", (req, res) => {
  const userId = req.params.id;
  db.get("SELECT * FROM wallet_users WHERE user_id = ?", [userId], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: "Erreur serveur DB ❌" });
    if (!row) return res.status(404).json({ success: false, message: "Utilisateur introuvable ❌" });
    res.json({ success: true, wallet: { user_id: row.user_id, wallet_total: row.wallet_total, gain: row.gain, perte: row.perte, last_update: row.last_update } });
  });
});

// === Récupérer paris acceptés d'un utilisateur
app.get("/api/accepted-bets/:userId", (req, res) => {
  const userId = req.params.userId;

  const sqlAccepted = "SELECT * FROM accept_pari WHERE id_user = ?";
  db.all(sqlAccepted, [userId], (err, acceptedBets) => {
    if (err) return res.status(500).json({ success: false, message: "Erreur DB accept_pari ❌", err });

    if (!acceptedBets || acceptedBets.length === 0) return res.json({ success: true, acceptedBets: [], betDays: [] });

    const betIds = acceptedBets.map(b => b.id_pari);
    const placeholders = betIds.map(() => "?").join(",");
    const sqlBetDays = `SELECT * FROM betDays WHERE id IN (${placeholders})`;

    db.all(sqlBetDays, betIds, (err2, betDays) => {
      if (err2) return res.status(500).json({ success: false, message: "Erreur DB betDays ❌", err: err2 });
      res.json({ success: true, acceptedBets, betDays });
    });
  });
});

app.get("/api/get-user-info", (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ success: false, message: "ID requis" });

  const sql = `SELECT id, username, name, inscription_date, promo_code 
               FROM users WHERE id = ?`;

  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error("❌ Erreur DB:", err.message);
      return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
    if (!row) {
      return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }
    res.json(row);
  });
});

app.post("/api/update-user", (req, res) => {
  const { id, field, value } = req.body;

  if (!id || !field || value === undefined) {
    return res.status(400).json({ success: false, message: "Champs manquants" });
  }

  // ⚡ Vérifier que le champ demandé est autorisé
  const allowedFields = ["name", "promo_code"];
  if (!allowedFields.includes(field)) {
    return res.status(400).json({ success: false, message: "Champ non autorisé" });
  }

  const sql = `UPDATE users SET ${field} = ? WHERE id = ?`;

  db.run(sql, [value, id], function (err) {
    if (err) {
      console.error("❌ Erreur DB:", err.message);
      return res.status(500).json({ success: false, message: "Erreur DB" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: "Utilisateur non trouvé" });
    }

    res.json({ success: true, message: `${field} mis à jour`, field, value });
  });
});

// ⚡ Route GET Wallet
app.get("/api/get-wallet", (req, res) => {
  const userId = req.query.id;

  if (!userId) {
    return res.status(400).json({ error: "ID requis" });
  }

  db.get(
    `SELECT user_id, wallet_total, gain, perte, last_update 
     FROM wallet_users 
     WHERE user_id = ?`,
    [userId],
    (err, row) => {
      if (err) {
        console.error("❌ Erreur DB get-wallet:", err.message);
        return res.status(500).json({ error: "Erreur serveur DB" });
      }

      if (!row) {
        // Si pas encore de wallet pour cet utilisateur → en créer un avec valeurs par défaut
        db.run(
          `INSERT INTO wallet_users (user_id, username, wallet_total, gain, perte, last_update)
           VALUES (?, ?, 0, 0, 0, datetime('now'))`,
          [userId, "unknown"],
          (insertErr) => {
            if (insertErr) {
              console.error("❌ Erreur création wallet:", insertErr.message);
              return res.status(500).json({ error: "Impossible de créer le wallet" });
            }

            return res.json({
              user_id: userId,
              wallet_total: 0,
              gain: 0,
              perte: 0,
              last_update: new Date().toISOString(),
            });
          }
        );
      } else {
        res.json(row);
      }
    }
  );
});

// backend.js
// Ajoute en haut (après les autres const)
const POLYGONSCAN_V2_API_KEY = 'IQDKTTZNTG6EXB341ZS28Q3Y1XHEXE11PT'; // Remplace par TA VRAIE CLE ETHERSCAN V2

// === Dépôt USDT ===
app.post('/verify-deposit', async (req, res) => {
    console.log('📥 Requête reçue:', req.body);
    const { txId, amount, asset, userId } = req.body;

    if (!txId || asset !== 'USDT' || !userId) {
        return res.status(400).json({ success: false, message: 'Données invalides (txId, userId requis, asset doit être USDT)' });
    }

    try {
        // === Vérification sur Polygon ===
        const txUrl = `https://api.etherscan.io/v2/api?module=proxy&action=eth_getTransactionByHash&txhash=${txId}&chainid=137&apikey=${POLYGONSCAN_V2_API_KEY}`;
        const txResponse = await axios.get(txUrl);
        const txData = txResponse.data.result;

        if (!txData || txData.error) {
            return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
        }

        const input = txData.input?.toLowerCase();
        const toLower = txData.to?.toLowerCase();

        if (toLower !== USDT_CONTRACT || !input?.startsWith(TRANSFER_METHOD_ID)) {
            return res.status(400).json({ success: false, message: 'Pas un dépôt USDT valide' });
        }

        // Décodage du montant blockchain
        const txAmountHex = '0x' + input.slice(74, 138);
        const txAmount = parseInt(txAmountHex, 16) / 1e6;

        // Vérif du destinataire
        const recipientHex = input.slice(34, 74);
        const recipient = '0x' + recipientHex.slice(-40);
        if (recipient.toLowerCase() !== DEPOSIT_ADDRESS) {
            return res.status(400).json({ success: false, message: 'Adresse destinataire incorrecte' });
        }

        // Vérif receipt
        const receiptUrl = `https://api.etherscan.io/v2/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txId}&chainid=137&apikey=${POLYGONSCAN_V2_API_KEY}`;
        const receiptResponse = await axios.get(receiptUrl);
        const receipt = receiptResponse.data.result;

        if (!receipt || receipt.status !== '0x1') {
            return res.status(400).json({ success: false, message: 'Transaction non confirmée' });
        }

        // === Comparaison avec tolérance ===
        const tolerance = 0.01; // accepte +/- 0.01 USDT
        if (Math.abs(txAmount - amount) > tolerance) {
            console.log(`❌ Montant incorrect. Attendu ~${amount}, reçu ${txAmount}`);
            return res.status(400).json({ 
                success: false, 
                message: `Montant invalide (attendu ${amount} USDT, reçu ${txAmount} USDT)` 
            });
        }

        // === Étape 1 : Vérif anti-double dépôt (hash déjà utilisé ?) ===
        db.get(`SELECT hash FROM blok_list WHERE hash = ?`, [txId], (err, row) => {
            if (err) {
                console.error("❌ Erreur DB blok-list:", err);
                return res.status(500).json({ success: false, message: "Erreur DB vérification hash" });
            }

            if (row) {
                return res.status(400).json({ success: false, message: "Hash déjà utilisé !" });
            }

            // === Étape 2 : Mise à jour du solde utilisateur ===
            db.get(`SELECT wallet_total FROM wallet_users WHERE user_id = ?`, [userId], (err2, row2) => {
                if (err2) {
                    console.error("❌ Erreur DB wallet:", err2);
                    return res.status(500).json({ success: false, message: "Erreur DB lecture wallet" });
                }

                let currentSolde = row2 ? parseFloat(row2.wallet_total) : 0;
                let newSolde = currentSolde + amount; // ⚡ Ici on ajoute le montant saisi par l'utilisateur

                db.run(`UPDATE wallet_users SET wallet_total = ? WHERE user_id = ?`, [newSolde, userId], (err3) => {
                    if (err3) {
                        console.error("❌ Erreur UPDATE wallet:", err3);
                        return res.status(500).json({ success: false, message: "Erreur DB mise à jour wallet" });
                    }

                    // === Étape 3 : Insérer dans blok-list ===
                    const now = new Date();
                    const dateStr = now.toISOString().replace("T", " ").slice(0, 19);

                    db.run(
                        `INSERT INTO blok_list (hash, id, date, usdt) VALUES (?, ?, ?, ?)`,
                        [txId, userId, dateStr, amount], // ⚡ Ici aussi on enregistre le montant saisi par l'utilisateur
                        (err4) => {
                            if (err4) {
                                console.error("❌ Erreur INSERT blok-list:", err4);
                                return res.status(500).json({ success: false, message: "Erreur DB ajout blok-list" });
                            }

                            console.log(`✅ Dépôt confirmé: user ${userId}, +${amount} USDT, hash ${txId}`);
                            return res.status(200).json({ success: true, amount, txId, newSolde });
                        }
                    );
                });
            });
        });

    } catch (error) {
        console.error('❌ Erreur serveur:', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur: ' + error.message });
    }
});

// Ajout d'une demande de dépôt
app.post("/create-deposit", (req, res) => {
  const { txId, amount, userId } = req.body;

  if (!txId || !amount || !userId) {
    return res.status(400).json({ success: false, message: "Données invalides" });
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  db.run(
    `INSERT INTO deposits (hash, id, usdt, date, status) VALUES (?, ?, ?, ?, 'wait')`,
    [txId, userId, amount, now],
    (err) => {
      if (err) {
        console.error("❌ Erreur INSERT deposit:", err.message);
        return res.status(500).json({ success: false, message: "Erreur DB" });
      }

      console.log(`📥 Nouvelle demande dépôt: ${txId}, user ${userId}, ${amount} USDT`);
      return res.status(200).json({ success: true, message: "Demande créée avec succès" });
    }
  );
});

// === Vérification automatique des dépôts toutes les 30s ===
const MAX_PER_CYCLE = 5; // nombre max de dépôts à traiter par cycle
const VERIFY_INTERVAL = 30000; // 30 secondes
function updateClientBalance(userId, newBalance) {
  io.emit("balanceUpdated", { userId, newBalance });
}


async function verifyPendingDeposits() {
  // --- Helpers promisifiés pour sqlite (db est ta connexion sqlite3)
  const dbAll = (sql, params=[]) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
  const dbGet = (sql, params=[]) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
  const dbRun = (sql, params=[]) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
  });

  try {
    // --- 1) S'assurer que la colonne 'lecture' existe dans notifi
    const cols = await dbAll(`PRAGMA table_info(notifi)`);
    const hasLecture = cols.some(c => c.name === 'lecture');
    if (!hasLecture) {
      // Ajoute la colonne lecture avec valeur par défaut 'no'
      await dbRun(`ALTER TABLE notifi ADD COLUMN lecture TEXT DEFAULT 'no'`);
      console.log("✅ Colonne 'lecture' ajoutée à la table notifi");
    }

    // --- 2) Lire les deposits en attente
    const rows = await dbAll(
      `SELECT * FROM deposits WHERE status='wait' ORDER BY date ASC LIMIT ?`,
      [MAX_PER_CYCLE]
    );

    if (!rows || rows.length === 0) {
      return console.log("ℹ️ Aucune demande à vérifier.");
    }

    for (const deposit of rows) {
      const { hash: txId, usdt: amount, id: userId } = deposit;
      const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

      try {
        // --- Anti-double dépôt
        const exist = await dbGet(`SELECT * FROM blok_list WHERE hash=?`, [txId]);
        if (exist) {
          const notifId = crypto.randomUUID();
          const notifMessage = `Cher ${userId}, le hash que vous avez fourni (${txId}) a déjà été utilisé. Votre dépôt ne peut pas être traité.`;
          await dbRun(
            `INSERT INTO notifi (id, "user_id", valide, date, lecture) VALUES (?, ?, ?, ?, ?)`,
            [notifId, userId, notifMessage, nowStr, 'no']
          );

          await dbRun(`DELETE FROM deposits WHERE hash=?`, [txId]);
          console.log(`❌ Dépôt refusé (hash déjà utilisé): ${txId}`);
          continue;
        }

        // --- Vérification blockchain (tx exists)
        const txUrl = `https://api.etherscan.io/v2/api?module=proxy&action=eth_getTransactionByHash&txhash=${txId}&chainid=137&apikey=${POLYGONSCAN_V2_API_KEY}`;
        const txResponse = await axios.get(txUrl);
        const txData = txResponse.data?.result;

        if (!txData) {
          const notifId = crypto.randomUUID();
          const notifMessage = `Cher ${userId}, nous n'avons pas pu trouver de transaction correspondant au hash que vous avez fourni (${txId}). Votre dépôt n'a pas été traité.`;
          await dbRun(
            `INSERT INTO notifi (id, "user_id", valide, date, lecture) VALUES (?, ?, ?, ?, ?)`,
            [notifId, userId, notifMessage, nowStr, 'no']
          );
          await dbRun(`DELETE FROM deposits WHERE hash=?`, [txId]);
          console.log(`❌ Dépôt refusé (transaction non trouvée): ${txId}`);
          continue;
        }

        const input = txData.input?.toLowerCase();
        const toLower = txData.to?.toLowerCase();
        const txAmountHex = '0x' + (input?.slice(74, 138) || '');
        const txAmount = txAmountHex && txAmountHex !== '0x' ? parseInt(txAmountHex, 16) / 1e6 : 0;
        const recipientHex = input?.slice(34, 74) || '';
        const recipient = recipientHex ? '0x' + recipientHex.slice(-40) : '';

        if (toLower !== USDT_CONTRACT || !input?.startsWith(TRANSFER_METHOD_ID) || recipient.toLowerCase() !== DEPOSIT_ADDRESS) {
          const notifId = crypto.randomUUID();
          const notifMessage = `Cher ${userId}, la transaction (${txId}) n'est pas un dépôt USDT valide. Dépôt refusé.`;
          await dbRun(
            `INSERT INTO notifi (id, "user_id", valide, date, lecture) VALUES (?, ?, ?, ?, ?)`,
            [notifId, userId, notifMessage, nowStr, 'no']
          );
          await dbRun(`DELETE FROM deposits WHERE hash=?`, [txId]);
          console.log(`❌ Dépôt refusé (transaction invalide): ${txId}`);
          continue;
        }

        // --- Récupérer le receipt et vérifier le status
        const receiptUrl = `https://api.etherscan.io/v2/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txId}&chainid=137&apikey=${POLYGONSCAN_V2_API_KEY}`;
        const receiptResponse = await axios.get(receiptUrl);
        const receipt = receiptResponse.data?.result;

        if (!receipt || receipt.status !== '0x1') {
          const notifId = crypto.randomUUID();
          const notifMessage = `Cher ${userId}, la transaction (${txId}) n'a pas été confirmée sur la blockchain. Dépôt refusé.`;
          await dbRun(
            `INSERT INTO notifi (id, "user_id", valide, date, lecture) VALUES (?, ?, ?, ?, ?)`,
            [notifId, userId, notifMessage, nowStr, 'no']
          );
          await dbRun(`DELETE FROM deposits WHERE hash=?`, [txId]);
          console.log(`❌ Dépôt refusé (transaction non confirmée): ${txId}`);
          continue;
        }

        // --- Vérification montant (tolérance)
        const tolerance = 0.03; // ou calcule dynamiquement si tu veux
        if (Math.abs(txAmount - amount) > tolerance) {
          const notifId = crypto.randomUUID();
          const notifMessage = `Cher ${userId}, le montant envoyé (${txAmount} USDT) ne correspond pas au montant indiqué (${amount} USDT). Dépôt refusé.`;
          await dbRun(
            `INSERT INTO notifi (id, "user_id", valide, date, lecture) VALUES (?, ?, ?, ?, ?)`,
            [notifId, userId, notifMessage, nowStr, 'no']
          );
          await dbRun(`DELETE FROM deposits WHERE hash=?`, [txId]);
          console.log(`❌ Dépôt refusé (montant incorrect): ${txId}`);
          continue;
        }

        // --- Tout OK : mise à jour solde (atomicité approximative)
        const row2 = await dbGet(`SELECT wallet_total FROM wallet_users WHERE user_id=?`, [userId]);
        const currentSolde = row2 ? parseFloat(row2.wallet_total) : 0;
        const newSolde = currentSolde + amount;

        await dbRun(`UPDATE wallet_users SET wallet_total=? WHERE user_id=?`, [newSolde, userId]);

        // Ajouter dans la blok_list
        await dbRun(`INSERT INTO blok_list (hash, user_id, date, usdt) VALUES (?, ?, ?, ?)`, [txId, userId, nowStr, amount]);

        // Supprimer de deposits
        await dbRun(`DELETE FROM deposits WHERE hash=?`, [txId]);

        // Notification validée (lecture = 'no')
        const notifId = crypto.randomUUID();
        const notifMessage = `Cher ${userId}, votre dépôt de ${amount} USDT a été validé. Nouveau solde: ${newSolde} USDT.`;
        await dbRun(
          `INSERT INTO notifi (id, "user_id", valide, date, lecture) VALUES (?, ?, ?, ?, ?)`,
          [notifId, userId, notifMessage, nowStr, 'no']
        );

        // Émettre événement pour mise à jour côté client
        try { updateClientBalance(userId, newSolde); } catch (e) { /* ignore socket errors */ }

        console.log(`✅ Dépôt validé et notification envoyée: ${txId}`);
      } catch (error) {
        console.error(`❌ Erreur vérification dépôt ${txId}:`, error?.message || error);
        // Optionnel: tu peux ajouter une notif d'erreur ici si tu veux
      }
    }

  } catch (err) {
    console.error("❌ verifyPendingDeposits erreur globale :", err);
  }
}

setInterval(verifyPendingDeposits, 30000);

// 🚀 Route pour récupérer les notifications d’un utilisateur
app.get("/api/notifications/:userId", (req, res) => {
  const { userId } = req.params;
  const sql = `SELECT id, valide, date, lecture 
               FROM notifi 
               WHERE user_id = ? 
               ORDER BY date DESC`;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error("❌ Erreur récupération notifications :", err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
    res.json(rows);
  });
});

// 🚀 Route pour marquer toutes les notifications non lues comme "lues"

app.post("/api/notifications/mark-read", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "UserId manquant" });

  const sql = `UPDATE notifi SET lecture = 'oui' WHERE user_id = ? AND lecture = 'no'`;
  db.run(sql, [userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, updated: this.changes });
  });
});


// === FIN ===
server.listen(PORT, () => {
  console.log(`🚀 Backend + WebSocket lancé sur http://localhost:${PORT}`);
});
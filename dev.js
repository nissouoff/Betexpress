const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "users.db");
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  console.log("📂 Vérification/Création des tables...");

  // Table principale "users"
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT,
      name TEXT,
      inscription_date TEXT,
      promo_code TEXT
    )
  `, (err) => {
    if (err) {
      console.error("❌ Erreur création table users :", err.message);
    } else {
      console.log("✅ Table 'users' prête !");
    }
  });

  // Nouvelle table "wallet_users"
  db.run(`
    CREATE TABLE IF NOT EXISTS wallet_users (
      user_id TEXT PRIMARY KEY,
      username TEXT,
      wallet_total REAL DEFAULT 0,
      gain REAL DEFAULT 0,
      perte REAL DEFAULT 0,
      last_update TEXT
    )
  `, (err) => {
    if (err) {
      console.error("❌ Erreur création table wallet_users :", err.message);
    } else {
      console.log("✅ Table 'wallet_users' prête !");
    }
  });

  // Nouvelle table "promo_code"
  db.run(`
    CREATE TABLE IF NOT EXISTS promo_code (
      user_id TEXT PRIMARY KEY,
      promo_code TEXT,
      total_use REAL DEFAULT 0
    )
  `, (err) => {
    if (err) {
      console.error("❌ Erreur création table promo_code :", err.message);
    } else {
      console.log("✅ Table 'promo_code' prête !");
    }
  });

  // Nouvelle table "Pari du jour"
  db.run(`
    CREATE TABLE IF NOT EXISTS betDays (
      id TEXT PRIMARY KEY,
      titre_de_pari TEXT,
      team1 TEXT,
      url_team1 TEXT,
      team2 TEXT,
      url_team2 TEXT,
      heur TEXT,
      pari TEXT,
      reponse1 TEXT,
      reponse2 TEXT,
      total_particip REAL DEFAULT 0,
      total_reponse1 REAL DEFAULT 0,
      total_reponse2 REAL DEFAULT 0
    )
  `, (err) => {
    if (err) {
      console.error("❌ Erreur création table betDays :", err.message);
    } else {
      console.log("✅ Table 'betDays' prête !");
    }
  });

  // Nouvelle table "pari accepter"
  db.run(`
    CREATE TABLE IF NOT EXISTS accept_pari (
      id_unique TEXT PRIMARY KEY,
      id_user TEXT,
      id_pari TEXT,
      mis_pari REAL,
      reponse_pari TEXT,
      statu_pari TEXT,
      date_pari TEXT
    )
  `, (err) => {
    if (err) {
      console.error("❌ Erreur création table accept_pari :", err.message);
    } else {
      console.log("✅ Table 'accept_pari' prête !");
    }
  });

  db.close();
});

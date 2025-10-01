// db.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // obligatoire sur Render
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS depot (
        id SERIAL PRIMARY KEY,
        depotUsdt REAL NOT NULL,
        pirceusdt REAL NOT NULL,
        totldz REAL NOT NULL,
        used REAL DEFAULT 0,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        destinataire TEXT NOT NULL,
        montant REAL NOT NULL,
        totaldz REAL NOT NULL,
        priceusdt REAL NOT NULL,
        etat TEXT NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS total (
        id SERIAL PRIMARY KEY,
        total_usdt REAL,
        total_vente REAL
      )
    `);

    const res = await pool.query(`SELECT COUNT(*) FROM total`);
    if (parseInt(res.rows[0].count) === 0) {
      await pool.query(
        `INSERT INTO total (total_usdt, total_vente) VALUES ($1,$2)`,
        [0, 0]
      );
      console.log("✔ Ligne par défaut insérée dans 'total'");
    }

    console.log("✅ Base Postgres initialisée avec succès !");
  } catch (err) {
    console.error("❌ Erreur initDB:", err.message);
  }
}

initDB();

module.exports = pool;

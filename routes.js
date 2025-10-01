// routes.js
const express = require("express");
const router = express.Router();
const db = require("./db");

// ==================== TRANSACTIONS ====================
router.get("/transactions", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM transactions ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/transactions/:id", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM transactions WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Transaction non trouvée" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/transactions", async (req, res) => {
  const { destinataire, montant, totaldz, priceusdt, etat } = req.body;
  try {
    await db.query(
      `INSERT INTO transactions (destinataire, montant, totaldz, priceusdt, etat) VALUES ($1,$2,$3,$4,$5)`,
      [destinataire, montant, totaldz, priceusdt, etat]
    );
    res.json({ message: "Transaction ajoutée !" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/transactions/:id", async (req, res) => {
  const { destinataire, montant, etat } = req.body;
  try {
    await db.query(
      `UPDATE transactions SET destinataire=$1, montant=$2, etat=$3 WHERE id=$4`,
      [destinataire, montant, etat, req.params.id]
    );
    res.json({ message: "Transaction mise à jour !" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/transactions/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM transactions WHERE id=$1", [req.params.id]);
    res.json({ message: "Transaction supprimée !" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== DEPOTS ====================
router.get("/depotusdt", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM depot ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/depotusdt", async (req, res) => {
  const { depotUsdt, PrixUnit, totalDZ } = req.body;
  try {
    await db.query(
      `INSERT INTO depot (depotUsdt, pirceusdt, totldz) VALUES ($1,$2,$3)`,
      [depotUsdt, PrixUnit, totalDZ]
    );
    res.json({ message: "Dépôt ajouté !" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== DASHBOARD ====================
router.get("/solde-ventes", async (req, res) => {
  try {
    const dep = await db.query("SELECT COALESCE(SUM(depotUsdt),0) as totalDepot FROM depot");
    const ventes = await db.query("SELECT COALESCE(SUM(montant),0) as totalVentes FROM transactions WHERE etat='payer'");
    res.json({
      totalDepot: dep.rows[0].totaldepot,
      totalVentes: ventes.rows[0].totalventes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/vente-jour", async (req, res) => {
  try {
    const jour = await db.query(
      `SELECT COALESCE(SUM(montant),0) as total_usdt, COALESCE(SUM(totaldz),0) as total_dz
       FROM transactions WHERE DATE(date)=CURRENT_DATE AND etat='payer'`
    );
    res.json(jour.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/vente-mois", async (req, res) => {
  try {
    const mois = await db.query(
      `SELECT COALESCE(SUM(montant),0) as total_usdt, COALESCE(SUM(totaldz),0) as total_dz
       FROM transactions WHERE DATE_TRUNC('month', date)=DATE_TRUNC('month', CURRENT_DATE) AND etat='payer'`
    );
    res.json(mois.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/benef-dep", async (req, res) => {
  try {
    const dep = await db.query("SELECT COALESCE(SUM(totldz),0) as totalDepense FROM depot");
    const ventes = await db.query("SELECT COALESCE(SUM(totaldz),0) as totalVentes FROM transactions WHERE etat='payer'");
    const difference = parseFloat(ventes.rows[0].totalventes) - parseFloat(dep.rows[0].totaldepense);
    res.json({
      totalDepense: dep.rows[0].totaldepense,
      difference,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

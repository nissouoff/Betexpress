// depositVerifier.js
const axios = require("axios");
require('dotenv').config(); // Toujours en haut du fichier

const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_V2_API_KEY;
const DEPOSIT_ADDRESS = process.env.DEPOSIT_ADDRESS.toLowerCase();
const USDT_CONTRACT = process.env.USDT_CONTRACT.toLowerCase();
const TRANSFER_METHOD_ID = "0xa9059cbb";

module.exports = async function verifyDeposits(db) {
  // Récupérer tous les dépôts en attente
  db.all(`SELECT * FROM deposits WHERE status = 'wait'`, [], async (err, rows) => {
    if (err) return console.error("❌ Erreur récupération deposits:", err.message);
    if (!rows || rows.length === 0) return;

    for (const deposit of rows) {
      const { hash: txId, id: userId, usdt: amount } = deposit;

      try {
        // === Vérification transaction ===
        const txUrl = `https://api.polygonscan.com/api?module=proxy&action=eth_getTransactionByHash&txhash=${txId}&apikey=${POLYGONSCAN_API_KEY}`;
        const txResp = await axios.get(txUrl);
        const txData = txResp.data.result;

        if (!txData) {
          console.log(`⚠️ Transaction ${txId} non trouvée`);
          continue;
        }

        const input = txData.input?.toLowerCase();
        const toLower = txData.to?.toLowerCase();

        if (toLower !== USDT_CONTRACT || !input?.startsWith(TRANSFER_METHOD_ID)) {
          console.log(`❌ Transaction ${txId} pas un dépôt USDT valide`);
          continue;
        }

        const txAmountHex = "0x" + input.slice(74, 138);
        const txAmount = parseInt(txAmountHex, 16) / 1e6;

        const recipientHex = input.slice(34, 74);
        const recipient = "0x" + recipientHex.slice(-40);
        if (recipient.toLowerCase() !== DEPOSIT_ADDRESS) {
          console.log(`❌ Transaction ${txId} destinataire incorrect`);
          continue;
        }

        // === Vérification receipt ===
        const receiptUrl = `https://api.polygonscan.com/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txId}&apikey=${POLYGONSCAN_API_KEY}`;
        const receiptResp = await axios.get(receiptUrl);
        const receipt = receiptResp.data.result;

        if (!receipt || receipt.status !== "0x1") {
          console.log(`⚠️ Transaction ${txId} pas encore confirmée`);
          continue;
        }

        // Tolérance de montant
        const tolerance = 0.01;
        if (Math.abs(txAmount - amount) > tolerance) {
          console.log(`❌ Montant incorrect ${txAmount} ≠ ${amount}`);
          continue;
        }

        // Vérif double dépôt
        db.get(`SELECT hash FROM blok_list WHERE hash = ?`, [txId], (err, row) => {
          if (err) return console.error("❌ Erreur DB blok-list:", err);
          if (row) return console.log(`⚠️ Transaction ${txId} déjà traitée`);

          // Mise à jour solde
          db.get(`SELECT wallet_total FROM wallet_users WHERE user_id = ?`, [userId], (err2, row2) => {
            if (err2) return console.error("❌ Erreur DB wallet_users:", err2);

            const current = row2 ? parseFloat(row2.wallet_total) : 0;
            const newSolde = current + amount;

            db.run(`UPDATE wallet_users SET wallet_total = ? WHERE user_id = ?`, [newSolde, userId], (err3) => {
              if (err3) return console.error("❌ Erreur UPDATE wallet:", err3);

              const now = new Date().toISOString().replace("T", " ").slice(0, 19);
              db.run(
                `INSERT INTO blok_list (hash, id, date, usdt) VALUES (?, ?, ?, ?)`,
                [txId, userId, now, amount],
                (err4) => {
                  if (err4) return console.error("❌ Erreur INSERT blok_list:", err4);
                  db.run(`UPDATE deposits SET status = 'done' WHERE hash = ?`, [txId]);
                  console.log(`✅ Dépôt confirmé: ${txId}, user ${userId}, +${amount} USDT`);
                }
              );
            });
          });
        });
      } catch (err) {
        console.error(`❌ Erreur vérification dépôt ${txId}:`, err.message);
      }
    }
  });
};

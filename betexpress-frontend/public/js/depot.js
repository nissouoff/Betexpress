// === CONFIG ===
const API_URL = "http://localhost:3001";

// === Formulaire dépôt ===
document.getElementById('depositForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const txId = document.getElementById('txId').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const userId = localStorage.getItem("userId"); // 🔑 récupérer l'ID user

    if (!txId || amount < 1 || !userId) {
        alert('Veuillez remplir correctement le formulaire (montant min 1 USDT et utilisateur valide).');
        return;
    }

    const resultDiv = document.getElementById('result');
    resultDiv.classList.remove('hidden', 'success', 'error');
    resultDiv.innerHTML = '<p>Enregistrement de votre demande de dépôt...</p>';

    try {
        // ✅ Envoyer la demande au backend (table deposits)
        const response = await fetch(`${API_URL}/create-deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txId, amount, userId })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            resultDiv.classList.add('error');
            resultDiv.innerHTML = `<p>❌ Erreur: ${data.message}</p>`;
            return;
        }

        // ✅ Création overlay avec compte à rebours
        const overlay = document.createElement('div');
        overlay.id = 'depositOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.75)';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.color = '#fff';
        overlay.style.fontSize = '1.2rem';
        overlay.style.zIndex = '99999';

        let countdown = 5;
        overlay.innerHTML = `
          <p>✅ Dépôt enregistré avec succès !<br>
          Votre transaction sera vérifiée automatiquement.<br>
          Redirection vers l'accueil dans <span id="countdown">${countdown}</span> secondes...</p>
        `;

        document.body.appendChild(overlay);

        // 🔄 Compte à rebours
        const interval = setInterval(() => {
            countdown--;
            document.getElementById('countdown').textContent = countdown;
            if (countdown <= 0) {
                clearInterval(interval);
                overlay.remove();
                window.location.href = 'home.html'; // redirection
            }
        }, 1000);

        // Réinitialiser formulaire
        document.getElementById('depositForm').reset();

        // Rafraîchir solde (après 30s)
        setTimeout(fetchSolde, 35000);

    } catch (error) {
        console.error('Erreur frontend:', error);
        resultDiv.classList.add('error');
        resultDiv.innerHTML = `<p>❌ Erreur de connexion: ${error.message}</p>`;
    }
});

// === Copier adresse au clic ===
const add = document.getElementById("add");
add.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(add.textContent.trim());

        const toast = document.createElement("div");
        toast.textContent = "✅ Copié dans le presse-papiers";
        toast.style.position = "fixed";
        toast.style.bottom = "25px";
        toast.style.left = "50%";
        toast.style.transform = "translateX(-50%)";
        toast.style.background = "rgba(40, 167, 69, 0.9)";
        toast.style.color = "#fff";
        toast.style.padding = "12px 20px";
        toast.style.borderRadius = "10px";
        toast.style.fontSize = "0.9rem";
        toast.style.fontWeight = "bold";
        toast.style.zIndex = "9999";
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.4s ease, transform 0.4s ease";

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateX(-50%) translateY(-10px)";
        });

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(-50%) translateY(0)";
            setTimeout(() => toast.remove(), 400);
        }, 2000);

    } catch (err) {
        console.error("Erreur de copie : ", err);
    }
});

// === Mettre à jour solde ===
function updateSolde(solde){
    const soldeEl = document.getElementById("walletBalance");
    if(soldeEl) soldeEl.textContent = `${solde} USDT`;
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

// Charger solde au démarrage
document.addEventListener("DOMContentLoaded", () => {
    fetchSolde();
});

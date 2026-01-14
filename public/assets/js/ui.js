/**
 * UI.JS - Gestione Interfaccia Globale e Comunicazione API
 * Versione: 2.1.0 (Ottimizzata per Node.js + SQLite)
 */

// Inizializzazione al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
    // Inserisce automaticamente la Navbar se esiste l'elemento header
    injectNavbar();
    
    // Inizializza le icone Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

/**
 * Funzione universale per chiamare le API del server
 * Gestisce automaticamente la sessione e gli errori di formato
 */
async function apiFetch(endpoint, options = {}) {
    // Forza l'invio dei cookie di sessione
    options.credentials = 'include';
    
    // Se stiamo inviando dati, impostiamo l'header JSON
    if (options.body && !options.headers) {
        options.headers = { 'Content-Type': 'application/json' };
    }

    try {
        const response = await fetch(`${CONFIG.SCRIPT_URL}${endpoint}`, options);

        // 1. Gestione Accesso Negato (Sessione scaduta)
        if (response.status === 401) {
            console.warn("Sessione scaduta o non valida. Reindirizzamento al login.");
            localStorage.clear();
            window.location.href = 'login.html';
            return null;
        }

        // 2. Controllo se la risposta è valida (non HTML di errore)
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType || !contentType.includes("application/json")) {
            const errorText = await response.text();
            console.error("Il server ha restituito un errore non JSON:", errorText);
            // Non mostriamo l'alert qui per evitare spam, lo gestirà la funzione chiamante
            return null;
        }

        // 3. Parsing del JSON
        return await response.json();

    } catch (error) {
        console.error("Errore critico di rete o connessione:", error);
        alert("Impossibile connettersi al server. Verifica che 'server.js' sia attivo.");
        return null;
    }
}

/**
 * Crea e inietta la Navbar professionale in tutte le pagine
 */
function injectNavbar() {
    const header = document.getElementById('main-header');
    if (!header) return;

    const userName = localStorage.getItem('userName') || 'Utente';

    header.innerHTML = `
        <div class="navbar bg-white shadow-xl rounded-2xl mb-6 border border-gray-100">
            <div class="flex-1">
                <a href="index.html" class="btn btn-ghost normal-case text-xl font-black italic tracking-tighter">
                    <span class="text-primary">GESTIONALE</span> PRO
                </a>
            </div>
            <div class="flex-none gap-4 px-4">
                <div class="hidden md:flex flex-col items-end">
                    <span class="text-[10px] font-bold uppercase text-gray-400">Operatore</span>
                    <span class="text-sm font-black text-gray-800 uppercase italic">${userName}</span>
                </div>
                <div class="divider divider-horizontal m-0 opacity-10"></div>
                <button onclick="handleLogout()" class="btn btn-error btn-outline btn-sm rounded-xl gap-2 font-bold uppercase text-[10px]">
                    <i data-lucide="log-out" class="w-4 h-4"></i>
                    Esci
                </button>
            </div>
        </div>
    `;

    // Re-inizializza le icone Lucide dentro la navbar
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Gestisce il logout pulendo sessione server e cache browser
 */
async function handleLogout() {
    if (!confirm("Confermi l'uscita dal sistema?")) return;

    try {
        // Avvisa il server del logout
        await fetch(`${CONFIG.SCRIPT_URL}/logout`, { 
            method: 'POST', 
            credentials: 'include' 
        });
    } catch (e) {
        console.error("Errore logout server side");
    }

    // Pulisce tutto e torna al login
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('login.html');
}

/**
 * Formattazione Date (Utility opzionale)
 */
function formatDate(dateStr) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT');
}
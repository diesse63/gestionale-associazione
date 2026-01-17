document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = window.location.pathname.includes('login.html');
    
    // MODIFICA: Uso sessionStorage invece di localStorage per coerenza con il Login
    const user = sessionStorage.getItem('userName');

    // Se non sei loggato e non sei sulla pagina di login, vai al login
    if (!user && !isLoginPage) {
        window.location.href = 'login.html';
        return;
    }

    injectNavbar();
    if (typeof lucide !== 'undefined') lucide.createIcons();
});

async function apiFetch(endpoint, options = {}) {
    options.credentials = 'include';
    if (options.body && !options.headers) options.headers = { 'Content-Type': 'application/json' };

    try {
        // Usa CONFIG.SCRIPT_URL (che è vuoto) + endpoint (che inizia con /api/...)
        const response = await fetch(`${CONFIG.SCRIPT_URL}${endpoint}`, options);
        
        if (response.status === 401) {
            sessionStorage.clear(); // Pulisce la sessione corretta
            window.location.href = 'login.html';
            return null;
        }
        return response.ok ? await response.json() : null;
    } catch (error) {
        console.error("Errore di connessione API:", error);
        return null;
    }
}

function injectNavbar() {
    const header = document.getElementById('main-header');
    if (!header || window.location.pathname.includes('login.html')) return;

    // Recupera il nome utente dalla sessione
    const userName = sessionStorage.getItem('userName') || 'Utente';

    header.innerHTML = `
        <div class="navbar bg-white shadow-xl rounded-2xl mb-6 border border-gray-100">
            <div class="flex-1 px-4"><a href="/" class="btn btn-ghost text-xl font-black italic">GESTIONALE PRO</a></div>
            <div class="flex-none gap-4 px-4">
                <span class="text-sm font-black uppercase italic">${userName}</span>
                <button onclick="handleLogout()" class="btn btn-error btn-outline btn-sm rounded-xl uppercase text-[10px]">Esci</button>
            </div>
        </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handleLogout() {
    if (!confirm("Uscire?")) return;
    
    try {
        // Chiama il logout sul server
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
        console.error("Errore logout server:", e);
    }

    // Pulisce la sessione locale
    sessionStorage.clear();
    window.location.replace('login.html');
}
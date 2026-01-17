// public/assets/js/auth.js

(function checkAuth() {
    // 1. Controlla se abbiamo il token nel browser
    const isLogged = sessionStorage.getItem('userRole');
    
    // 2. Ottieni il nome del file corrente
    const path = window.location.pathname; 
    const page = path.split("/").pop(); // es: "login.html" o "" (se è la root)

    // 3. Pagine che NON richiedono controllo (solo login)
    if (path.includes("login.html")) {
        return; // Esci, qui non dobbiamo fare nulla
    }

    // 4. Se NON siamo loggati, reindirizza al login
    if (!isLogged) {
        window.location.href = "/login.html";
    }

    // Se siamo arrivati qui, l'utente è loggato e può vedere la pagina.
})();

function logout() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => {
            sessionStorage.clear(); // Pulisce lato client
            window.location.href = "/login.html";
        })
        .catch(err => {
            console.error(err);
            // Fallback in caso di errore
            sessionStorage.clear();
            window.location.href = "/login.html";
        });
}
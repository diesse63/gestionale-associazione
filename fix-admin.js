const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('./database.db');

const email = "admin@test.it";
const pass = "password123"; 
const hash = bcrypt.hashSync(pass, 10);

db.serialize(() => {
    // Rimuove vecchi tentativi e crea l'utente pulito
    db.run("DELETE FROM Utenti WHERE Email = ?", [email]);
    db.run("INSERT INTO Utenti (Email, Password, Nome) VALUES (?, ?, ?)", 
           [email, hash, "Amministratore"], (err) => {
        if (err) {
            console.error("Errore:", err.message);
        } else {
            console.log("\n===========================================");
            console.log("UTENTE CONFIGURATO CON SUCCESSO!");
            console.log("Email: " + email);
            console.log("Password: " + pass);
            console.log("===========================================\n");
        }
        db.close();
    });
});
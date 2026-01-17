const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'database.db');
const db = new sqlite3.Database(dbPath);

const newUser = "uno";
const newPass = "uno";
const hash = bcrypt.hashSync(newPass, 10);

db.serialize(() => {
    // Rimuoviamo eventuali utenti con lo stesso nome per evitare duplicati
    db.run("DELETE FROM Utenti WHERE Email = ?", [newUser]);
    
    // Inseriamo il nuovo utente "uno"
    db.run("INSERT INTO Utenti (Email, Password, Nome) VALUES (?, ?, ?)", 
           [newUser, hash, "Amministratore"], (err) => {
        if (err) {
            console.error("Errore nell'aggiornamento:", err.message);
        } else {
            console.log("\n===========================================");
            console.log("NUOVE CREDENZIALI IMPOSTATE!");
            console.log("Username: " + newUser);
            console.log("Password: " + newPass);
            console.log("===========================================\n");
        }
        db.close();
    });
});
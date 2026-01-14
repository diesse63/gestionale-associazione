const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('./database.db');

const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync("admin123", salt); // La tua password sarà admin123

db.run(`INSERT INTO Utenti (Email, Password, Nome) VALUES (?, ?, ?)`, 
       ["admin@test.it", hash, "Amministratore"], (err) => {
    if (err) console.log("L'utente esiste già o c'è un errore.");
    else console.log("UTENTE CREATO! Email: admin@test.it | Pass: admin123");
    db.close();
});

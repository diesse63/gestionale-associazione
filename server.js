const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const port = 3000;

const db = new sqlite3.Database('./database.db');

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(session({
    name: 'gestionale_sid',
    secret: 'super-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

const checkAuth = (req, res, next) => {
    if (req.session && req.session.userId) next();
    else res.status(401).json({ error: "Non autorizzato" });
};

// AUTH
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM Utenti WHERE Email = ?", [email], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.Password)) return res.status(401).json({ success: false });
        req.session.userId = user.Email;
        req.session.userName = user.Nome;
        res.json({ success: true, nome: user.Nome });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => { res.clearCookie('gestionale_sid'); res.json({ success: true }); });
});

// ANAGRAFICA
app.get('/api/associazioni', checkAuth, (req, res) => {
    const sql = `
        SELECT a.*,
            (SELECT GROUP_CONCAT(ID || '::' || Nome, '|') FROM Referenti WHERE ID_Associazione = a.ID) as RawRef,
            (SELECT GROUP_CONCAT(ID || '::' || Nome, '|') FROM AltriSoggetti WHERE ID_Associazione = a.ID) as RawAlt
        FROM Associazioni a ORDER BY a.SOGGETTO ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const data = rows.map(row => ({
            ...row,
            REFERENTI_COLLEGATI: row.RawRef ? row.RawRef.split('|').map(s => { const p = s.split('::'); return { ID: p[0], Nome: p[1] }; }) : [],
            ALTRI_SOGGETTI_COLLEGATI: row.RawAlt ? row.RawAlt.split('|').map(s => { const p = s.split('::'); return { ID: p[0], Nome: p[1] }; }) : []
        }));
        res.json(data);
    });
});

app.post('/api/associazioni', checkAuth, (req, res) => {
    const { SOGGETTO, MAIL, PEC, TAVOLO, DIRETTIVO_DELEGAZIONE } = req.body;
    db.run(`INSERT INTO Associazioni (SOGGETTO, MAIL, PEC, TAVOLO, DIRETTIVO_DELEGAZIONE) VALUES (?,?,?,?,?)`, [SOGGETTO, MAIL, PEC, TAVOLO, DIRETTIVO_DELEGAZIONE], function(err) {
        res.json({ success: !err, id: this.lastID });
    });
});

app.put('/api/associazioni/:id', checkAuth, (req, res) => {
    const { SOGGETTO, MAIL, PEC, TAVOLO, DIRETTIVO_DELEGAZIONE } = req.body;
    db.run(`UPDATE Associazioni SET SOGGETTO=?, MAIL=?, PEC=?, TAVOLO=?, DIRETTIVO_DELEGAZIONE=? WHERE ID=?`, [SOGGETTO, MAIL, PEC, TAVOLO, DIRETTIVO_DELEGAZIONE, req.params.id], () => res.json({ success: true }));
});

app.delete('/api/associazioni/:id', checkAuth, (req, res) => {
    db.run(`DELETE FROM Associazioni WHERE ID = ?`, req.params.id, () => res.json({ success: true }));
});

// REFERENTI (CRUD)
app.post('/api/referenti', checkAuth, (req, res) => {
    db.run(`INSERT INTO Referenti (ID_Associazione, Nome) VALUES (?, ?)`, [req.body.ID_Associazione, req.body.Nome], function() { res.json({ success: true, id: this.lastID }); });
});
app.put('/api/referenti/:id', checkAuth, (req, res) => {
    db.run(`UPDATE Referenti SET Nome = ? WHERE ID = ?`, [req.body.Nome, req.params.id], () => res.json({ success: true }));
});
app.delete('/api/referenti/:id', checkAuth, (req, res) => {
    db.run(`DELETE FROM Referenti WHERE ID = ?`, req.params.id, () => res.json({ success: true }));
});

// ALTRI SOGGETTI (CRUD)
app.post('/api/altri-soggetti', checkAuth, (req, res) => {
    db.run(`INSERT INTO AltriSoggetti (ID_Associazione, Nome) VALUES (?, ?)`, [req.body.ID_Associazione, req.body.Nome], function() { res.json({ success: true, id: this.lastID }); });
});
app.put('/api/altri-soggetti/:id', checkAuth, (req, res) => {
    db.run(`UPDATE AltriSoggetti SET Nome = ? WHERE ID = ?`, [req.body.Nome, req.params.id], () => res.json({ success: true }));
});
app.delete('/api/altri-soggetti/:id', checkAuth, (req, res) => {
    db.run(`DELETE FROM AltriSoggetti WHERE ID = ?`, req.params.id, () => res.json({ success: true }));
});

app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

app.listen(port, () => console.log(`Server attivo su http://localhost:${port}`));
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx'); // Nuova dipendenza per Export Excel

const app = express();
const port = 3000;

// --- CONFIGURAZIONE PERCORSI ---
const dbPath = path.join(process.cwd(), 'database.db');
const publicPath = path.join(__dirname, 'public');
const uploadDir = path.join(process.cwd(), 'archivio_files');
const verbaliDir = path.join(uploadDir, 'verbali');
const documentiDir = path.join(uploadDir, 'documenti');

// Creazione cartelle
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(verbaliDir)) fs.mkdirSync(verbaliDir);
if (!fs.existsSync(documentiDir)) fs.mkdirSync(documentiDir);

// --- CONFIGURAZIONE UPLOAD (AGGIORNATA PER RINOMINA) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'verbale') cb(null, verbaliDir);
        else cb(null, documentiDir);
    },
    filename: function (req, file, cb) {
        // Recupera la data dal body. IMPORTANTE: Il frontend deve inviare 'Data' prima del file.
        let prefix = file.fieldname === 'verbale' ? 'ver' : 'doc';
        let datePart = '000000';

        if (req.body.Data) {
            // Formato input atteso: YYYY-MM-DD -> Trasformazione in DDMMYY
            const parts = req.body.Data.split('-'); // [YYYY, MM, DD]
            if (parts.length === 3) {
                datePart = `${parts[2]}${parts[1]}${parts[0].slice(-2)}`;
            }
        } else {
            // Fallback data corrente se non presente
            const d = new Date();
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = String(d.getFullYear()).slice(-2);
            datePart = `${day}${month}${year}`;
        }
        
        const ext = path.extname(file.originalname);
        // Aggiungo timestamp per univocità: verDDMMYY_timestamp.pdf
        cb(null, `${prefix}${datePart}_${Date.now()}${ext}`);
    }
});

const upload = multer({ storage: storage });
const uploadFields = upload.fields([
    { name: 'verbale', maxCount: 1 },
    { name: 'documenti', maxCount: 1 }
]);

// --- DATABASE SETUP ---
const db = new sqlite3.Database(dbPath, (err) => {
    if (!err) {
        db.run("PRAGMA foreign_keys = ON");
        console.log("Database collegato.");
        
        db.run(`CREATE TABLE IF NOT EXISTS "Agora" (
            "ID" INTEGER NOT NULL UNIQUE,
            "Data" TEXT NOT NULL,
            "Evento" TEXT,
            "ODG" TEXT,
            "Verbale" TEXT,
            "Documenti" TEXT,
            PRIMARY KEY("ID" AUTOINCREMENT)
        );`);

        db.run(`CREATE TABLE IF NOT EXISTS "AgoraPresenti" (
            "ID" INTEGER PRIMARY KEY AUTOINCREMENT,
            "IDRiunioni" INTEGER NOT NULL,
            "IDAssociazione" INTEGER NOT NULL,
            "Rappresentante" TEXT,
            FOREIGN KEY ("IDRiunioni") REFERENCES "Agora"("ID") ON DELETE CASCADE,
            FOREIGN KEY ("IDAssociazione") REFERENCES "Associazioni"("ID")
        );`);
    } else {
        console.error("Errore connessione DB:", err);
    }
});

// --- HELPER CANCELLAZIONE FILE ---
function deletePhysicalFile(webPath) {
    if (!webPath || webPath.trim() === "") return;
    try {
        const relativePath = webPath.startsWith('/') ? webPath.slice(1) : webPath;
        const fullPath = path.join(process.cwd(), relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    } catch (e) {
        console.error(`Errore eliminazione file ${webPath}:`, e);
    }
}

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));
app.use(session({
    name: 'gestionale_sid',
    secret: 'super-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

app.use('/archivio_files', express.static(uploadDir));

const checkAuth = (req, res, next) => {
    if (req.session && req.session.userId) next();
    else res.status(401).json({ error: "Unauthorized" });
};

// --- ROTTE PAGINE HTML ---
app.get('/login.html', (req, res) => {
    if (req.session.userId) return res.redirect('/'); 
    res.sendFile(path.join(publicPath, 'login.html'));
});

app.get('/', (req, res) => {
    if (!req.session.userId) return res.redirect('/login.html');
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/dashboard_servizi', (req, res) => {
    if (!req.session.userId) return res.redirect('/login.html');
    res.sendFile(path.join(publicPath, 'dashboard_servizi.html'));
});

app.get('/agora', (req, res) => {
    if (!req.session.userId) return res.redirect('/login.html');
    res.sendFile(path.join(publicPath, 'registro_agora.html'));
});

// --- API LOGIN ---
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM Utenti WHERE Email = ?", [email], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.Password)) {
            return res.status(401).json({ success: false });
        }
        req.session.userId = user.Email;
        req.session.userName = user.Nome;
        res.json({ success: true, nome: user.Nome });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => { 
        res.clearCookie('gestionale_sid'); 
        res.json({ success: true }); 
    });
});

// ================= API AGORA =================

app.get('/api/agora', checkAuth, (req, res) => {
    db.all("SELECT * FROM Agora ORDER BY Data DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/agora', checkAuth, uploadFields, (req, res) => {
    // Nota: Data, Evento, ODG sono disponibili qui se inviati prima dei file nel FormData
    const { Data, Evento, ODG } = req.body;
    
    // I nomi file sono già stati generati da Multer
    let verbalePath = req.files['verbale'] ? `/archivio_files/verbali/${req.files['verbale'][0].filename}` : "";
    let documentiPath = req.files['documenti'] ? `/archivio_files/documenti/${req.files['documenti'][0].filename}` : "";

    const sql = `INSERT INTO Agora (Data, Evento, ODG, Verbale, Documenti) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [Data, Evento, ODG, verbalePath, documentiPath], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/agora/:id', checkAuth, uploadFields, (req, res) => {
    const id = req.params.id;
    const { Data, Evento, ODG, deleteVerbale, deleteDocumenti } = req.body;

    db.get("SELECT Verbale, Documenti FROM Agora WHERE ID = ?", [id], (err, row) => {
        if(err || !row) return res.status(500).json({ error: "Evento non trovato" });

        let newVerbale = row.Verbale;
        let newDocumenti = row.Documenti;

        if (req.files['verbale']) {
            deletePhysicalFile(row.Verbale);
            newVerbale = `/archivio_files/verbali/${req.files['verbale'][0].filename}`;
        } else if (deleteVerbale === 'true') {
            deletePhysicalFile(row.Verbale);
            newVerbale = "";
        }

        if (req.files['documenti']) {
            deletePhysicalFile(row.Documenti);
            newDocumenti = `/archivio_files/documenti/${req.files['documenti'][0].filename}`;
        } else if (deleteDocumenti === 'true') {
            deletePhysicalFile(row.Documenti);
            newDocumenti = "";
        }

        const sql = `UPDATE Agora SET Data=?, Evento=?, ODG=?, Verbale=?, Documenti=? WHERE ID=?`;
        db.run(sql, [Data, Evento, ODG, newVerbale, newDocumenti, id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

app.delete('/api/agora/:id', checkAuth, (req, res) => {
    const id = req.params.id;
    db.get("SELECT Verbale, Documenti FROM Agora WHERE ID = ?", [id], (err, row) => {
        if (row) {
            deletePhysicalFile(row.Verbale);
            deletePhysicalFile(row.Documenti);
        }
        db.run(`DELETE FROM Agora WHERE ID = ?`, id, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// ================= API PRESENZE & SELECT =================

app.get('/api/agora/:id/presenti', checkAuth, (req, res) => {
    const sql = `
        SELECT 
            P.ID as IDRiga,
            P.IDAssociazione,
            A.SOGGETTO, 
            A.TAVOLO, 
            A.DIRETTIVO_DELEGAZIONE, 
            P.Rappresentante
        FROM AgoraPresenti P
        JOIN Associazioni A ON P.IDAssociazione = A.ID
        WHERE P.IDRiunioni = ?
    `;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/agora/presenti', checkAuth, (req, res) => {
    const { IDRiunioni, IDAssociazione, Rappresentante } = req.body;
    const sql = `INSERT INTO AgoraPresenti (IDRiunioni, IDAssociazione, Rappresentante) VALUES (?, ?, ?)`;
    db.run(sql, [IDRiunioni, IDAssociazione, Rappresentante], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/agora/presenti/:id', checkAuth, (req, res) => {
    db.run(`DELETE FROM AgoraPresenti WHERE ID = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// API: Recupera tutte le persone (Referenti + Altri Soggetti) con Associazione
app.get('/api/persone/tutti', checkAuth, (req, res) => {
    const sql = `
        SELECT r.Nome, 'Referente' as Tipo, r.ID_Associazione, a.SOGGETTO 
        FROM Referenti r 
        JOIN Associazioni a ON r.ID_Associazione = a.ID
        UNION ALL
        SELECT s.Nome, 'Altro Soggetto' as Tipo, s.ID_Associazione, a.SOGGETTO
        FROM AltriSoggetti s
        JOIN Associazioni a ON s.ID_Associazione = a.ID
        ORDER BY SOGGETTO ASC, Nome ASC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/associazioni/:id/persone', checkAuth, (req, res) => {
    const idAss = req.params.id;
    const sql = `
        SELECT Nome, 'Referente' as Tipo FROM Referenti WHERE ID_Associazione = ?
        UNION ALL
        SELECT Nome, 'Altro Soggetto' as Tipo FROM AltriSoggetti WHERE ID_Associazione = ?
    `;
    db.all(sql, [idAss, idAss], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ================= API MASTER DATA =================
app.get('/api/tipologie', checkAuth, (req, res) => {
    db.all("SELECT * FROM Tipologia ORDER BY Tipologia ASC", [], (err, rows) => res.json(rows || []));
});

app.get('/api/associazioni', checkAuth, (req, res) => {
    const sql = `SELECT a.*, t.Tipologia as Tipologia_Nome FROM Associazioni a LEFT JOIN Tipologia t ON a.ID_TIPOLOGIA = t.ID ORDER BY a.SOGGETTO ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ================= API BACKUP (NUOVE) =================

// 1. Download diretto del database
app.get('/api/backup/db', checkAuth, (req, res) => {
    res.download(dbPath, 'backup_database.db', (err) => {
        if (err) console.error("Errore download DB:", err);
    });
});

// 2. Export Excel di tutte le tabelle
app.get('/api/backup/excel', checkAuth, (req, res) => {
    // Ottiene la lista di tutte le tabelle
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err, tables) => {
        if (err) return res.status(500).json({ error: err.message });
        if (tables.length === 0) return res.status(404).json({ error: "Nessuna tabella trovata" });

        const wb = XLSX.utils.book_new();
        let tablesProcessed = 0;

        tables.forEach((tableObj) => {
            const tableName = tableObj.name;
            db.all(`SELECT * FROM "${tableName}"`, [], (err, rows) => {
                if (!err && rows) {
                    const ws = XLSX.utils.json_to_sheet(rows);
                    // Tronca il nome foglio a 31 char (limite Excel)
                    XLSX.utils.book_append_sheet(wb, ws, tableName.substring(0, 31));
                }
                
                tablesProcessed++;
                // Quando tutte le tabelle sono processate, invia il file
                if (tablesProcessed === tables.length) {
                    const fileName = `Backup_Dati_${Date.now()}.xlsx`;
                    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                    
                    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.send(buffer);
                }
            });
        });
    });
});

// --- FALLBACK ---
app.use(express.static(publicPath));
app.use((req, res) => {
    if (!req.session.userId) return res.redirect('/login.html');
    res.redirect('/');
});

app.listen(port, () => console.log(`Gestionale Pro attivo su http://localhost:${port}`));
// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// adatbázis fájl (ha nem létezik, létrehozza)
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// tábla létrehozása, ha még nincs
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )
    `, (err) => {
        if (err) console.error("Hiba a users tábla létrehozásánál:", err);
        else console.log("Users tábla ellenőrizve / létrehozva.");
    }); 
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error("Hiba a messages tábla létrehozásánál:", err);
        else console.log("Messages tábla ellenőrizve / létrehozva.");
    });
    db.run(`
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            author TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error("Hiba a posts tábla létrehozásánál:", err);
        else console.log("Posts tábla ellenőrizve / létrehozva.");
    });
});

module.exports = db;

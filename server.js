const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const db = require('./db');

function serveFile(relPath, contentType, res) {
    const fullPath = path.join(__dirname, relPath);

    fs.readFile(fullPath, (err, data) => {
        if (err) {
            console.error("Fájlhiba:", err);
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Szerver hiba, fájl nem olvasható: " + relPath);
            return;
        }
        res.writeHead(200, { "Content-Type": contentType + "; charset=utf-8" });
        res.end(data);
    });
}

const mimeTypes = {
    '.css': 'text/css',
    '.js': 'application/javascript'
};

const server = http.createServer((req, res) => {
    console.log("Kérés:", req.method, req.url);

    // ===== POST /login – adatbázisos bejelentkezés =====
    if (req.method === 'POST' && req.url === '/login') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const formData = querystring.parse(body);

            console.log("Bejelentkezési adatok:");
            console.log("Felhasználónév:", formData.username);
            console.log("Jelszó:", formData.password);

            const sql = `SELECT * FROM users WHERE username = ? AND password = ?`;

            db.get(sql, [formData.username, formData.password], (err, row) => {
                if (err) {
                    console.error("DB hiba login-nál:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Szerverhiba bejelentkezés közben.</h1>");
                    return;
                }

                if (!row) {
                    // nincs ilyen felhasználó vagy rossz jelszó
                    res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(`
                        <h1>Hibás felhasználónév vagy jelszó!</h1>
                        <p><a href="/login">Vissza a bejelentkezéshez</a></p>
                    `);
                    return;
                }

                // Sikeres belépés
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(`
                    <!DOCTYPE html>
                    <html lang="hu">
                    <head><meta charset="UTF-8"><title>Bejelentkezés</title></head>
                    <body>
                        <h1>Sikeres bejelentkezés!</h1>
                        <p>Üdv, ${row.username}!</p>
                        <p><a href="/">Vissza a főoldalra</a></p>
                    </body>
                    </html>
                `);
            });
        });
        return;
    }

    // ===== POST /register – adatbázisba mentés =====
    if (req.method === 'POST' && req.url === '/register') {
        let body = "";

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const formData = querystring.parse(body);

            console.log("Regisztrációs adatok:");
            console.log("Felhasználónév:", formData.username);
            console.log("Email:", formData.email);
            console.log("Jelszó:", formData.password);

            const sql = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;

            db.run(sql, [formData.username, formData.email, formData.password], function (err) {
                if (err) {
                    console.error("DB hiba regisztrációnál:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(`
                        <h1>Hiba történt a regisztráció során.</h1>
                        <p>${err.message}</p>
                        <p><a href="/register">Vissza a regisztrációhoz</a></p>
                    `);
                    return;
                }

                // sikeres beszúrás
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(`
                    <h1>Regisztráció sikeresen elmentve az adatbázisba!</h1>
                    <p>Felhasználónév: ${formData.username}</p>
                    <p><a href="/login">Tovább a bejelentkezéshez</a></p>
                `);
            });
        });

        return;
    }

    // ===== GET kérések =====
    if (req.method === 'GET') {
        // Főoldal
        if (req.url === "/" || req.url === "/index.html") {
            serveFile("views/index.html", "text/html", res);
            return;
        }

        // Rólunk
        if (req.url === '/about-us') {
            serveFile('views/about-us.html', 'text/html', res);
            return;
        }

        // Belépés oldal
        if (req.url === '/login') {
            serveFile('views/login.html', 'text/html', res);
            return;
        }

        // Regisztráció oldal
        if (req.url === '/register') {
            serveFile('views/register.html', 'text/html', res);
            return;
        }

        // Public statikus fájlok (pl. CSS)
        if (req.url.startsWith('/public/')) {
            const relPath = req.url.slice(1); // "public/style.css"
            const ext = path.extname(relPath);
            const ct = mimeTypes[ext] || 'application/octet-stream';
            serveFile(relPath, ct, res);
            return;
        }

        // JS fájlok (pl. /src/systempage/menu.js)
        if (req.url.endsWith(".js")) {
            // fontos: . + req.url → ./src/systempage/menu.js
            serveFile("." + req.url, "application/javascript", res);
            return;
        }

        // favicon – csak elnyeljük, hogy ne legyen hiba
        if (req.url === "/favicon.ico") {
            res.writeHead(204);
            res.end();
            return;
        }

        // minden másra: 404
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 - Nincs ilyen erőforrás: " + req.url);
        return;
    }

    // ha nem GET és nem POST
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("405 - Nem támogatott HTTP metódus");
});

server.listen(3000, () => {
    console.log("Szerver fut: http://localhost:3000");
});

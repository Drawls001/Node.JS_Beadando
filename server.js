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

function requireLogin(req, res) {
    const token = getCookie(req, "authToken");
    if (token !== "loggedin") {
        res.writeHead(302, { "Location": "/login" });
        res.end();
        return false;
    }
    return true;
}

function requireAdmin(req, res) {
    if (!requireLogin(req, res)) return false;
    const role = getCookie(req, "userRole");
    if (role !== "admin") {
        res.writeHead(302, { "Location": "/login" });
        res.end();
        return false;
    }
    return true;
}

function getCookie(req, name) {
    const cookie = req.headers.cookie || "";
    const pairs = cookie.split(";").map(c => c.trim().split("="));
    const dict = Object.fromEntries(pairs.filter(p => p[0]));
    return dict[name];
}

function renderPage(title, innerHtml) {
    return `
        <!DOCTYPE html>
        <html lang="hu">
        <head id="hd">
            <meta charset="UTF-8">
            <title>${title}</title>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg bg-body-tertiary">
                <div class="container-fluid">
                    <div id="menulist"></div>
                </div>
            </nav>

            <div class="container mt-4">
                ${innerHtml}
            </div>

            <script src="/src/systempage/menu.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
    `;
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
 
                const role = row.role === 'admin' ? 'admin' : 'user';
                const safeUsername = encodeURIComponent(row.username);

                // Sikeres belépés
                res.writeHead(302, {
                    "Set-Cookie": [
                        `authToken=loggedin; Path=/`,
                        `userRole=${role}; Path=/`,
                        `username=${safeUsername}; Path=/`
                    ],
                    "Location": "/dashboard"
                });
                res.end();
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

    // ===== POST /contact – kapcsolat űrlap mentése =====
    if (req.method === 'POST' && req.url === '/contact') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const formData = querystring.parse(body);

            console.log("Kapcsolat üzenet:");
            console.log("Név:", formData.name);
            console.log("Email:", formData.email);
            console.log("Üzenet:", formData.message);

            const sql = `INSERT INTO messages (name, email, message) VALUES (?, ?, ?)`;

            db.run(sql, [formData.name, formData.email, formData.message], function (err) {
                if (err) {
                    console.error("DB hiba contact-nál:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(`
                        <h1>Hiba történt az üzenet mentése során.</h1>
                        <p><a href="/contact">Vissza a kapcsolat oldalra</a></p>
                    `);
                    return;
                }

                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(`
                    <!DOCTYPE html>
                    <html lang="hu">
                    <head><meta charset="UTF-8"><title>Üzenet elküldve</title></head>
                    <body>
                        <h1>Köszönjük az üzenetet!</h1>
                        <p>Hamarosan felvesszük veled a kapcsolatot.</p>
                        <p><a href="/contact">Vissza a kapcsolat oldalra</a></p>
                    </body>
                    </html>
                `);
            });
        });

        return;
    }

    // ===== POST /admin/posts – új bejegyzés mentése =====
    if (req.method === 'POST' && req.url === '/admin/posts') {

        const cookie = req.headers.cookie || "";
        if (!cookie.includes("authToken=loggedin") || !cookie.includes("userRole=admin")) {
            res.writeHead(302, { "Location": "/login" });
            res.end();
            return;
        }

        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const formData = querystring.parse(body);

            const sql = `INSERT INTO posts (title, content, author) VALUES (?, ?, ?)`;

            const rawUsername = getCookie(req, "username");
            const author = rawUsername ? decodeURIComponent(rawUsername) : "Ismeretlen";

            db.run(sql, [formData.title, formData.content, author], function (err) {
                if (err) {
                    console.error("DB hiba /admin/posts mentésnél:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Hiba történt a bejegyzés mentésekor.</h1>");
                    return;
                }

                res.writeHead(302, { "Location": "/admin/posts" });
                res.end();
            });
        });

        return;
    }

    // ===== POST /admin/update-posts – Bejegyzés frissítése =====
    if (req.method === 'POST' && req.url.startsWith('/admin/update-post')) {

        const cookie = req.headers.cookie || "";
        if (!cookie.includes("authToken=loggedin") || !cookie.includes("userRole=admin")) {
            res.writeHead(302, { "Location": "/login" });
            res.end();
            return;
        }

        const urlObj = new URL(req.url, 'http://localhost');
        const id = urlObj.searchParams.get('id');

        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const formData = querystring.parse(body);

            const sql = `UPDATE posts SET title = ?, content = ?, author = ? WHERE id = ?`;

            db.run(sql, [formData.title, formData.content, formData.author || null, id], (err) => {
                if (err) {
                    console.error("DB hiba update-nél:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Hiba történt a bejegyzés módosításakor.</h1>");
                    return;
                }

                res.writeHead(302, { "Location": "/admin/posts" });
                res.end();
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

        // Dashboard oldal
        if (req.url === '/dashboard') {

            if (!requireLogin(req, res)) return;

            const sql = `
                SELECT 
                    (SELECT COUNT(*) FROM users) AS userCount,
                    (SELECT username FROM users ORDER BY rowid DESC LIMIT 1) AS lastUser,
                    (SELECT COUNT(*) FROM messages) AS msgCount,
                    (SELECT title FROM posts ORDER BY created_at DESC LIMIT 1) AS lastPostTitle
            `;

            db.get(sql, [], (err, row) => {
                if (err) {
                    console.error("DB hiba Dashboard-nál:", err.message);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Szerverhiba a statisztika lekérésénél.</h1>");
                    return;
                }

                const userCount     = row.userCount;
                const lastUser      = row.lastUser || "Nincs még regisztrált felhasználó";
                const msgCount      = row.msgCount;
                const lastPostTitle = row.lastPostTitle || "Még nincs bejegyzés";

                const content = `
                    <h1 class="mb-4">Dashboard</h1>
                    <p class="text-muted mb-4">
                        Gyors áttekintés az alkalmazás adatairól
                    </p>

                    <div class="row g-3 mb-4">
                        <div class="col-md-3">
                            <div class="card shadow-sm h-100">
                                <div class="card-body d-flex flex-column justify-content-between">
                                    <h5 class="card-title">Felhasználók</h5>
                                    <p class="card-text fs-3 fw-bold">${userCount}</p>
                                    <p class="text-muted small">Regisztrált felhasználók száma</p>
                                </div>
                            </div>
                        </div>

                        <div class="col-md-3">
                            <div class="card shadow-sm h-100">
                                <div class="card-body d-flex flex-column justify-content-between">
                                    <h5 class="card-title">Legutóbbi regisztrált felhasználó</h5>
                                    <p class="card-text fs-6 fw-bold">${lastUser}</p>
                                    <p class="text-muted small">Legfrissebb regisztráció</p>
                                </div>
                            </div>
                        </div>

                        <div class="col-md-3">
                            <div class="card shadow-sm h-100">
                                <div class="card-body d-flex flex-column justify-content-between">
                                    <h5 class="card-title">Üzenetek</h5>
                                    <p class="card-text fs-3 fw-bold">${msgCount}</p>
                                    <p class="text-muted small">Kapott üzenetek száma</p>
                                </div>
                            </div>
                        </div>

                        <div class="col-md-3">
                            <div class="card shadow-sm h-100">
                                <div class="card-body d-flex flex-column justify-content-between">
                                    <h5 class="card-title">Legutóbbi bejegyzés</h5>
                                    <p class="card-text fs-6 fw-bold">${lastPostTitle}</p>
                                    <p class="text-muted small">Hírek modul legutóbbi címe</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const html = renderPage("Dashboard", content);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(html);
            });

            return;
        }

        // Admin oldal
        if (req.url === '/admin') {

            if (!requireAdmin(req, res)) return;

            const content = `
                <h1 class="mb-4">Admin Kezelőközpont</h1>
                <p class="text-muted mb-4">Válassz műveletet:</p>

                <div class="row g-4">
                    <div class="col-md-4">
                        <div class="card shadow-sm h-100">
                            <div class="card-body text-center">
                                <h5 class="card-title">Felhasználók kezelése</h5>
                                <p class="card-text">Felhasználók listázása, törlése, admin jog állítása.</p>
                                <a href="/admin/users" class="btn btn-primary">Megnyitás</a>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="card shadow-sm h-100">
                            <div class="card-body text-center">
                                <h5 class="card-title">Kapcsolat üzenetek</h5>
                                <p class="card-text">Kapcsolat űrlapról érkező üzenetek kezelése.</p>
                                <a href="/admin/messages" class="btn btn-primary">Megnyitás</a>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="card shadow-sm h-100">
                            <div class="card-body text-center">
                                <h5 class="card-title">Hírek / bejegyzések</h5>
                                <p class="card-text">Hírek létrehozása, szerkesztése és törlése.</p>
                                <a href="/admin/posts" class="btn btn-primary">Megnyitás</a>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const html = renderPage("Admin", content);
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(html);
            return;
        }

        // Admin – Felhasználók listázása
        if (req.url === '/admin/users') {

            if (!requireAdmin(req, res)) return;

            const sql = `SELECT username, email, role FROM users ORDER BY username`;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error("DB hiba admin/users-nél:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Szerverhiba a felhasználók lekérésekor.</h1>");
                    return;
                }

                let tableRows = "";

                rows.forEach((row, index) => {
                    const role = row.role || 'user';
                    let actions = "";

                    if (role !== 'admin') {
                        actions += `
                            <a class="btn btn-sm btn-success me-1"
                               href="/admin/make-admin?username=${encodeURIComponent(row.username)}"
                               onclick="return confirm('Biztosan adminná teszed: ${row.username}?');">
                               Adminná tesz
                            </a>
                        `;
                    } else {
                        actions += `
                            <a class="btn btn-sm btn-warning me-1"
                               href="/admin/remove-admin?username=${encodeURIComponent(row.username)}"
                               onclick="return confirm('Biztosan elveszed az admin jogot: ${row.username}?');">
                               Admin jog elvétele
                            </a>
                        `;
                    }

                    actions += `
                        <a class="btn btn-sm btn-danger"
                           href="/admin/delete-user?username=${encodeURIComponent(row.username)}"
                           onclick="return confirm('Biztosan törlöd: ${row.username}?');">
                           Törlés
                        </a>
                    `;

                    tableRows += `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${row.username}</td>
                            <td>${row.email ?? ""}</td>
                            <td>${role}</td>
                            <td>${actions}</td>
                        </tr>
                    `;
                });

                const content = `
                    <h1 class="mb-3">Felhasználók kezelése</h1>
                    <p class="text-muted">Regisztrált felhasználók listája</p>

                    <p>
                        <a class="btn btn-outline-secondary btn-sm" href="/admin">Vissza</a>
                    </p>

                    <div class="table-responsive mt-3">
                        <table class="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Felhasználónév</th>
                                    <th>E-mail</th>
                                    <th>Szerepkör</th>
                                    <th>Művelet</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                `;

                const html = renderPage("Admin – Felhasználók", content);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(html);
            });

            return;
        }

        // Admin – Felhasználó adminná tétele
        if (req.url.startsWith('/admin/make-admin')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const username = urlObj.searchParams.get('username');

            if (!username) {
                res.writeHead(302, { "Location": "/admin/users" });
                res.end();
                return;
            }

            const sql = `UPDATE users SET role = 'admin' WHERE username = ?`;

            db.run(sql, [username], function (err) {
                if (err) {
                    console.error("DB hiba adminná tételnél:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Hiba történt a felhasználó módosítása közben.</h1>");
                    return;
                }

                res.writeHead(302, { "Location": "/admin/users" });
                res.end();
            });

            return;
        }

        // Admin – Admin jog elvétele
        if (req.url.startsWith('/admin/remove-admin')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const username = urlObj.searchParams.get('username');

            if (!username) {
                res.writeHead(302, { "Location": "/admin/users" });
                res.end();
                return;
            }

            const sql = `UPDATE users SET role = 'user' WHERE username = ?`;

            db.run(sql, [username], function (err) {
                if (err) {
                    console.error("DB hiba admin jog elvételénél:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Hiba történt a felhasználó módosítása közben.</h1>");
                    return;
                }

                res.writeHead(302, { "Location": "/admin/users" });
                res.end();
            });

            return;
        }

        // Admin – Felhasználó törlése
        if (req.url.startsWith('/admin/delete-user')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const username = urlObj.searchParams.get('username');

            if (!username) {
                res.writeHead(302, { "Location": "/admin" });
                res.end();
                return;
            }

            const selectSql = `SELECT role FROM users WHERE username = ?`;

            db.get(selectSql, [username], (err, row) => {
                if (err) {
                    console.error("DB hiba szerep lekérdezésnél:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Hiba történt a felhasználó törlése közben.</h1>");
                    return;
                }

                if (!row) {
                    res.writeHead(302, { "Location": "/admin" });
                    res.end();
                    return;
                }

                if (row.role === 'admin') {
                    res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(`
                        <h1>Admin felhasználó nem törölhető!</h1>
                        <p><a href="/admin">Vissza az admin felületre</a></p>
                    `);
                    return;
                }

                const deleteSql = `DELETE FROM users WHERE username = ?`;

                db.run(deleteSql, [username], function (err2) {
                    if (err2) {
                        console.error("DB hiba törlésnél:", err2);
                        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                        res.end("<h1>Hiba történt a felhasználó törlése közben.</h1>");
                        return;
                    }

                    res.writeHead(302, { "Location": "/admin/users" });
                    res.end();
                });
            });

            return;
        }

        // Admin – Üzenetek listázása
        if (req.url === '/admin/messages') {

            if (!requireAdmin(req, res)) return;

            const sql = `SELECT id, name, email, message, created_at FROM messages ORDER BY created_at DESC`;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error("DB hiba admin/messages-nél:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Szerverhiba az üzenetek lekérésekor.</h1>");
                    return;
                }

                let tableRows = "";

                rows.forEach((row, index) => {
                    tableRows += `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${row.name || ""}</td>
                            <td>${row.email || ""}</td>
                            <td>${row.message || ""}</td>
                            <td>${row.created_at || ""}</td>
                            <td>
                                <a class="btn btn-sm btn-danger"
                                   href="/admin/delete-message?id=${row.id}"
                                   onclick="return confirm('Biztosan törlöd ezt az üzenetet?');">
                                   Törlés
                                </a>
                            </td>
                        </tr>
                    `;
                });

                const content = `
                    <h1 class="mb-3">Kapcsolat üzenetek</h1>
                    <p class="text-muted">Az űrlapról érkező üzenetek listája.</p>

                    <p>
                        <a class="btn btn-outline-secondary btn-sm" href="/admin">Vissza</a>
                    </p>

                    <div class="table-responsive mt-3">
                        <table class="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Név</th>
                                    <th>E-mail</th>
                                    <th>Üzenet</th>
                                    <th>Dátum</th>
                                    <th>Művelet</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows || `
                                    <tr>
                                        <td colspan="6" class="text-center text-muted">
                                            Még nincs egyetlen üzenet sem.
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                `;

                const html = renderPage("Admin – Üzenetek", content);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(html);
            });

            return;
        }

        // Admin – Üzenet törlése
        if (req.url.startsWith('/admin/delete-message')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const id = urlObj.searchParams.get('id');

            if (!id) {
                res.writeHead(302, { "Location": "/admin/messages" });
                res.end();
                return;
            }

            const sql = `DELETE FROM messages WHERE id = ?`;

            db.run(sql, [id], function (err) {
                if (err) {
                    console.error("DB hiba üzenet törlésnél:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Hiba történt az üzenet törlése közben.</h1>");
                    return;
                }

                res.writeHead(302, { "Location": "/admin/messages" });
                res.end();
            });

            return;
        }

        // Admin – Bejegyzések listázása + új felvitel
        if (req.url === '/admin/posts') {

            if (!requireAdmin(req, res)) return;

            const sql = `SELECT id, title, content, author, created_at FROM posts ORDER BY created_at DESC`;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error("DB hiba admin/posts-nál:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Szerverhiba a bejegyzések lekérésekor.</h1>");
                    return;
                }

                let tableRows = "";

                rows.forEach((row, index) => {
                    tableRows += `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${row.title}</td>
                            <td>${row.author || ""}</td>
                            <td>${row.created_at || ""}</td>
                            <td>
                                <a class="btn btn-sm btn-warning me-1"
                                   href="/admin/edit-post?id=${row.id}">
                                   Szerkesztés
                                </a>
                                <a class="btn btn-sm btn-danger"
                                   href="/admin/delete-post?id=${row.id}"
                                   onclick="return confirm('Biztosan törlöd ezt a bejegyzést?');">
                                   Törlés
                                </a>
                            </td>
                        </tr>
                    `;
                });

                const content = `
                    <h1 class="mb-3">Bejegyzések kezelése</h1>
                    <p class="text-muted">Új hírek felvétele, meglévők törlése.</p>

                    <p>
                        <a class="btn btn-outline-secondary btn-sm" href="/admin">Vissza</a>
                    </p>

                    <h4 class="mt-3">Új bejegyzés</h4>
                    <form action="/admin/posts" method="POST" class="mb-4">
                        <div class="mb-3">
                            <label class="form-label" for="title">Cím</label>
                            <input class="form-control" type="text" id="title" name="title" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label" for="content">Tartalom</label>
                            <textarea class="form-control" id="content" name="content" rows="4" required></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary">Bejegyzés mentése</button>
                    </form>

                    <h4>Meglévő bejegyzések</h4>
                    <div class="table-responsive mt-2">
                        <table class="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Cím</th>
                                    <th>Szerző</th>
                                    <th>Dátum</th>
                                    <th>Művelet</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows || `
                                    <tr>
                                        <td colspan="5" class="text-center text-muted">
                                            Még nincs egyetlen bejegyzés sem.
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                `;

                const html = renderPage("Admin – Bejegyzések", content);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(html);
            });

            return;
        }

        // Admin – Bejegyzés törlése
        if (req.url.startsWith('/admin/delete-post')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const id = urlObj.searchParams.get('id');

            if (!id) {
                res.writeHead(302, { "Location": "/admin/posts" });
                res.end();
                return;
            }

            const sql = `DELETE FROM posts WHERE id = ?`;

            db.run(sql, [id], function (err) {
                if (err) {
                    console.error("DB hiba bejegyzés törlésnél:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Hiba történt a bejegyzés törlésekor.</h1>");
                    return;
                }

                res.writeHead(302, { "Location": "/admin/posts" });
                res.end();
            });

            return;
        }

        // Admin – Bejegyzés szerkesztő űrlap
        if (req.url.startsWith('/admin/edit-post')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const id = urlObj.searchParams.get('id');

            const sql = `SELECT * FROM posts WHERE id = ?`;

            db.get(sql, [id], (err, row) => {
                if (err || !row) {
                    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Bejegyzés nem található</h1>");
                    return;
                }

                const content = `
                    <h1>Bejegyzés szerkesztése</h1>

                    <form action="/admin/update-post?id=${row.id}" method="POST" class="mt-3">
                        <div class="mb-3">
                            <label class="form-label">Cím</label>
                            <input class="form-control" type="text" name="title" value="${row.title}" required>
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Tartalom</label>
                            <textarea class="form-control" name="content" rows="5" required>${row.content}</textarea>
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Szerző</label>
                            <input class="form-control" type="text" name="author" value="${row.author || ""}">
                        </div>

                        <button type="submit" class="btn btn-primary">Mentés</button>
                        <a href="/admin/posts" class="btn btn-secondary">Mégse</a>
                    </form>
                `;

                const html = renderPage("Bejegyzés szerkesztése", content);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(html);
            });

            return;
        }

        // Kapcsolat oldal
        if (req.url === '/contact') {
            serveFile('views/contact.html', 'text/html', res);
            return;
        }

        // Publikus bejegyzéslista
        if (req.url === '/posts') {

            const sql = `SELECT title, content, author, created_at FROM posts ORDER BY created_at DESC`;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error("DB hiba /posts-nál:", err);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end("<h1>Szerverhiba a bejegyzések lekérésekor.</h1>");
                    return;
                }

                let cards = "";

                rows.forEach(post => {
                    cards += `
                        <div class="col-md-6 mb-3">
                            <div class="card shadow-sm h-100">
                                <div class="card-body d-flex flex-column justify-content-between">
                                    <h5 class="card-title">${post.title}</h5>
                                    <p class="card-text">${post.content}</p>
                                    <p class="text-muted small mb-0">
                                        Szerző: ${post.author || 'Ismeretlen'}<br>
                                        Dátum: ${post.created_at || ''}
                                    </p>
                                </div>
                            </div>
                        </div>
                    `;
                });

                const content = `
                    <h1 class="mb-4">Hírek / Bejegyzések</h1>
                    <div class="row">
                        ${cards || '<p class="text-muted">Még nincs egyetlen bejegyzés sem.</p>'}
                    </div>
                `;

                const html = renderPage("Hírek / Bejegyzések", content);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(html);
            });

            return;
        }

        // Kijelentkezés
        if (req.url === '/logout') {
            res.writeHead(302, {
                "Set-Cookie": "authToken=; Max-Age=0; Path=/",
                "Location": "/"
            });
            res.end();
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
let port = 4118
server.listen(port, () => {
    console.log("Szerver fut: http://localhost:"+port);
});

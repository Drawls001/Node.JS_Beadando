const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const db = require('./db');
const BASE_PATH = '/app127';

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
        res.writeHead(302, { "Location": `${BASE_PATH}/login` });
        res.end();
        return false;
    }
    return true;
}

function requireAdmin(req, res) {
    if (!requireLogin(req, res)) return false;
    const role = getCookie(req, "userRole");
    if (role !== "admin") {
        res.writeHead(302, { "Location": `${BASE_PATH}/login` });
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
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
        </head>
        <body>
            
            <div id="menulist"></div>

            <div class="container mt-4">
                ${innerHtml}
            </div>

            <script src="${BASE_PATH}/src/systempage/menu.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
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

    const fullUrl = req.url;
    const pathOnly = fullUrl.split('?')[0];
    const url = pathOnly.startsWith(BASE_PATH)
        ? pathOnly.slice(BASE_PATH.length) || '/' 
        : pathOnly;

    // ===== POST /login – adatbázisos bejelentkezés =====
    if (req.method === 'POST' && url === '/login') {
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
                        <p><a href="${BASE_PATH}/login">Vissza a bejelentkezéshez</a></p>
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
                    "Location": `${BASE_PATH}/dashboard`
                });
                res.end();
            });
        });
        return;
    }

    // ===== POST /register – adatbázisba mentés =====
    if (req.method === 'POST' && url === '/register') {
        let body = "";

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const formData = querystring.parse(body);

            console.log("Regisztrációs adatok:");
            console.log("Felhasználónév:", formData.username);
            console.log("Email:", formData.email);


            const sql = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;

            db.run(sql, [formData.username, formData.email, formData.password], function (err) {
                if (err) {
                    console.error("DB hiba regisztrációnál:", err);
                    
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba a regisztráció során!</h4>
                            <p>Sajnos nem sikerült létrehozni a fiókot.</p>
                            <hr>
                            <p class="mb-0 small">Lehetséges ok: A felhasználónév vagy email cím már foglalt.</p>
                            <p class="small text-muted mt-2">Technikai részletek: ${err.message}</p>
                            <br>
                            <a href="${BASE_PATH}/register" class="btn btn-secondary">Újrapróbálom</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                const escapeHtml = (unsafe) => {
                    return (unsafe || "").toString()
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }
                const safeUsername = escapeHtml(formData.username);

                const successContent = `
                    <div class="row justify-content-center mt-5">
                        <div class="col-md-8">
                            <div class="card shadow text-center">
                                <div class="card-body py-5">
                                    <h1 class="text-success mb-3">
                                        <i class="bi bi-check-circle-fill"></i> Sikeres regisztráció!
                                    </h1>
                                    <p class="lead">Gratulálunk, a fiókodat sikeresen létrehoztuk az adatbázisban.</p>
                                    
                                    <div class="alert alert-light border d-inline-block mt-3 px-4">
                                        <strong>Létrehozott felhasználónév:</strong> ${safeUsername}
                                    </div>

                                    <div class="mt-4">
                                        <p>Most már bejelentkezhetsz a fiókoddal.</p>
                                        <a href="${BASE_PATH}/login" class="btn btn-primary btn-lg px-5">Tovább a bejelentkezéshez</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const html = renderPage("Sikeres regisztráció", successContent);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(html);
            });
        });

        return;
    }

    // ===== POST /contact – kapcsolat űrlap mentése =====
    if (req.method === 'POST' && url === '/contact') {
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
                    
                    // JAVÍTÁS: renderPage használata hiba esetén is, Bootstrap stílussal
                    const errorContent = `
                        <div class="alert alert-danger mt-4" role="alert">
                            <h4 class="alert-heading">Hiba történt!</h4>
                            <p>Sajnos nem sikerült elmenteni az üzenetet az adatbázisba.</p>
                            <hr>
                            <p class="mb-0">Hibaüzenet: ${err.message}</p>
                        </div>
                        <div class="mt-3">
                            <a href="${BASE_PATH}/contact" class="btn btn-secondary">Vissza a kapcsolat oldalra</a>
                        </div>
                    `;
                    
                    const html = renderPage("Hiba", errorContent);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                // JAVÍTÁS: Sikeres mentés esetén is szép, menüvel ellátott oldalt adunk vissza
                const successContent = `
                    <div class="card shadow-sm mt-5 text-center">
                        <div class="card-body py-5">
                            <h1 class="text-success mb-4">Köszönjük az üzenetet!</h1>
                            <p class="lead mb-4">Munkatársaink hamarosan felveszik veled a kapcsolatot a megadott e-mail címen.</p>
                            <a href="${BASE_PATH}/contact" class="btn btn-primary btn-lg">Vissza a főoldalra</a>
                        </div>
                    </div>
                `;

                const html = renderPage("Üzenet elküldve", successContent);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(html);
            });
        });

        return;
    }

    // ===== POST /admin/posts – új bejegyzés mentése =====
    if (req.method === 'POST' && url === '/admin/posts') {

        if (!requireAdmin(req, res)) return;

        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const formData = querystring.parse(body);

            // Opcionális extra védelem: Ne engedjünk üres címet vagy tartalmat
            if (!formData.title || !formData.content) {
                const errorContent = `
                    <div class="alert alert-warning mt-4">
                        <h4 class="alert-heading">Hiányzó adatok!</h4>
                        <p>A cím és a tartalom kitöltése kötelező.</p>
                        <a href="${BASE_PATH}/admin/posts" class="btn btn-secondary">Vissza</a>
                    </div>
                `;
                const html = renderPage("Hiba", errorContent);
                res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
                res.end(html);
                return;
            }

            const sql = `INSERT INTO posts (title, content, author) VALUES (?, ?, ?)`;

            const rawUsername = getCookie(req, "username");
            // decodeURIComponent fontos, ha ékezetes karakter van a névben
            const author = rawUsername ? decodeURIComponent(rawUsername) : "Ismeretlen";

            db.run(sql, [formData.title, formData.content, author], function (err) {
                if (err) {
                    console.error("DB hiba /admin/posts mentésnél:", err);
                    
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Adatbázis hiba!</h4>
                            <p>Nem sikerült elmenteni a bejegyzést.</p>
                            <hr>
                            <p class="mb-0 small">${err.message}</p>
                            <br>
                            <a href="${BASE_PATH}/admin/posts" class="btn btn-secondary">Vissza</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);

                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                // Sikeres mentés után visszairányítás a listára
                res.writeHead(302, { "Location": `${BASE_PATH}/admin/posts` });
                res.end();
            });
        });

        return;
    }

    // ===== POST /admin/update-post – Bejegyzés frissítése =====
    if (req.method === 'POST' && url.startsWith('/admin/update-post')) {

        // 1. JAVÍTÁS: Biztonságos admin ellenőrzés a manuális helyett
        if (!requireAdmin(req, res)) return;

        const urlObj = new URL(req.url, 'http://localhost');
        const id = urlObj.searchParams.get('id');

        // Biztonsági ellenőrzés: Ha nincs ID, nem tudunk mit frissíteni
        if (!id) {
            res.writeHead(302, { "Location": `${BASE_PATH}/admin/posts` });
            res.end();
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const formData = querystring.parse(body);

            const sql = `UPDATE posts SET title = ?, content = ?, author = ? WHERE id = ?`;

            // Az author mezőnél figyelünk, hogy ha üres, akkor inkább NULL vagy üres string legyen
            db.run(sql, [formData.title, formData.content, formData.author || null, id], (err) => {
                if (err) {
                    console.error("DB hiba update-nél:", err);
                    
                    // 2. JAVÍTÁS: Egységes, formázott hibaoldal (renderPage)
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba a módosításkor!</h4>
                            <p>Nem sikerült frissíteni a bejegyzést az adatbázisban.</p>
                            <hr>
                            <p class="mb-0 small">Technikai részletek: ${err.message}</p>
                            <br>
                            <a href="${BASE_PATH}/admin/posts" class="btn btn-secondary">Vissza a listához</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);
                    
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                // Siker esetén visszairányítjuk a listára
                res.writeHead(302, { "Location": `${BASE_PATH}/admin/posts` });
                res.end();
            });
        });

        return;
    }

    // ===== GET kérések =====
    if (req.method === 'GET') {
        // Főoldal
        if (url === "/" || url === "/index.html") {
            serveFile("views/index.html", "text/html", res);
            return;
        }

        // Rólunk
        if (url === '/about-us') {
            serveFile('views/about-us.html', 'text/html', res);
            return;
        }

        // Belépés oldal
        if (url === '/login') {
            serveFile('views/login.html', 'text/html', res);
            return;
        }

        // Regisztráció oldal
        if (url === '/register') {
            serveFile('views/register.html', 'text/html', res);
            return;
        }

        // Dashboard oldal
        if (url === '/dashboard') {

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
                    
                    // JAVÍTÁS: Szép hibaoldal (renderPage) használata
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba a statisztika betöltésekor!</h4>
                            <p>Sajnos nem sikerült lekérni a rendszer adatait.</p>
                            <hr>
                            <p class="mb-0 small">Technikai részletek: ${err.message}</p>
                            <br>
                            <a href="${BASE_PATH}/" class="btn btn-secondary">Vissza a főoldalra</a>
                        </div>
                    `;
                    
                    const html = renderPage("Hiba", errorContent);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
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
        if (url === '/admin') {

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
                                <a href="${BASE_PATH}/admin/users" class="btn btn-primary">Megnyitás</a>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="card shadow-sm h-100">
                            <div class="card-body text-center">
                                <h5 class="card-title">Kapcsolat üzenetek</h5>
                                <p class="card-text">Kapcsolat űrlapról érkező üzenetek kezelése.</p>
                                <a href="${BASE_PATH}/admin/messages" class="btn btn-primary">Megnyitás</a>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <div class="card shadow-sm h-100">
                            <div class="card-body text-center">
                                <h5 class="card-title">Hírek / bejegyzések</h5>
                                <p class="card-text">Hírek létrehozása, szerkesztése és törlése.</p>
                                <a href="${BASE_PATH}/admin/posts" class="btn btn-primary">Megnyitás</a>
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
        if (url === '/admin/users') {

            if (!requireAdmin(req, res)) return;

            const sql = `SELECT username, email, role FROM users ORDER BY username`;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error("DB hiba admin/users-nél:", err);
                    
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba a felhasználók betöltésekor!</h4>
                            <p>Az adatbázis nem válaszolt megfelelően.</p>
                            <hr>
                            <p class="mb-0 small">${err.message}</p>
                            <br>
                            <a href="${BASE_PATH}/admin" class="btn btn-secondary">Vissza</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                const escapeHtml = (unsafe) => {
                    return (unsafe || "").toString()
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }

                let tableRows = "";

                if (rows.length === 0) {
                    tableRows = `
                        <tr>
                            <td colspan="5" class="text-center text-muted">
                                Még nincs egyetlen regisztrált felhasználó sem.
                            </td>
                        </tr>
                    `;
                } else {
                    rows.forEach((row, index) => {
                        const role = row.role || 'user';
                        
                        // JAVÍTÁS: HTML Escaping a megjelenítéshez
                        const safeUsername = escapeHtml(row.username);
                        const safeEmail = escapeHtml(row.email);
                        
                        // URL-ben továbbra is encodeURIComponent kell!
                        const urlSafeUsername = encodeURIComponent(row.username);

                        let actions = "";

                        if (role !== 'admin') {
                            actions += `
                                <a class="btn btn-sm btn-success me-1"
                                   href="${BASE_PATH}/admin/make-admin?username=${urlSafeUsername}"
                                   onclick="return confirm('Biztosan adminná teszed: ${safeUsername}?');">
                                   Adminná tesz
                                </a>
                            `;
                        } else {
                            actions += `
                                <a class="btn btn-sm btn-warning me-1"
                                   href="${BASE_PATH}/admin/remove-admin?username=${urlSafeUsername}"
                                   onclick="return confirm('Biztosan elveszed az admin jogot: ${safeUsername}?');">
                                   Admin jog elvétele
                                </a>
                            `;
                        }

                        actions += `
                            <a class="btn btn-sm btn-danger"
                               href="${BASE_PATH}/admin/delete-user?username=${urlSafeUsername}"
                               onclick="return confirm('Biztosan törlöd: ${safeUsername}?');">
                               Törlés
                            </a>
                        `;

                        tableRows += `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${safeUsername}</td>  <td>${safeEmail}</td>
                                <td>${role}</td>
                                <td>${actions}</td>
                            </tr>
                        `;
                    });
                }

                const content = `
                    <h1 class="mb-3">Felhasználók kezelése</h1>
                    <p class="text-muted">Regisztrált felhasználók listája</p>

                    <p>
                        <a class="btn btn-outline-secondary btn-sm" href="${BASE_PATH}/admin">Vissza</a>
                    </p>

                    <div class="table-responsive mt-3">
                        <table class="table table-striped table-hover align-middle">
                            <thead class="table-dark">
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
        if (url.startsWith('/admin/make-admin')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const username = urlObj.searchParams.get('username');

            if (!username) {
                res.writeHead(302, { "Location": `${BASE_PATH}/admin/users` });
                res.end();
                return;
            }

            const sql = `UPDATE users SET role = 'admin' WHERE username = ?`;

            db.run(sql, [username], function (err) {
                if (err) {
                    console.error("DB hiba adminná tételnél:", err);
                    
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba a módosításkor!</h4>
                            <p>Nem sikerült a felhasználót adminisztrátorrá tenni.</p>
                            <hr>
                            <p class="mb-0 small">Technikai részletek: ${err.message}</p>
                            <br>
                            <a href="${BASE_PATH}/admin/users" class="btn btn-secondary">Vissza a felhasználókhoz</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);
                    
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                res.writeHead(302, { "Location": `${BASE_PATH}/admin/users` });
                res.end();
            });

            return;
        }

        // Admin – Admin jog elvétele
        if (url.startsWith('/admin/remove-admin')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const username = urlObj.searchParams.get('username');

            if (!username) {
                res.writeHead(302, { "Location": `${BASE_PATH}/admin/users` });
                res.end();
                return;
            }

            const sql = `UPDATE users SET role = 'user' WHERE username = ?`;

            db.run(sql, [username], function (err) {
                if (err) {
                    console.error("DB hiba admin jog elvételénél:", err);
                    
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba a módosításkor!</h4>
                            <p>Nem sikerült visszavonni az adminisztrátori jogot.</p>
                            <hr>
                            <p class="mb-0 small">Technikai részletek: ${err.message}</p>
                            <br>
                            <a href="${BASE_PATH}/admin/users" class="btn btn-secondary">Vissza a felhasználókhoz</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);

                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                res.writeHead(302, { "Location": `${BASE_PATH}/admin/users` });
                res.end();
            });

            return;
        }

        // Admin – Felhasználó törlése
        if (url.startsWith('/admin/delete-user')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const username = urlObj.searchParams.get('username');

            if (!username) {
                res.writeHead(302, { "Location": `${BASE_PATH}/admin/users` });
                res.end();
                return;
            }

            const selectSql = `SELECT role FROM users WHERE username = ?`;

            db.get(selectSql, [username], (err, row) => {
                if (err) {
                    console.error("DB hiba szerep lekérdezésnél:", err);
                    
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba a törlés előkészítésekor!</h4>
                            <p>Nem sikerült lekérdezni a felhasználó adatait.</p>
                            <p class="small">${err.message}</p>
                            <a href="${BASE_PATH}/admin/users" class="btn btn-secondary">Vissza</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                if (!row) {
                    // Ha nincs ilyen user, csak visszairányítjuk
                    res.writeHead(302, { "Location": `${BASE_PATH}/admin/users` });
                    res.end();
                    return;
                }

                if (row.role === 'admin') {
                    const warningContent = `
                        <div class="alert alert-warning mt-5">
                            <h4 class="alert-heading"><i class="bi bi-exclamation-triangle"></i> Nem engedélyezett művelet!</h4>
                            <p class="mt-3"><strong>Adminisztrátor jogosultságú felhasználót biztonsági okokból nem lehet közvetlenül törölni.</strong></p>
                            <p>Ha mindenképp törölni szeretnéd, először vedd el az admin jogosultságát a listában ("Admin jog elvétele"), és utána törölheted.</p>
                            <hr>
                            <a href="${BASE_PATH}/admin/users" class="btn btn-warning">Értem, vissza a listához</a>
                        </div>
                    `;
                    
                    const html = renderPage("Hiba", warningContent);
                    res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                const deleteSql = `DELETE FROM users WHERE username = ?`;

                db.run(deleteSql, [username], function (err2) {
                    if (err2) {
                        console.error("DB hiba törlésnél:", err2);
                        
                        const errorContent = `
                            <div class="alert alert-danger mt-4">
                                <h4 class="alert-heading">Sikertelen törlés!</h4>
                                <p>Hiba történt az adatbázis művelet közben.</p>
                                <p class="small">${err2.message}</p>
                                <a href="${BASE_PATH}/admin/users" class="btn btn-secondary">Vissza</a>
                            </div>
                        `;
                        const html = renderPage("Hiba", errorContent);
                        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                        res.end(html);
                        return;
                    }

                    // Siker
                    res.writeHead(302, { "Location": `${BASE_PATH}/admin/users` });
                    res.end();
                });
            });

            return;
        }

        // Admin – Üzenetek listázása
        if (url === '/admin/messages') {

            if (!requireAdmin(req, res)) return;

            const sql = `SELECT id, name, email, message, created_at FROM messages ORDER BY created_at DESC`;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error("DB hiba admin/messages-nél:", err);
                    
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba az üzenetek betöltésekor!</h4>
                            <p>Nem sikerült lekérdezni az adatbázist.</p>
                            <p class="small">${err.message}</p>
                            <a href="${BASE_PATH}/admin" class="btn btn-secondary">Vissza</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                const escapeHtml = (unsafe) => {
                    return (unsafe || "").toString()
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }

                let tableRows = "";

                rows.forEach((row, index) => {
                    
                    const safeName = escapeHtml(row.name);
                    const safeEmail = escapeHtml(row.email);
                    const safeMessage = escapeHtml(row.message);
                    
                    tableRows += `
                        <tr>
                            <td>${index + 1}</td>
                            <td><strong>${safeName}</strong></td>
                            <td><a href="mailto:${safeEmail}">${safeEmail}</a></td>
                            
                            <td style="white-space: pre-wrap; max-width: 400px;">${safeMessage}</td>
                            
                            <td class="small text-muted">${row.created_at || ""}</td>
                            <td>
                                <a class="btn btn-sm btn-danger"
                                   href="${BASE_PATH}/admin/delete-message?id=${row.id}"
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
                        <a class="btn btn-outline-secondary btn-sm" href="${BASE_PATH}/admin">Vissza</a>
                    </p>

                    <div class="table-responsive mt-3">
                        <table class="table table-striped table-hover align-middle">
                            <thead class="table-dark">
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
                                        <td colspan="6" class="text-center text-muted p-4">
                                            <em>Még nincs egyetlen üzenet sem.</em>
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
        if (url.startsWith('/admin/delete-message')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const id = urlObj.searchParams.get('id');

            if (!id) {
                // Ha nincs ID, visszaküldjük a listára
                res.writeHead(302, { "Location": `${BASE_PATH}/admin/messages` });
                res.end();
                return;
            }

            const sql = `DELETE FROM messages WHERE id = ?`;

            db.run(sql, [id], function (err) {
                if (err) {
                    console.error("DB hiba üzenet törlésnél:", err);
                    
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba a törléskor!</h4>
                            <p>Nem sikerült törölni az üzenetet az adatbázisból.</p>
                            <hr>
                            <p class="mb-0 small">Technikai részletek: ${err.message}</p>
                            <br>
                            <a href="${BASE_PATH}/admin/messages" class="btn btn-secondary">Vissza az üzenetekhez</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);

                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                // Siker esetén visszairányítás a listára
                res.writeHead(302, { "Location": `${BASE_PATH}/admin/messages` });
                res.end();
            });

            return;
        }

        // Admin – Bejegyzések listázása + új felvitel
        if (url === '/admin/posts') {

            if (!requireAdmin(req, res)) return;

            const sql = `SELECT id, title, content, author, created_at FROM posts ORDER BY created_at DESC`;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error("DB hiba admin/posts-nál:", err);
                    
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba a bejegyzések betöltésekor!</h4>
                            <p>Nem sikerült lekérdezni az adatbázist.</p>
                            <p class="small">${err.message}</p>
                            <a href="${BASE_PATH}/admin" class="btn btn-secondary">Vissza</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                const escapeHtml = (unsafe) => {
                    return (unsafe || "").toString()
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }

                let tableRows = "";

                rows.forEach((row, index) => {
                    
                    const safeTitle = escapeHtml(row.title);
                    const safeAuthor = escapeHtml(row.author);

                    tableRows += `
                        <tr>
                            <td>${index + 1}</td>
                            <td class="fw-bold">${safeTitle}</td>
                            <td>${safeAuthor}</td>
                            <td class="small text-muted">${row.created_at || ""}</td>
                            <td>
                                <a class="btn btn-sm btn-warning me-1"
                                   href="${BASE_PATH}/admin/edit-post?id=${row.id}">
                                   <i class="bi bi-pencil"></i> Szerkesztés
                                </a>
                                <a class="btn btn-sm btn-danger"
                                   href="${BASE_PATH}/admin/delete-post?id=${row.id}"
                                   onclick="return confirm('Biztosan törlöd ezt a bejegyzést?');">
                                   <i class="bi bi-trash"></i> Törlés
                                </a>
                            </td>
                        </tr>
                    `;
                });

                const content = `
                    <h1 class="mb-3">Bejegyzések kezelése</h1>
                    <p class="text-muted">Új hírek felvétele, meglévők törlése.</p>

                    <p>
                        <a class="btn btn-outline-secondary btn-sm" href="${BASE_PATH}/admin">Vissza az admin menübe</a>
                    </p>

                    <div class="card shadow-sm mb-5">
                        <div class="card-header bg-primary text-white">
                            <h4 class="mb-0 fs-5">Új bejegyzés írása</h4>
                        </div>
                        <div class="card-body">
                            <form action="${BASE_PATH}/admin/posts" method="POST">
                                <div class="mb-3">
                                    <label class="form-label fw-bold" for="title">Cím</label>
                                    <input class="form-control" type="text" id="title" name="title" required placeholder="Add meg a bejegyzés címét...">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-bold" for="content">Tartalom</label>
                                    <textarea class="form-control" id="content" name="content" rows="4" required placeholder="Ide írd a szöveget..."></textarea>
                                </div>
                                <button type="submit" class="btn btn-primary">
                                    Bejegyzés mentése
                                </button>
                            </form>
                        </div>
                    </div>

                    <h4 class="mb-3">Meglévő bejegyzések</h4>
                    <div class="table-responsive">
                        <table class="table table-striped table-hover align-middle">
                            <thead class="table-dark">
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
                                        <td colspan="5" class="text-center text-muted p-4">
                                            <em>Még nincs egyetlen bejegyzés sem. Írj egyet fent!</em>
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
        if (url.startsWith('/admin/delete-post')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const id = urlObj.searchParams.get('id');

            if (!id) {
                // Ha nincs ID, visszaküldjük a listára
                res.writeHead(302, { "Location": `${BASE_PATH}/admin/posts` });
                res.end();
                return;
            }

            const sql = `DELETE FROM posts WHERE id = ?`;

            db.run(sql, [id], function (err) {
                if (err) {
                    console.error("DB hiba bejegyzés törlésnél:", err);
                    
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba a törléskor!</h4>
                            <p>Nem sikerült törölni a bejegyzést az adatbázisból.</p>
                            <hr>
                            <p class="mb-0 small">Technikai részletek: ${err.message}</p>
                            <br>
                            <a href="${BASE_PATH}/admin/posts" class="btn btn-secondary">Vissza a bejegyzésekhez</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);

                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                // Siker esetén visszairányítás a listára
                res.writeHead(302, { "Location": `${BASE_PATH}/admin/posts` });
                res.end();
            });

            return;
        }

        // Admin – Bejegyzés szerkesztő űrlap
        if (url.startsWith('/admin/edit-post')) {

            if (!requireAdmin(req, res)) return;

            const urlObj = new URL(req.url, 'http://localhost');
            const id = urlObj.searchParams.get('id');

            if (!id) {
                res.writeHead(302, { "Location": `${BASE_PATH}/admin/posts` });
                res.end();
                return;
            }

            const sql = `SELECT * FROM posts WHERE id = ?`;

            db.get(sql, [id], (err, row) => {
                // Hiba vagy nem létező bejegyzés kezelése
                if (err || !row) {
                    const errorMsg = err ? err.message : "A keresett bejegyzés nem található az adatbázisban.";
                    const errorContent = `
                        <div class="alert alert-warning mt-4">
                            <h4 class="alert-heading">Hiba!</h4>
                            <p>Nem sikerült betölteni a szerkesztendő bejegyzést.</p>
                            <hr>
                            <p class="mb-0 small">${errorMsg}</p>
                            <br>
                            <a href="${BASE_PATH}/admin/posts" class="btn btn-secondary">Vissza a listához</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);
                    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                const escapeHtmlAttr = (unsafe) => {
                    return (unsafe || "").toString()
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }

                const safeTitle = escapeHtmlAttr(row.title);
                const safeContent = escapeHtmlAttr(row.content);
                const safeAuthor = escapeHtmlAttr(row.author);

                const content = `
                    <h1 class="mb-4">Bejegyzés szerkesztése</h1>

                    <div class="card shadow-sm">
                        <div class="card-header bg-warning text-dark">
                            <h4 class="mb-0 fs-5">Szerkesztés: #${row.id}</h4>
                        </div>
                        <div class="card-body">
                            <form action="${BASE_PATH}/admin/update-post?id=${row.id}" method="POST">
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Cím</label>
                                    <input class="form-control" type="text" name="title" value="${safeTitle}" required>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label fw-bold">Tartalom</label>
                                    <textarea class="form-control" name="content" rows="6" required>${safeContent}</textarea>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label fw-bold">Szerző</label>
                                    <input class="form-control" type="text" name="author" value="${safeAuthor}">
                                </div>

                                <div class="d-flex justify-content-between align-items-center mt-4">
                                    <a href="${BASE_PATH}/admin/posts" class="btn btn-secondary">Mégse</a>
                                    <button type="submit" class="btn btn-primary px-4">
                                        <i class="bi bi-save"></i> Változtatások mentése
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;

                const html = renderPage("Bejegyzés szerkesztése", content);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(html);
            });

            return;
        }

        // Kapcsolat oldal
        if (url === '/contact') {
            serveFile('views/contact.html', 'text/html', res);
            return;
        }

        // Publikus bejegyzéslista
        if (url === '/posts') {

            const sql = `SELECT title, content, author, created_at FROM posts ORDER BY created_at DESC`;

            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error("DB hiba /posts-nál:", err);
                    
                    const errorContent = `
                        <div class="alert alert-danger mt-4">
                            <h4 class="alert-heading">Hiba a hírek betöltésekor!</h4>
                            <p>Nem sikerült lekérdezni az adatbázist.</p>
                            <p class="small">${err.message}</p>
                            <a href="${BASE_PATH}/" class="btn btn-secondary">Vissza a főoldalra</a>
                        </div>
                    `;
                    const html = renderPage("Hiba", errorContent);
                    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
                    res.end(html);
                    return;
                }

                const escapeHtml = (unsafe) => {
                    return (unsafe || "").toString()
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }

                let cards = "";

                rows.forEach(post => {
                    const safeTitle = escapeHtml(post.title);
                    const safeContent = escapeHtml(post.content);
                    const safeAuthor = escapeHtml(post.author);

                    cards += `
                        <div class="col-md-6 mb-4">
                            <div class="card shadow-sm h-100">
                                <div class="card-body">
                                    <h5 class="card-title fw-bold">${safeTitle}</h5>
                                    <h6 class="card-subtitle mb-3 text-muted small">
                                        <i class="bi bi-person"></i> ${safeAuthor || 'Ismeretlen'} &nbsp;|&nbsp; 
                                        <i class="bi bi-calendar"></i> ${post.created_at || ''}
                                    </h6>
                                    <hr>
                                    <p class="card-text" style="white-space: pre-wrap;">${safeContent}</p>
                                </div>
                            </div>
                        </div>
                    `;
                });

                const content = `
                    <h1 class="mb-3">Hírek / Bejegyzések</h1>
                    <p class="text-muted">A Soleris Group legfrissebb hírei és közleményei.</p>
                    
                    <p class="mb-4">
                        <a class="btn btn-outline-secondary btn-sm" href="${BASE_PATH}/">Vissza a főoldalra</a>
                    </p>

                    <div class="row">
                        ${cards || `
                            <div class="col-12">
                                <div class="alert alert-info">
                                    Jelenleg nincs megjeleníthető bejegyzés.
                                </div>
                            </div>
                        `}
                    </div>
                `;

                const html = renderPage("Hírek / Bejegyzések", content);
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                res.end(html);
            });

            return;
        }

        // Kijelentkezés
        if (url === '/logout') {
            res.writeHead(302, {
                "Set-Cookie": [ 
                    "authToken=; Max-Age=0; Path=/",
                    "userRole=; Max-Age=0; Path=/",
                    "username=; Max-Age=0; Path=/"
                    ],
                "Location": BASE_PATH + "/"
            });
            res.end();
            return;
        }

        // Public statikus fájlok (pl. CSS)
        if (url.startsWith('/public/')) {
            const relPath = req.url.slice(1); // "public/style.css"
            const ext = path.extname(relPath);
            const ct = mimeTypes[ext] || 'application/octet-stream';
            serveFile(relPath, ct, res);
            return;
        }

        // JS fájlok (pl. /src/systempage/menu.js)
        if (url.endsWith(".js")) {
            // fontos: . + req.url → ./src/systempage/menu.js
            serveFile("." + url, "application/javascript", res);
            return;
        }

        // favicon – csak elnyeljük, hogy ne legyen hiba
        if (url === "/favicon.ico") {
            res.writeHead(204);
            res.end();
            return;
        }

        // minden másra: 404
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 - Nincs ilyen erőforrás: " + url);
        return;
    }

    // ha nem GET és nem POST
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("405 - Nem támogatott HTTP metódus");
});
let port = 4127
server.listen(port, '0.0.0.0', () => {
    console.log(`Szerver fut: http://143.47.98.96:${port}`);
});

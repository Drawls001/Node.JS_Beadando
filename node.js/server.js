const http = require('http');
const fs = require('fs');
const path = require('path');

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

const server = http.createServer((req, res) => {
    console.log("Kérés:", req.url);

    // Főoldal
    if (req.url === "/" || req.url === "/index.html") {
        serveFile("views/index.html", "text/html", res);
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
});

server.listen(3000, () => {
    console.log("Szerver fut: http://localhost:3000");
});

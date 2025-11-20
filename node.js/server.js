const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    
    let filePath = '';

    if (req.url === '/') { //Link
        filePath = 'views/index.html';
    } 

    const fullPath = path.join(__dirname, filePath);

    fs.readFile(fullPath, (err, data) => {
        if (err) {
            res.writeHead(500, {"Content-Type": "text/plain"});
            res.end("Server error");
            return;
        }

        res.writeHead(200, {"Content-Type": "text/html"});
        res.end(data);
    });

});

server.listen(3000, () => {
    console.log("Fut: http://localhost:3000");
});
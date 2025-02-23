const express = require('express');
const { readFile } = require('fs');
const app = express();

const hostname = '127.0.0.1';
const port = 3000;

app.get('/home', (req, res) => {
    readFile('./home.html', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error reading file ');
            return;
        }
        res.send(data);
    });
});

app.get('/', (req, res) => {
    res.send('Hello, World!\n');
});

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

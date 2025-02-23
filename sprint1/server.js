const express = require('express');
const path = require('path');
const app = express();

const hostname = '127.0.0.1';
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});
app.get('/account', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});
app.get('/chekout', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});
app.get('/menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});
app.get('/order', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});
app.get('/singup', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
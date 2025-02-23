const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const app = express();

const hostname = '127.0.0.1';
const port = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});
app.get('/account', (req, res) => {
    res.sendFile(path.join(__dirname, 'account.html'));
});
app.get('/chekout', (req, res) => {
    res.sendFile(path.join(__dirname, 'chekout.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'menu.html'));
});
app.get('/order', (req, res) => {
    res.sendFile(path.join(__dirname, 'order.html'));
});
app.get('/singup', (req, res) => {
    res.sendFile(path.join(__dirname, 'singup.html'));
});  

// Add registration endpoint
app.post('/register', (req, res) => {
    const { firstName, lastName, password } = req.body;

    // Validate input
    if (!firstName || !lastName || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const userData = {
        firstName,
        lastName,
        password: password, // In production, hash this password!
        createdAt: new Date().toISOString()
    };

    // Read existing users or create new array
    const usersPath = path.join(__dirname, 'data', 'users.json');
    let users = [];
    
    try {
        if (fs.existsSync(usersPath)) {
            const data = fs.readFileSync(usersPath, 'utf8');
            users = JSON.parse(data);
        }
        
        users.push(userData);
        
        // Ensure data directory exists
        if (!fs.existsSync(path.join(__dirname, 'data'))) {
            fs.mkdirSync(path.join(__dirname, 'data'));
        }
        
        // Write updated users array
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error('Error saving user:', error);
        res.status(500).json({ error: "Error registering user" });
    }
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).send('404 Not Found');
});

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
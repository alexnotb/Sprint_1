const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const app = express();

const hostname = '127.0.0.1';
const port = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes for HTML pages
const pages = ['home', 'login', 'singup', 'account', 'menu', 'order'];
pages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, `${page}.html`));
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// Auth status endpoint
app.get('/auth/status', (req, res) => {
    const sessionPath = path.join(__dirname, 'data', 'sessions.json');
    try {
        if (fs.existsSync(sessionPath)) {
            const sessions = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
            const userSession = sessions[req.ip];
            if (userSession && userSession.expires > Date.now()) {
                res.json({ loggedIn: true, user: userSession.user });
                return;
            }
        }
        res.json({ loggedIn: false });
    } catch (error) {
        console.error('Error checking auth status:', error);
        res.status(500).json({ error: "Error checking authentication" });
    }
});

// Login endpoint
app.post('/login', (req, res) => {
    const { firstName, lastName, password } = req.body;

    if (!firstName || !lastName || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const usersPath = path.join(__dirname, 'data', 'users.json');
        if (!fs.existsSync(usersPath)) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users.find(u => 
            u.firstName === firstName && 
            u.lastName === lastName && 
            u.password === password
        );

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Create session
        const sessionPath = path.join(__dirname, 'data', 'sessions.json');
        let sessions = {};
        
        if (fs.existsSync(sessionPath)) {
            sessions = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        }

        sessions[req.ip] = {
            user: { firstName: user.firstName, lastName: user.lastName },
            expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };

        if (!fs.existsSync(path.join(__dirname, 'data'))) {
            fs.mkdirSync(path.join(__dirname, 'data'));
        }

        fs.writeFileSync(sessionPath, JSON.stringify(sessions, null, 2));
        res.json({ message: "Login successful" });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Registration endpoint
app.post('/register', async (req, res) => {
    const { firstName, lastName, password } = req.body;

    if (!firstName || !lastName || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        // Ensure data directory exists
        const dataDir = path.join(__dirname, 'data');
        const usersPath = path.join(dataDir, 'users.json');
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Read existing users or create new array
        let users = [];
        if (fs.existsSync(usersPath)) {
            try {
                const data = fs.readFileSync(usersPath, 'utf8');
                users = JSON.parse(data);
                if (!Array.isArray(users)) {
                    users = [];
                }
            } catch (error) {
                console.error('Error reading users file:', error);
                users = [];
            }
        }

        // Check if user already exists
        if (users.some(user => user.firstName === firstName && user.lastName === lastName)) {
            return res.status(400).json({ error: "User already exists" });
        }

        // Add new user
        const newUser = {
            firstName,
            lastName,
            password,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: "Error registering user" });
    }
});

// Logout endpoint
app.post('/logout', (req, res) => {
    const sessionPath = path.join(__dirname, 'data', 'sessions.json');
    try {
        if (fs.existsSync(sessionPath)) {
            let sessions = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
            if (sessions[req.ip]) {
                delete sessions[req.ip];
                fs.writeFileSync(sessionPath, JSON.stringify(sessions, null, 2));
            }
        }
        // Add cache control headers
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Expires': '-1',
            'Pragma': 'no-cache'
        });
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ error: "Error during logout" });
    }
});

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
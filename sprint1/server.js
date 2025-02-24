const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const multer = require('multer');
const app = express();

const hostname = '127.0.0.1';
const port = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Update static file serving
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Add security headers middleware
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "img-src 'self' data: blob: *.google.com *.googleapis.com; " +
        "script-src 'self' 'unsafe-inline' *.googleapis.com *.google.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "frame-src 'self' *.google.com; " + // Allow Google Maps iframes
        "connect-src 'self' *.google.com *.googleapis.com;"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Increased to 10MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only images are allowed'));
        }
        cb(null, true);
    }
});

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
                // Get user's profile image
                const usersPath = path.join(__dirname, 'data', 'users.json');
                const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                const user = users.find(u => 
                    u.firstName === userSession.user.firstName && 
                    u.lastName === userSession.user.lastName
                );
                
                res.json({ 
                    loggedIn: true, 
                    user: userSession.user,
                    profileImage: user?.profileImage || null
                });
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

// Image upload endpoint with error handling
app.post('/upload-profile-image', (req, res) => {
    upload.single('profileImage')(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
            }
            return res.status(400).json({ error: err.message });
        } else if (err) {
            return res.status(400).json({ error: 'Error uploading file: ' + err.message });
        }

        // Continue with the rest of the upload logic
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            const sessionPath = path.join(__dirname, 'data', 'sessions.json');
            const sessions = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
            const userSession = sessions[req.ip];

            if (!userSession) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const imagePath = '/uploads/' + req.file.filename;
            
            // Update user's profile image in users.json
            const usersPath = path.join(__dirname, 'data', 'users.json');
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            const user = users.find(u => 
                u.firstName === userSession.user.firstName && 
                u.lastName === userSession.user.lastName
            );

            if (user) {
                user.profileImage = imagePath;
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
            }

            res.json({ imagePath });
        } catch (error) {
            console.error('Error handling profile image:', error);
            res.status(500).json({ error: 'Error updating profile image' });
        }
    });
});

app.get('/profile-image', (req, res) => {
    try {
        const sessionPath = path.join(__dirname, 'data', 'sessions.json');
        const sessions = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        const userSession = sessions[req.ip];

        if (!userSession) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const usersPath = path.join(__dirname, 'data', 'users.json');
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users.find(u => 
            u.firstName === userSession.user.firstName && 
            u.lastName === userSession.user.lastName
        );

        if (user && user.profileImage) {
            res.json({ imagePath: user.profileImage });
        } else {
            res.json({ imagePath: null });
        }
    } catch (error) {
        console.error('Error getting profile image:', error);
        res.status(500).json({ error: 'Error getting profile image' });
    }
});

// Add update profile endpoint
app.post('/update-profile', (req, res) => {
    const { firstName, lastName, currentPassword, newPassword } = req.body;

    try {
        const sessionPath = path.join(__dirname, 'data', 'sessions.json');
        const usersPath = path.join(__dirname, 'data', 'users.json');
        
        // Check if user is authenticated
        const sessions = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        const userSession = sessions[req.ip];
        
        if (!userSession) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Update user data
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users.find(u => 
            u.firstName === userSession.user.firstName && 
            u.lastName === userSession.user.lastName
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password if changing password
        if (newPassword) {
            if (!currentPassword || currentPassword !== user.password) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
            user.password = newPassword;
        }

        // Update user information
        user.firstName = firstName;
        user.lastName = lastName;

        // Update session with new user info
        userSession.user = {
            firstName: user.firstName,
            lastName: user.lastName
        };

        // Save updates
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        fs.writeFileSync(sessionPath, JSON.stringify(sessions, null, 2));

        res.json({ 
            message: 'Profile updated successfully',
            user: { firstName: user.firstName, lastName: user.lastName }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Error updating profile' });
    }
});

// Add orders endpoint
app.post('/save-order', (req, res) => {
    try {
        const sessionPath = path.join(__dirname, 'data', 'sessions.json');
        const sessions = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        const userSession = sessions[req.ip];

        if (!userSession) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { order } = req.body;
        const ordersDir = path.join(__dirname, 'data', 'orders');
        
        // Create orders directory if it doesn't exist
        if (!fs.existsSync(ordersDir)) {
            fs.mkdirSync(ordersDir, { recursive: true });
        }

        // Get user data for the order
        const usersPath = path.join(__dirname, 'data', 'users.json');
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users.find(u => 
            u.firstName === userSession.user.firstName && 
            u.lastName === userSession.user.lastName
        );

        // Create order object
        const orderData = {
            orderId: Date.now(),
            timestamp: new Date().toISOString(),
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                profileImage: user.profileImage || null
            },
            orderDetails: order
        };

        // Save order to a new file
        const orderPath = path.join(ordersDir, `order_${orderData.orderId}.json`);
        fs.writeFileSync(orderPath, JSON.stringify(orderData, null, 2));

        // Add order to user's history
        if (!user.orders) user.orders = [];
        user.orders.push(orderData.orderId);
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        res.json({ 
            message: 'Order saved successfully', 
            orderId: orderData.orderId 
        });

    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({ error: 'Error saving order' });
    }
});

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
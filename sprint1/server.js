const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const multer = require('multer');
const app = express();

// Server configuration
const hostname = '127.0.0.1';
const port = 3000;

// Registration handling
const registrationAttempts = new Map();
const REGISTRATION_TIMEOUT = 5000; // 5 seconds

// Core middleware setup
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Security middleware
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "img-src 'self' data: blob: *.google.com *.googleapis.com; " +
        "script-src 'self' 'unsafe-inline' *.googleapis.com *.google.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "frame-src 'self' *.google.com; " +
        "connect-src 'self' *.google.com *.googleapis.com;"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
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

// Initialize data directory on startup
const initializeDataDirectory = () => {
    const dataDir = path.join(__dirname, 'data');
    const usersPath = path.join(dataDir, 'users.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Ensure users.json exists
    if (!fs.existsSync(usersPath)) {
        fs.writeFileSync(usersPath, '[]', 'utf8');
    }
};

// Routes setup
const pages = ['home', 'login', 'account', 'menu', 'order'];

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/singup', (req, res) => {
    res.redirect(301, '/signup');
});

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
    const requestId = `${req.ip}_${req.body.firstName}_${req.body.lastName}`;
    
    // Check if this is a duplicate request within timeout period
    if (registrationAttempts.has(requestId)) {
        const lastAttempt = registrationAttempts.get(requestId);
        if (Date.now() - lastAttempt.timestamp < REGISTRATION_TIMEOUT) {
            // If previous request was successful, return success response
            if (lastAttempt.success) {
                return res.status(201).json({
                    message: "Registration successful",
                    redirect: "/login"
                });
            }
        }
    }

    // Mark the attempt
    registrationAttempts.set(requestId, {
        timestamp: Date.now(),
        success: false
    });

    console.log('=== Starting Registration Process ===');
    console.log('1. Request body:', req.body);
    
    const dataDir = path.join(__dirname, 'data');
    const usersPath = path.join(dataDir, 'users.json');

    try {
        const { firstName, lastName, password } = req.body;

        if (!firstName?.trim() || !lastName?.trim() || !password?.trim()) {
            console.log('Validation failed - missing or empty fields');
            return res.status(400).json({ error: "All fields are required and cannot be empty" });
        }

        // Read current users with error handling
        let users = [];
        try {
            const data = fs.readFileSync(usersPath, 'utf8');
            users = JSON.parse(data || '[]');
        } catch (err) {
            console.error('Error reading users file:', err);
            users = [];
        }

        // Check for duplicate user
        const existingUser = users.find(u => 
            u.firstName.toLowerCase() === firstName.toLowerCase() && 
            u.lastName.toLowerCase() === lastName.toLowerCase()
        );
        
        if (existingUser) {
            console.log('Duplicate user found');
            return res.status(400).json({ 
                error: "A user with this name already exists. Please use a different name or login."
            });
        }

        // Create new user
        const newUser = {
            firstName,
            lastName,
            password,
            createdAt: new Date().toISOString(),
            orders: []
        };

        users.push(newUser);

        // Save with error handling
        try {
            fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
            console.log('User saved successfully. Total users:', users.length);
        } catch (err) {
            console.error('Error saving users file:', err);
            return res.status(500).json({ error: "Error saving user data" });
        }

        // Mark the attempt as successful
        registrationAttempts.set(requestId, {
            timestamp: Date.now(),
            success: true
        });

        // Clean up old attempts periodically
        setTimeout(() => {
            registrationAttempts.delete(requestId);
        }, REGISTRATION_TIMEOUT);

        res.status(201).json({ 
            message: "Registration successful",
            redirect: "/login"
        });

    } catch (error) {
        console.error('=== Registration Error ===');
        console.error('Error details:', error);
        res.status(500).json({ 
            error: "Server error during registration. Please try again later."
        });
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

        // Create necessary directories
        const dataDir = path.join(__dirname, 'data');
        const ordersDir = path.join(dataDir, 'orders');
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(ordersDir)) {
            fs.mkdirSync(ordersDir, { recursive: true });
        }

        // Get user data
        const usersPath = path.join(dataDir, 'users.json');
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users.find(u => 
            u.firstName === userSession.user.firstName && 
            u.lastName === userSession.user.lastName
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create order object
        const orderData = {
            orderId: Date.now(),
            timestamp: new Date().toISOString(),
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                profileImage: user.profileImage || null
            },
            orderDetails: req.body.order
        };

        // Save order to file
        const orderPath = path.join(ordersDir, `order_${orderData.orderId}.json`);
        fs.writeFileSync(orderPath, JSON.stringify(orderData, null, 2));

        // Update user's orders array
        if (!user.orders) {
            user.orders = [];
        }
        user.orders.push(orderData.orderId);
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

        // Send success response
        res.status(201).json({ 
            message: 'Order saved successfully', 
            orderId: orderData.orderId 
        });

    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({ error: 'Error saving order' });
    }
});

// Initialize data directory on startup
initializeDataDirectory();

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
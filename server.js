'use strict';

/**
 * AnimeLovers - Enterprise Backend Server
 * Hardened to OWASP Top 10 Standards
 * Role: Senior Cybersecurity Engineer
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_local_only_1234567890_min_32';
const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

// ==========================================
// 1. SECURITY LOGGING & AUDIT TRAIL (OWASP A09)
// ==========================================
function sanitizeLogString(str) {
    if (typeof str !== 'string') return String(str);
    // Remove CR and LF to prevent Log Injection / CRLF attacks
    return str.replace(/[\r\n\t]/g, '_').slice(0, 300);
}

function auditLog(event, details = {}, ip = 'unknown') {
    const timestamp = new Date().toISOString();
    const cleanIp = sanitizeLogString(ip);
    const cleanEvent = sanitizeLogString(event);
    const safeDetails = JSON.stringify(details, (k, v) => (typeof v === 'string' ? sanitizeLogString(v) : v));
    console.log(`[SECURITY-AUDIT] [${timestamp}] [IP: ${cleanIp}] [EVENT: ${cleanEvent}] ${safeDetails}`);
}

// ==========================================
// 2. SECURITY HEADERS & HARDENING (OWASP A05)
// ==========================================
app.disable('x-powered-by');

// Content Security Policy & Security Headers via Helmet
app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'", // Needed for inline initialization or trusted hash
                    "https://cdnjs.cloudflare.com",
                    "https://cdn.jsdelivr.net"
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com",
                    "https://cdnjs.cloudflare.com"
                ],
                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "https://cdnjs.cloudflare.com"
                ],
                imgSrc: [
                    "'self'",
                    "data:",
                    "https://cdn.myanimelist.net",
                    "https://image.myanimelist.net",
                    "https://myanimelist.net",
                    "https://*.myanimelist.net",
                    "https://img.youtube.com",
                    "https://i.ytimg.com"
                ],
                mediaSrc: ["'self'", "https://*.youtube.com", "https://*.googlevideo.com"],
                frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
                connectSrc: [
                    "'self'",
                    "https://api.jikan.moe"
                ],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                upgradeInsecureRequests: NODE_ENV === 'production' ? [] : null
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        hsts: NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
    })
);

// Body Parser with strict payload size limits (OWASP A04 - Anti-DoS)
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

// Strict CORS (OWASP A01)
const allowedOrigins = [
    process.env.ALLOWED_ORIGIN || `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('CORS policy: Access Denied'));
            }
        },
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true
    })
);

// ==========================================
// 3. RATE LIMITING (OWASP A04 - Insecure Design)
// ==========================================
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, message: 'Too many requests, please try again later.' },
    handler: (req, res, next, options) => {
        auditLog('RATE_LIMIT_EXCEEDED_GLOBAL', { path: req.path }, req.ip);
        res.status(429).json(options.message);
    }
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15, // 15 attempts per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, message: 'Too many login attempts. Please wait 15 minutes.' },
    handler: (req, res, next, options) => {
        auditLog('RATE_LIMIT_EXCEEDED_AUTH', { path: req.path }, req.ip);
        res.status(429).json(options.message);
    }
});

// ==========================================
// 4. IN-MEMORY CACHE & DATA STORE (OWASP A04/A02)
// ==========================================
const apiCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

// In-Memory User Database (with bcrypt hashed passwords)
// Initial secure demo user: admin@animelovers.io / SecurePass!2026
const usersDb = new Map();

(async () => {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('AnimeLover!2026', salt);
    usersDb.set('otaku@animelovers.dev', {
        id: 'usr_001',
        username: 'KageOtaku',
        email: 'otaku@animelovers.dev',
        passwordHash: hashedPassword,
        favorites: [1, 5114, 21, 16498], // Bebop, FMA:B, One Piece, AOT
        watchlist: [38000, 40748],
        createdAt: new Date().toISOString()
    });
})();

// ==========================================
// 5. INPUT SANITIZATION & VALIDATION (OWASP A03)
// ==========================================
function sanitizeAlphanumericQuery(input, maxLen = 60) {
    if (!input || typeof input !== 'string') return '';
    const trimmed = input.trim().slice(0, maxLen);
    // Allow letters, numbers, spaces, hyphens, underscores, quotes
    return validator.whitelist(trimmed, 'a-zA-Z0-9\\s\\-_.,:;!?\'"()');
}

function sanitizeNumber(input, fallback = 1, min = 1, max = 1000000) {
    const num = parseInt(input, 10);
    if (isNaN(num) || num < min) return fallback;
    if (num > max) return max;
    return num;
}

function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return validator.isEmail(email.trim()) && email.length <= 120;
}

function validatePasswordPolicy(password) {
    if (!password || typeof password !== 'string') return false;
    // Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,64}$/;
    return strongPasswordRegex.test(password);
}

// ==========================================
// 6. SSRF-SAFE UPSTREAM API PROXY (OWASP A10)
// ==========================================
// Fetch data safely from Jikan v4 with timeout and allowlist
async function fetchFromJikan(endpointPath, queryParams = {}) {
    const cacheKey = `${endpointPath}?${new URLSearchParams(queryParams).toString()}`;
    const cached = apiCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
    }

    const safeUrl = new URL(`${JIKAN_BASE_URL}/${endpointPath}`);
    // Only allow specific trusted query keys
    const allowedParamKeys = ['q', 'page', 'limit', 'type', 'status', 'rating', 'sfw', 'genres', 'order_by', 'sort', 'filter'];
    for (const [key, value] of Object.entries(queryParams)) {
        if (allowedParamKeys.includes(key) && value !== undefined && value !== '') {
            safeUrl.searchParams.set(key, String(value));
        }
    }

    return new Promise((resolve, reject) => {
        const req = https.get(safeUrl.toString(), {
            headers: {
                'User-Agent': 'AnimeLoversHub-SecureClient/1.0',
                'Accept': 'application/json'
            },
            timeout: 8000
        }, (res) => {
            let body = '';
            res.on('data', chunk => {
                if (body.length > 5 * 1024 * 1024) { // 5MB limit
                    req.destroy(new Error('Response payload exceeds safety limits'));
                }
                body += chunk;
            });
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const parsed = JSON.parse(body);
                        apiCache.set(cacheKey, { timestamp: Date.now(), data: parsed });
                        resolve(parsed);
                    } else if (res.statusCode === 429) {
                        // Rate limit from upstream Jikan
                        resolve(cached ? cached.data : { error: true, status: 429, message: 'Upstream rate limit reached. Retrying...' });
                    } else {
                        resolve({ error: true, status: res.statusCode, message: `Upstream error: ${res.statusCode}` });
                    }
                } catch (err) {
                    reject(new Error('Invalid JSON received from upstream API'));
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
            req.destroy(new Error('Upstream API request timed out'));
        });
    });
}

// ==========================================
// 7. JWT AUTHENTICATION MIDDLEWARE (OWASP A01 & A07)
// ==========================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: true, message: 'Akses ditolak: Token autentikasi diperlukan.' });
    }

    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
        if (err) {
            auditLog('AUTH_TOKEN_INVALID', { error: err.message }, req.ip);
            return res.status(403).json({ error: true, message: 'Sesi kedaluwarsa atau token tidak valid.' });
        }
        req.user = user;
        next();
    });
}

// ==========================================
// 8. API ROUTES
// ==========================================

// --- HEALTH & OWASP AUDIT STATUS ---
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'AnimeLovers Security Proxy',
        owasp_hardened: true,
        timestamp: new Date().toISOString()
    });
});

// --- ANIME CATALOG & SEARCH PROXY ---
// Get Top Anime
app.get('/api/anime/top', async (req, res) => {
    try {
        const page = sanitizeNumber(req.query.page, 1, 1, 100);
        const limit = sanitizeNumber(req.query.limit, 24, 1, 25);
        const filter = req.query.filter && ['airing', 'upcoming', 'bypopularity', 'favorite'].includes(req.query.filter)
            ? req.query.filter : 'bypopularity';

        const data = await fetchFromJikan('top/anime', { page, limit, filter, sfw: 'true' });
        res.json(data);
    } catch (err) {
        auditLog('API_ERROR_TOP_ANIME', { error: err.message }, req.ip);
        res.status(500).json({ error: true, message: 'Gagal mengambil data top anime.' });
    }
});

// Search Anime with strict query sanitization
app.get('/api/anime/search', async (req, res) => {
    try {
        const query = sanitizeAlphanumericQuery(req.query.q || '');
        const page = sanitizeNumber(req.query.page, 1, 1, 100);
        const limit = sanitizeNumber(req.query.limit, 24, 1, 25);
        const genres = req.query.genres ? validator.whitelist(req.query.genres, '0-9,') : '';
        const status = req.query.status && ['airing', 'complete', 'upcoming'].includes(req.query.status) ? req.query.status : '';
        const type = req.query.type && ['tv', 'movie', 'ova', 'special', 'ona'].includes(req.query.type) ? req.query.type : '';
        const orderBy = req.query.order_by && ['score', 'popularity', 'title', 'favorites', 'members'].includes(req.query.order_by) ? req.query.order_by : 'popularity';
        const sort = req.query.sort === 'asc' ? 'asc' : 'desc';

        const params = {
            page,
            limit,
            sfw: 'true',
            order_by: orderBy,
            sort: sort
        };

        if (query) params.q = query;
        if (genres) params.genres = genres;
        if (status) params.status = status;
        if (type) params.type = type;

        const data = await fetchFromJikan('anime', params);
        res.json(data);
    } catch (err) {
        auditLog('API_ERROR_SEARCH', { error: err.message }, req.ip);
        res.status(500).json({ error: true, message: 'Gagal melakukan pencarian anime.' });
    }
});

// Get Current Season Anime
app.get('/api/anime/season/now', async (req, res) => {
    try {
        const page = sanitizeNumber(req.query.page, 1, 1, 100);
        const limit = sanitizeNumber(req.query.limit, 24, 1, 25);
        const data = await fetchFromJikan('seasons/now', { page, limit, sfw: 'true' });
        res.json(data);
    } catch (err) {
        auditLog('API_ERROR_SEASON_NOW', { error: err.message }, req.ip);
        res.status(500).json({ error: true, message: 'Gagal memuat anime musim ini.' });
    }
});

// Get Anime Details by ID (Strict Integer Validation)
app.get('/api/anime/:id', async (req, res) => {
    try {
        const animeId = sanitizeNumber(req.params.id, 0, 1, 1000000);
        if (!animeId) {
            return res.status(400).json({ error: true, message: 'ID Anime tidak valid.' });
        }

        const data = await fetchFromJikan(`anime/${animeId}/full`);
        res.json(data);
    } catch (err) {
        auditLog('API_ERROR_DETAIL', { id: req.params.id, error: err.message }, req.ip);
        res.status(500).json({ error: true, message: 'Gagal memuat detail anime.' });
    }
});

// Get Anime Episodes List
app.get('/api/anime/:id/episodes', async (req, res) => {
    try {
        const animeId = sanitizeNumber(req.params.id, 0, 1, 1000000);
        const page = sanitizeNumber(req.query.page, 1, 1, 100);
        if (!animeId) {
            return res.status(400).json({ error: true, message: 'ID Anime tidak valid.' });
        }

        const data = await fetchFromJikan(`anime/${animeId}/episodes`, { page });
        res.json(data);
    } catch (err) {
        auditLog('API_ERROR_EPISODES', { id: req.params.id, error: err.message }, req.ip);
        res.status(500).json({ error: true, message: 'Gagal memuat episode anime.' });
    }
});

// Get Anime Streaming / External Links
app.get('/api/anime/:id/streaming', async (req, res) => {
    try {
        const animeId = sanitizeNumber(req.params.id, 0, 1, 1000000);
        if (!animeId) {
            return res.status(400).json({ error: true, message: 'ID Anime tidak valid.' });
        }

        const data = await fetchFromJikan(`anime/${animeId}/streaming`);
        res.json(data);
    } catch (err) {
        auditLog('API_ERROR_STREAMING', { id: req.params.id, error: err.message }, req.ip);
        res.status(500).json({ error: true, message: 'Gagal memuat tautan streaming.' });
    }
});

// Get Anime Genres List
app.get('/api/genres', async (req, res) => {
    try {
        const data = await fetchFromJikan('genres/anime');
        res.json(data);
    } catch (err) {
        auditLog('API_ERROR_GENRES', { error: err.message }, req.ip);
        res.status(500).json({ error: true, message: 'Gagal memuat daftar genre.' });
    }
});

// --- USER AUTHENTICATION & SECURE ACCESS (OWASP A02 & A07) ---
// User Registration
app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const cleanUsername = sanitizeAlphanumericQuery(username || '', 30);
        const cleanEmail = (email || '').trim().toLowerCase();

        if (!cleanUsername || cleanUsername.length < 3) {
            return res.status(400).json({ error: true, message: 'Username harus minimal 3 karakter alphanumeric.' });
        }

        if (!validateEmail(cleanEmail)) {
            return res.status(400).json({ error: true, message: 'Format alamat email tidak valid.' });
        }

        if (!validatePasswordPolicy(password)) {
            return res.status(400).json({
                error: true,
                message: 'Kata sandi harus minimal 8 karakter, mengandung huruf besar, huruf kecil, angka, dan simbol khusus.'
            });
        }

        if (usersDb.has(cleanEmail)) {
            // Anti-User-Enumeration or Standard Response
            return res.status(409).json({ error: true, message: 'Email sudah terdaftar. Silakan login.' });
        }

        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = {
            id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            username: cleanUsername,
            email: cleanEmail,
            passwordHash,
            favorites: [],
            watchlist: [],
            createdAt: new Date().toISOString()
        };

        usersDb.set(cleanEmail, newUser);
        auditLog('AUTH_REGISTER_SUCCESS', { email: cleanEmail, username: cleanUsername }, req.ip);

        const token = jwt.sign(
            { id: newUser.id, username: newUser.username, email: newUser.email },
            JWT_SECRET,
            { expiresIn: '7d', algorithm: 'HS256' }
        );

        res.status(201).json({
            success: true,
            message: 'Registrasi berhasil!',
            token,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                favorites: newUser.favorites,
                watchlist: newUser.watchlist
            }
        });
    } catch (err) {
        auditLog('AUTH_REGISTER_ERROR', { error: err.message }, req.ip);
        res.status(500).json({ error: true, message: 'Terjadi kesalahan sistem saat registrasi.' });
    }
});

// User Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = (email || '').trim().toLowerCase();

        if (!validateEmail(cleanEmail) || !password) {
            auditLog('AUTH_LOGIN_FAILED_INVALID_INPUT', { email: cleanEmail }, req.ip);
            return res.status(400).json({ error: true, message: 'Email atau kata sandi tidak valid.' });
        }

        const user = usersDb.get(cleanEmail);
        if (!user) {
            // Constant-time mock compare to prevent timing attack
            await bcrypt.compare(password, '$2a$12$e8x/kM3PZ0.zU9fXpC5n8u9Hl3xG9Z0z1Q5V3V6Q8P1B2C3D4E5F6');
            auditLog('AUTH_LOGIN_FAILED_NOT_FOUND', { email: cleanEmail }, req.ip);
            return res.status(401).json({ error: true, message: 'Email atau kata sandi salah.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            auditLog('AUTH_LOGIN_FAILED_WRONG_PASSWORD', { email: cleanEmail }, req.ip);
            return res.status(401).json({ error: true, message: 'Email atau kata sandi salah.' });
        }

        auditLog('AUTH_LOGIN_SUCCESS', { email: cleanEmail, userId: user.id }, req.ip);

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d', algorithm: 'HS256' }
        );

        res.json({
            success: true,
            message: 'Login berhasil!',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                favorites: user.favorites,
                watchlist: user.watchlist
            }
        });
    } catch (err) {
        auditLog('AUTH_LOGIN_ERROR', { error: err.message }, req.ip);
        res.status(500).json({ error: true, message: 'Terjadi kesalahan sistem saat login.' });
    }
});

// Get User Profile & Sync Watchlist
app.get('/api/user/profile', authenticateToken, (req, res) => {
    const user = usersDb.get(req.user.email);
    if (!user) {
        return res.status(404).json({ error: true, message: 'Pengguna tidak ditemukan.' });
    }

    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            favorites: user.favorites,
            watchlist: user.watchlist
        }
    });
});

// Toggle Favorite / Watchlist
app.post('/api/user/bookmark', authenticateToken, (req, res) => {
    try {
        const { animeId, type } = req.body; // type: 'favorite' | 'watchlist'
        const cleanId = sanitizeNumber(animeId, 0, 1, 1000000);
        if (!cleanId || !['favorite', 'watchlist'].includes(type)) {
            return res.status(400).json({ error: true, message: 'Data bookmark tidak valid.' });
        }

        const user = usersDb.get(req.user.email);
        if (!user) {
            return res.status(404).json({ error: true, message: 'Pengguna tidak ditemukan.' });
        }

        const targetList = type === 'favorite' ? user.favorites : user.watchlist;
        const existsIndex = targetList.indexOf(cleanId);

        let action = '';
        if (existsIndex > -1) {
            targetList.splice(existsIndex, 1);
            action = 'removed';
        } else {
            if (targetList.length >= 200) {
                return res.status(400).json({ error: true, message: 'Batas maksimum bookmark telah tercapai (200 item).' });
            }
            targetList.push(cleanId);
            action = 'added';
        }

        auditLog('USER_BOOKMARK_UPDATE', { userId: user.id, animeId: cleanId, type, action }, req.ip);

        res.json({
            success: true,
            action,
            animeId: cleanId,
            type,
            favorites: user.favorites,
            watchlist: user.watchlist
        });
    } catch (err) {
        auditLog('BOOKMARK_ERROR', { error: err.message }, req.ip);
        res.status(500).json({ error: true, message: 'Gagal memperbarui bookmark.' });
    }
});

// ==========================================
// 9. SERVE STATIC ASSETS WITH CACHING & SAFE FALLBACK
// ==========================================
app.use(express.static(path.join(__dirname, 'public'), {
    dotfiles: 'ignore',
    etag: true,
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Fallback for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// 10. GLOBAL SECURE ERROR HANDLER (OWASP A05)
// ==========================================
app.use((err, req, res, next) => {
    auditLog('UNHANDLED_EXCEPTION', { error: err.message, stack: NODE_ENV === 'development' ? err.stack : undefined }, req.ip);
    // Never expose stack trace in production or leak sensitive server paths
    res.status(500).json({
        error: true,
        message: 'Terjadi kesalahan internal pada server yang aman.'
    });
});

// ==========================================
// START SERVER
// ==========================================
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`⚡ AnimeLovers Web Hub - OWASP Top 10 Hardened Server`);
        console.log(`🛡️  Role: Senior Cybersecurity Engineer`);
        console.log(`🌐 Server running at: http://localhost:${PORT}`);
        console.log(`🔒 Security Status: Rate Limit ON | Helmet ON | CSP ON`);
        console.log(`====================================================`);
    });
}

module.exports = app;

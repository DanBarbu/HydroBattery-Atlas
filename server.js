/**
 * HydroBattery Atlas — Production Server
 * Serves the static site with security and cache headers.
 * Used by Render.com free-tier web service.
 */
const express = require('express');
const path    = require('path');
const app     = express();

const PORT = process.env.PORT || 8000;

// Security & cache headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Keep JS/CSS cached by version query-string; HTML always fresh
    if (req.path.endsWith('.html') || req.path === '/') {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    next();
});

// Serve everything from the project root as static files
app.use(express.static(path.join(__dirname), { index: 'index.html' }));

// SPA fallback — return index.html for any unknown path
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`HydroBattery Atlas running on port ${PORT}`);
});

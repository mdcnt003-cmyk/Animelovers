/**
 * AnimeLovers - Client-Side Security & Sanitization Module
 * OWASP Top 10 Compliant
 * Author: Senior Cybersecurity Engineer
 */

(function (window) {
    'use strict';

    const SecurityEngine = {
        /**
         * Escape all HTML special characters to prevent Reflected & Stored XSS (OWASP A03)
         * @param {string} str 
         * @returns {string}
         */
        escapeHtml: function (str) {
            if (str === null || str === undefined) return '';
            const stringified = String(str);
            const htmlMap = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '/': '&#x2F;',
                '`': '&#x60;',
                '=': '&#x3D;'
            };
            return stringified.replace(/[&<>"'`=\/]/g, (s) => htmlMap[s]);
        },

        /**
         * Sanitize string input: strip dangerous tags and script patterns
         * @param {string} input 
         * @param {number} maxLen 
         * @returns {string}
         */
        sanitizeString: function (input, maxLen = 250) {
            if (!input || typeof input !== 'string') return '';
            let cleaned = input.trim().slice(0, maxLen);
            // Strip null bytes and non-printable control characters
            cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            return this.escapeHtml(cleaned);
        },

        /**
         * Validate strictly if a URL is safe for navigation or image source (Prevents SSRF & Javascript execution)
         * @param {string} urlStr 
         * @returns {boolean}
         */
        isSafeUrl: function (urlStr) {
            if (!urlStr || typeof urlStr !== 'string') return false;
            const trimmed = urlStr.trim();
            // Disallow javascript:, data:, vbscript:, file:
            const dangerousProtocols = /^(javascript|vbscript|data|file):/i;
            if (dangerousProtocols.test(trimmed)) {
                return false;
            }
            try {
                const parsed = new URL(trimmed, window.location.origin);
                return ['http:', 'https:'].includes(parsed.protocol);
            } catch (e) {
                return false;
            }
        },

        /**
         * Verify and safely format Youtube Embed URL
         * @param {string} embedUrl 
         * @returns {string|null}
         */
        getSafeYoutubeEmbed: function (embedUrl) {
            if (!embedUrl || typeof embedUrl !== 'string') return null;
            try {
                const url = new URL(embedUrl);
                const allowedHosts = ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtu.be'];
                if (!allowedHosts.includes(url.hostname)) {
                    return null;
                }
                // Return secure youtube-nocookie version with sandboxed params
                let videoId = '';
                if (url.hostname === 'youtu.be') {
                    videoId = url.pathname.slice(1);
                } else if (url.pathname.startsWith('/embed/')) {
                    videoId = url.pathname.split('/embed/')[1];
                } else {
                    videoId = url.searchParams.get('v') || '';
                }

                videoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
                if (!videoId) return null;

                return `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1`;
            } catch (e) {
                return null;
            }
        },

        /**
         * Safe DOM text insertion - guaranteed immune to XSS
         * @param {HTMLElement} element 
         * @param {string} text 
         */
        safeSetText: function (element, text) {
            if (element && 'textContent' in element) {
                element.textContent = text === null || text === undefined ? '' : String(text);
            }
        },

        /**
         * Password strength analyzer for OWASP A07 Compliance
         * @param {string} password 
         * @returns {{ score: number, feedback: string[], isStrong: boolean }}
         */
        analyzePasswordStrength: function (password) {
            if (!password || typeof password !== 'string') {
                return { score: 0, feedback: ['Kata sandi tidak boleh kosong.'], isStrong: false };
            }

            const feedback = [];
            let score = 0;

            if (password.length >= 8) score += 25;
            else feedback.push('Minimal 8 karakter.');

            if (password.length >= 12) score += 15;

            if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
                score += 25;
            } else {
                feedback.push('Gunakan kombinasi huruf besar & kecil.');
            }

            if (/\d/.test(password)) {
                score += 20;
            } else {
                feedback.push('Sertakan setidaknya satu angka (0-9).');
            }

            if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
                score += 15;
            } else {
                feedback.push('Sertakan simbol khusus (!@#$%^&*).');
            }

            return {
                score: Math.min(score, 100),
                feedback,
                isStrong: score >= 80
            };
        },

        /**
         * Strict search input cleaner
         * @param {string} val 
         * @returns {string}
         */
        cleanSearchQuery: function (val) {
            if (!val || typeof val !== 'string') return '';
            return val.replace(/[^a-zA-Z0-9\s\-:']/g, '').trim().slice(0, 60);
        }
    };

    window.SecurityEngine = Object.freeze(SecurityEngine);
})(window);

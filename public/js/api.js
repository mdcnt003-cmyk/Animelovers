/**
 * AnimeLovers - Anime Catalog & Jikan v4 API Engine
 * Resilient proxy & direct fallback architecture
 * Author: Senior Cybersecurity Engineer
 */

(function (window) {
    'use strict';

    const DIRECT_JIKAN_BASE = 'https://api.jikan.moe/v4';
    const PROXY_API_BASE = '/api';

    // Client Cache to save bandwidth & prevent rate limiting (OWASP A04)
    const clientCache = new Map();
    const CACHE_LIFETIME = 5 * 60 * 1000; // 5 mins

    // Request queue & rate limiter for direct fallback
    let lastRequestTime = 0;
    const MIN_INTERVAL_MS = 350; // Max ~3 req/s for Jikan rate limit compliance

    async function waitThrottle() {
        const now = Date.now();
        const diff = now - lastRequestTime;
        if (diff < MIN_INTERVAL_MS) {
            await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - diff));
        }
        lastRequestTime = Date.now();
    }

    async function secureFetch(endpoint, params = {}) {
        const queryStr = new URLSearchParams(params).toString();
        const fullKey = `${endpoint}${queryStr ? '?' + queryStr : ''}`;

        // Check client cache
        const cached = clientCache.get(fullKey);
        if (cached && (Date.now() - cached.time < CACHE_LIFETIME)) {
            return cached.data;
        }

        // Try proxy first if hosted on server, otherwise direct Jikan
        const isServerEnv = window.location.protocol.startsWith('http') && !window.location.href.includes(':5500');
        let requestUrl = '';
        
        if (isServerEnv) {
            requestUrl = `${PROXY_API_BASE}/${endpoint}${queryStr ? '?' + queryStr : ''}`;
        } else {
            // Direct Jikan fallback
            await waitThrottle();
            const jikanPath = endpoint.replace(/^anime\//, 'anime/').replace(/^genres/, 'genres/anime');
            requestUrl = `${DIRECT_JIKAN_BASE}/${jikanPath}${queryStr ? '?' + queryStr : ''}`;
        }

        try {
            const token = window.AuthEngine ? window.AuthEngine.getToken() : null;
            const headers = { 'Accept': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(requestUrl, { headers });

            if (!res.ok) {
                // If proxy fails with 404/500, fallback to direct Jikan
                if (isServerEnv && res.status !== 429) {
                    await waitThrottle();
                    const directUrl = `${DIRECT_JIKAN_BASE}/${endpoint.replace(/^anime\//, 'anime/')}${queryStr ? '?' + queryStr : ''}`;
                    const directRes = await fetch(directUrl);
                    if (directRes.ok) {
                        const directData = await directRes.json();
                        clientCache.set(fullKey, { time: Date.now(), data: directData });
                        return directData;
                    }
                }
                throw new Error(`API Error: ${res.status}`);
            }

            const data = await res.json();
            clientCache.set(fullKey, { time: Date.now(), data });
            return data;
        } catch (err) {
            console.warn('[API Client Warning]', err.message);
            // Fallback to direct Jikan if proxy connection refused
            try {
                await waitThrottle();
                const directUrl = `${DIRECT_JIKAN_BASE}/${endpoint.replace(/^anime\//, 'anime/')}${queryStr ? '?' + queryStr : ''}`;
                const directRes = await fetch(directUrl);
                if (directRes.ok) {
                    const directData = await directRes.json();
                    clientCache.set(fullKey, { time: Date.now(), data: directData });
                    return directData;
                }
            } catch (fallbackErr) {
                console.error('[API Fallback Error]', fallbackErr);
            }
            return { data: [], error: true, message: 'Gagal memuat data anime dari jaringan.' };
        }
    }

    const AnimeAPI = {
        /**
         * Get top rated / most popular anime
         */
        getTopAnime: async function (page = 1, filter = 'bypopularity', limit = 24) {
            return await secureFetch('anime/top', { page, filter, limit, sfw: 'true' });
        },

        /**
         * Search anime with keyword & filters
         */
        searchAnime: async function (query = '', options = {}) {
            const cleanQ = window.SecurityEngine.cleanSearchQuery(query);
            const params = {
                page: options.page || 1,
                limit: options.limit || 24,
                sfw: 'true',
                order_by: options.orderBy || 'popularity',
                sort: options.sort || 'desc'
            };
            if (cleanQ) params.q = cleanQ;
            if (options.genres) params.genres = options.genres;
            if (options.status) params.status = options.status;
            if (options.type) params.type = options.type;

            return await secureFetch('anime/search', params);
        },

        /**
         * Get current season anime
         */
        getSeasonNow: async function (page = 1, limit = 24) {
            return await secureFetch('anime/season/now', { page, limit, sfw: 'true' });
        },

        /**
         * Get complete details of a specific anime
         */
        getAnimeDetails: async function (animeId) {
            const cleanId = parseInt(animeId, 10);
            if (isNaN(cleanId) || cleanId <= 0) return null;
            return await secureFetch(`anime/${cleanId}`);
        },

        /**
         * Get anime episodes list
         */
        getAnimeEpisodes: async function (animeId, page = 1) {
            const cleanId = parseInt(animeId, 10);
            if (isNaN(cleanId) || cleanId <= 0) return { data: [] };
            return await secureFetch(`anime/${cleanId}/episodes`, { page });
        },

        /**
         * Get anime streaming providers
         */
        getAnimeStreaming: async function (animeId) {
            const cleanId = parseInt(animeId, 10);
            if (isNaN(cleanId) || cleanId <= 0) return { data: [] };
            return await secureFetch(`anime/${cleanId}/streaming`);
        },

        /**
         * Get list of anime genres
         */
        getGenres: async function () {
            return await secureFetch('genres');
        }
    };

    window.AnimeAPI = Object.freeze(AnimeAPI);
})(window);

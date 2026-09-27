/**
 * AnimeLovers - Main Application Controller
 * High-End Glassmorphism UI & Resilient Architecture
 * Author: Senior Cybersecurity Engineer
 */

(function () {
    'use strict';

    // State Management
    const state = {
        currentTab: 'trending',
        currentPage: 1,
        hasNextPage: true,
        currentQuery: '',
        selectedGenre: '',
        selectedStatus: '',
        selectedType: '',
        selectedOrderBy: 'popularity',
        currentAnimeList: [],
        spotlightAnime: null,
        searchDebounceTimer: null
    };

    // DOM Elements
    const elements = {
        // Nav & Search
        navTabs: document.querySelectorAll('.nav-tab'),
        globalSearchInput: document.getElementById('globalSearchInput'),
        btnClearSearch: document.getElementById('btnClearSearch'),
        navLogo: document.getElementById('navLogo'),
        authWrapper: document.getElementById('authWrapper'),
        btnOpenLogin: document.getElementById('btnOpenLogin'),
        btnSecurityModal: document.getElementById('btnSecurityModal'),

        // Hero Spotlight
        heroSection: document.getElementById('heroSection'),
        heroGlassCard: document.getElementById('heroGlassCard'),
        heroBackdrop: document.getElementById('heroBackdrop'),
        heroStatus: document.getElementById('heroStatus'),
        heroScore: document.getElementById('heroScore'),
        heroTitle: document.getElementById('heroTitle'),
        heroSynopsis: document.getElementById('heroSynopsis'),
        heroGenres: document.getElementById('heroGenres'),
        btnHeroDetail: document.getElementById('btnHeroDetail'),
        btnHeroTrailer: document.getElementById('btnHeroTrailer'),
        btnHeroBookmark: document.getElementById('btnHeroBookmark'),

        // Filters
        filterGenre: document.getElementById('filterGenre'),
        filterStatus: document.getElementById('filterStatus'),
        filterType: document.getElementById('filterType'),
        filterOrderBy: document.getElementById('filterOrderBy'),
        btnResetFilters: document.getElementById('btnResetFilters'),
        genreChips: document.querySelectorAll('.genre-chip'),

        // Catalog
        sectionTitleText: document.getElementById('sectionTitleText'),
        catalogCount: document.getElementById('catalogCount'),
        animeGrid: document.getElementById('animeGrid'),
        btnPrevPage: document.getElementById('btnPrevPage'),
        btnNextPage: document.getElementById('btnNextPage'),
        currentPageNum: document.getElementById('currentPageNum'),

        // Detail Modal
        detailModalBackdrop: document.getElementById('detailModalBackdrop'),
        detailModal: document.getElementById('detailModal'),
        detailModalBody: document.getElementById('detailModalBody'),
        btnCloseDetailModal: document.getElementById('btnCloseDetailModal'),

        // Trailer Modal
        trailerModalBackdrop: document.getElementById('trailerModalBackdrop'),
        trailerContainer: document.getElementById('trailerContainer'),
        btnCloseTrailerModal: document.getElementById('btnCloseTrailerModal'),

        // Auth Modal
        authModalBackdrop: document.getElementById('authModalBackdrop'),
        btnCloseAuthModal: document.getElementById('btnCloseAuthModal'),
        authModalTitle: document.getElementById('authModalTitle'),
        authModalSubtitle: document.getElementById('authModalSubtitle'),
        tabBtnLogin: document.getElementById('tabBtnLogin'),
        tabBtnRegister: document.getElementById('tabBtnRegister'),
        loginForm: document.getElementById('loginForm'),
        registerForm: document.getElementById('registerForm'),
        authEmail: document.getElementById('authEmail'),
        authPassword: document.getElementById('authPassword'),
        authEmailError: document.getElementById('authEmailError'),
        authPasswordError: document.getElementById('authPasswordError'),
        toggleLoginPw: document.getElementById('toggleLoginPw'),
        rememberMe: document.getElementById('rememberMe'),
        regUsername: document.getElementById('regUsername'),
        regEmail: document.getElementById('regEmail'),
        regPassword: document.getElementById('regPassword'),
        regUsernameError: document.getElementById('regUsernameError'),
        regEmailError: document.getElementById('regEmailError'),
        regPasswordError: document.getElementById('regPasswordError'),
        toggleRegPw: document.getElementById('toggleRegPw'),
        pwStrengthFill: document.getElementById('pwStrengthFill'),
        pwStrengthLabel: document.getElementById('pwStrengthLabel'),

        // Security Telemetry Modal
        securityModalBackdrop: document.getElementById('securityModalBackdrop'),
        btnCloseSecurityModal: document.getElementById('btnCloseSecurityModal'),

        // Toast Container
        toastContainer: document.getElementById('toastContainer')
    };

    // ==========================================
    // NOTIFICATION TOAST HELPER
    // ==========================================
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const iconMap = {
            success: 'fa-circle-check',
            error: 'fa-circle-exclamation',
            info: 'fa-circle-info'
        };

        const icon = document.createElement('i');
        icon.className = `fa-solid ${iconMap[type] || 'fa-circle-info'}`;
        
        const textSpan = document.createElement('span');
        window.SecurityEngine.safeSetText(textSpan, message);

        toast.appendChild(icon);
        toast.appendChild(textSpan);
        elements.toastContainer.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3800);
    }

    // ==========================================
    // INITIALIZATION & EVENT LISTENERS
    // ==========================================
    async function init() {
        setupNavigation();
        setupSearch();
        setupFilters();
        setupAuthUI();
        setupModals();
        setupKeyboardShortcuts();
        renderAuthStatus();

        // Load genres list
        loadGenresList();

        // Initial Data Load
        await loadCatalogData();
    }

    // ==========================================
    // NAVIGATION CONTROLLER
    // ==========================================
    function setupNavigation() {
        elements.navTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                if (state.currentTab === targetTab && targetTab !== 'watchlist') return;

                elements.navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                state.currentTab = targetTab;
                state.currentPage = 1;

                if (targetTab === 'watchlist') {
                    elements.heroSection.style.display = 'none';
                    elements.sectionTitleText.textContent = 'Koleksi Serial Saya';
                    loadWatchlistData();
                } else {
                    elements.heroSection.style.display = 'block';
                    if (targetTab === 'trending') {
                        elements.sectionTitleText.textContent = 'Serial Anime Terpopuler';
                    } else if (targetTab === 'season') {
                        elements.sectionTitleText.textContent = 'Anime Musim Ini (Airing)';
                    } else if (targetTab === 'all') {
                        elements.sectionTitleText.textContent = 'Eksplorasi Seluruh Serial Anime';
                    }
                    loadCatalogData();
                }
            });
        });

        elements.navLogo.addEventListener('click', (e) => {
            e.preventDefault();
            resetAllFilters();
            elements.navTabs[0].click();
        });

        // Pagination buttons
        elements.btnPrevPage.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                loadCatalogData();
                window.scrollTo({ top: elements.animeGrid.offsetTop - 100, behavior: 'smooth' });
            }
        });

        elements.btnNextPage.addEventListener('click', () => {
            if (state.hasNextPage) {
                state.currentPage++;
                loadCatalogData();
                window.scrollTo({ top: elements.animeGrid.offsetTop - 100, behavior: 'smooth' });
            }
        });
    }

    // ==========================================
    // SEARCH & FILTER SYSTEM
    // ==========================================
    function setupSearch() {
        elements.globalSearchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            elements.btnClearSearch.style.display = query ? 'block' : 'none';

            clearTimeout(state.searchDebounceTimer);
            state.searchDebounceTimer = setTimeout(() => {
                state.currentQuery = query.trim();
                state.currentPage = 1;
                elements.sectionTitleText.textContent = state.currentQuery
                    ? `Hasil Pencarian: "${state.currentQuery}"`
                    : 'Serial Anime Terpopuler';
                loadCatalogData();
            }, 350);
        });

        elements.btnClearSearch.addEventListener('click', () => {
            elements.globalSearchInput.value = '';
            elements.btnClearSearch.style.display = 'none';
            state.currentQuery = '';
            state.currentPage = 1;
            elements.sectionTitleText.textContent = 'Serial Anime Terpopuler';
            loadCatalogData();
        });
    }

    function setupFilters() {
        // Genre Chips
        elements.genreChips.forEach(chip => {
            chip.addEventListener('click', () => {
                elements.genreChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                const genreId = chip.dataset.genreId;
                state.selectedGenre = genreId;
                elements.filterGenre.value = genreId;
                state.currentPage = 1;
                loadCatalogData();
            });
        });

        // Select Filters
        elements.filterGenre.addEventListener('change', (e) => {
            state.selectedGenre = e.target.value;
            // Sync chips
            elements.genreChips.forEach(chip => {
                chip.classList.toggle('active', chip.dataset.genreId === state.selectedGenre);
            });
            state.currentPage = 1;
            loadCatalogData();
        });

        elements.filterStatus.addEventListener('change', (e) => {
            state.selectedStatus = e.target.value;
            state.currentPage = 1;
            loadCatalogData();
        });

        elements.filterType.addEventListener('change', (e) => {
            state.selectedType = e.target.value;
            state.currentPage = 1;
            loadCatalogData();
        });

        elements.filterOrderBy.addEventListener('change', (e) => {
            state.selectedOrderBy = e.target.value;
            state.currentPage = 1;
            loadCatalogData();
        });

        elements.btnResetFilters.addEventListener('click', resetAllFilters);
    }

    function resetAllFilters() {
        state.selectedGenre = '';
        state.selectedStatus = '';
        state.selectedType = '';
        state.selectedOrderBy = 'popularity';
        state.currentQuery = '';
        state.currentPage = 1;

        elements.globalSearchInput.value = '';
        elements.btnClearSearch.style.display = 'none';
        elements.filterGenre.value = '';
        elements.filterStatus.value = '';
        elements.filterType.value = '';
        elements.filterOrderBy.value = 'popularity';

        elements.genreChips.forEach(chip => chip.classList.toggle('active', chip.dataset.genreId === ''));
        loadCatalogData();
    }

    async function loadGenresList() {
        try {
            const genresRes = await window.AnimeAPI.getGenres();
            if (genresRes && genresRes.data && Array.isArray(genresRes.data)) {
                genresRes.data.forEach(genre => {
                    const opt = document.createElement('option');
                    opt.value = genre.mal_id;
                    opt.textContent = genre.name;
                    elements.filterGenre.appendChild(opt);
                });
            }
        } catch (e) {
            console.warn('Could not load genres list:', e);
        }
    }

    // ==========================================
    // DATA LOADER & RENDERER
    // ==========================================
    async function loadCatalogData() {
        showSkeletons();
        elements.currentPageNum.textContent = state.currentPage;
        elements.btnPrevPage.disabled = state.currentPage <= 1;

        let response;
        try {
            if (state.currentQuery || state.selectedGenre || state.selectedStatus || state.selectedType || state.selectedOrderBy !== 'popularity') {
                response = await window.AnimeAPI.searchAnime(state.currentQuery, {
                    page: state.currentPage,
                    genres: state.selectedGenre,
                    status: state.selectedStatus,
                    type: state.selectedType,
                    orderBy: state.selectedOrderBy
                });
            } else if (state.currentTab === 'season') {
                response = await window.AnimeAPI.getSeasonNow(state.currentPage);
            } else {
                response = await window.AnimeAPI.getTopAnime(state.currentPage, 'bypopularity');
            }

            const animeList = (response && response.data) || [];
            state.currentAnimeList = animeList;
            state.hasNextPage = response && response.pagination ? response.pagination.has_next_page : false;
            elements.btnNextPage.disabled = !state.hasNextPage;

            // Update Spotlight on first page
            if (state.currentPage === 1 && animeList.length > 0 && !state.currentQuery) {
                setHeroSpotlight(animeList[0]);
            }

            renderAnimeGrid(animeList);
            elements.catalogCount.textContent = `${animeList.length} Serial Ditampilkan`;
        } catch (err) {
            console.error('Catalog load error:', err);
            elements.animeGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: var(--accent-red); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-secondary);">Gagal memuat serial anime. Silakan periksa koneksi atau coba beberapa saat lagi.</p>
                </div>
            `;
        }
    }

    async function loadWatchlistData() {
        showSkeletons();
        const bookmarkedIds = window.AuthEngine.getBookmarks('favorite')
            .concat(window.AuthEngine.getBookmarks('watchlist'));
        
        const uniqueIds = [...new Set(bookmarkedIds)];

        if (uniqueIds.length === 0) {
            elements.animeGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 4rem;">
                    <i class="fa-regular fa-bookmark" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem;">Belum ada serial tersimpan</h3>
                    <p style="color: var(--text-secondary);">Klik ikon hati atau bookmark pada anime favorit Anda untuk menyimpannya di sini.</p>
                </div>
            `;
            elements.catalogCount.textContent = '0 Serial';
            elements.btnPrevPage.disabled = true;
            elements.btnNextPage.disabled = true;
            return;
        }

        elements.catalogCount.textContent = `${uniqueIds.length} Serial Tersimpan`;
        elements.btnPrevPage.disabled = true;
        elements.btnNextPage.disabled = true;

        // Fetch details for each saved ID
        const results = [];
        for (const id of uniqueIds.slice(0, 24)) {
            try {
                const detail = await window.AnimeAPI.getAnimeDetails(id);
                if (detail && detail.data) {
                    results.push(detail.data);
                }
            } catch (e) {
                console.warn(`Could not load saved anime ${id}`);
            }
        }

        renderAnimeGrid(results);
    }

    function showSkeletons() {
        elements.animeGrid.innerHTML = Array(8).fill('<div class="anime-card skeleton-card"></div>').join('');
    }

    // ==========================================
    // HERO SPOTLIGHT BANNER
    // ==========================================
    function setHeroSpotlight(anime) {
        if (!anime) return;
        state.spotlightAnime = anime;

        const title = anime.title_english || anime.title || 'Serial Anime Populer';
        const synopsis = anime.synopsis || 'Sinopsis resmi belum tersedia untuk serial ini.';
        const score = anime.score ? anime.score.toFixed(2) : 'N/A';
        const status = anime.status || 'Ongoing';
        const backdropImg = (anime.images && anime.images.webp && anime.images.webp.large_image_url) || (anime.images && anime.images.jpg && anime.images.jpg.large_image_url) || '';

        elements.heroTitle.textContent = title;
        elements.heroSynopsis.textContent = synopsis;
        elements.heroScore.innerHTML = `<i class="fa-solid fa-star"></i> ${score}`;
        elements.heroStatus.textContent = status;

        if (backdropImg && window.SecurityEngine.isSafeUrl(backdropImg)) {
            elements.heroBackdrop.style.backgroundImage = `url('${backdropImg}')`;
        }

        // Genres
        elements.heroGenres.innerHTML = '';
        if (anime.genres && Array.isArray(anime.genres)) {
            anime.genres.forEach(g => {
                const span = document.createElement('span');
                span.className = 'genre-tag';
                span.textContent = g.name;
                elements.heroGenres.appendChild(span);
            });
        }

        // Button events
        elements.btnHeroDetail.onclick = () => openDetailModal(anime.mal_id);
        elements.btnHeroTrailer.onclick = () => {
            if (anime.trailer && anime.trailer.embed_url) {
                openTrailerModal(anime.trailer.embed_url);
            } else {
                showToast('Trailer resmi tidak tersedia untuk judul ini.', 'info');
            }
        };

        const isFav = window.AuthEngine.isBookmarked(anime.mal_id, 'favorite');
        elements.btnHeroBookmark.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-bookmark"></i>`;
        elements.btnHeroBookmark.onclick = async () => {
            const added = await window.AuthEngine.toggleBookmark(anime.mal_id, 'favorite');
            elements.btnHeroBookmark.innerHTML = `<i class="fa-${added ? 'solid' : 'regular'} fa-bookmark"></i>`;
            showToast(added ? `Ditambahkan ke Favorit: ${title}` : `Dihapus dari Favorit`, added ? 'success' : 'info');
        };
    }

    // ==========================================
    // RENDER ANIME GRID (OWASP A03 Sanitized DOM)
    // ==========================================
    function renderAnimeGrid(animeList) {
        elements.animeGrid.innerHTML = '';

        if (!animeList || animeList.length === 0) {
            elements.animeGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 4rem;">
                    <i class="fa-solid fa-film" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem;">Tidak Ada Serial Ditemukan</h3>
                    <p style="color: var(--text-secondary);">Coba sesuaikan kata kunci pencarian atau reset filter.</p>
                </div>
            `;
            return;
        }

        animeList.forEach(anime => {
            const card = document.createElement('div');
            card.className = 'anime-card';
            card.tabIndex = 0;

            const malId = parseInt(anime.mal_id, 10);
            const title = anime.title_english || anime.title || 'Judul Anime';
            const imgUrl = (anime.images && anime.images.webp && anime.images.webp.large_image_url) 
                        || (anime.images && anime.images.jpg && anime.images.jpg.image_url) 
                        || '';
            const score = anime.score ? anime.score.toFixed(1) : '-';
            const format = anime.type || 'TV';
            const episodes = anime.episodes ? `${anime.episodes} Ep` : (anime.status === 'Currently Airing' ? 'Ongoing' : '?');
            const seasonYear = (anime.season ? anime.season.toUpperCase() + ' ' : '') + (anime.year || '');

            const isFav = window.AuthEngine.isBookmarked(malId, 'favorite');

            // Build Card Structure Safely
            const posterWrapper = document.createElement('div');
            posterWrapper.className = 'card-poster-wrapper';

            const posterImg = document.createElement('img');
            posterImg.className = 'card-poster';
            posterImg.alt = title;
            posterImg.loading = 'lazy';
            if (window.SecurityEngine.isSafeUrl(imgUrl)) {
                posterImg.src = imgUrl;
            }

            const posterOverlay = document.createElement('div');
            posterOverlay.className = 'card-poster-overlay';

            const badgesTop = document.createElement('div');
            badgesTop.className = 'card-badges-top';

            const badgeFormat = document.createElement('span');
            badgeFormat.className = 'badge-format';
            badgeFormat.textContent = format;

            const badgeRating = document.createElement('span');
            badgeRating.className = 'badge-rating';
            badgeRating.innerHTML = `<i class="fa-solid fa-star"></i> ${score}`;

            badgesTop.appendChild(badgeFormat);
            badgesTop.appendChild(badgeRating);

            // Favorite button
            const btnFav = document.createElement('button');
            btnFav.type = 'button';
            btnFav.className = `btn-card-fav ${isFav ? 'active' : ''}`;
            btnFav.setAttribute('aria-label', `Favoritkan ${title}`);
            btnFav.innerHTML = `<i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>`;

            btnFav.addEventListener('click', async (e) => {
                e.stopPropagation();
                const added = await window.AuthEngine.toggleBookmark(malId, 'favorite');
                btnFav.classList.toggle('active', added);
                btnFav.innerHTML = `<i class="fa-${added ? 'solid' : 'regular'} fa-heart"></i>`;
                showToast(added ? `Tersimpan di Favorit: ${title}` : `Dihapus dari Favorit`, added ? 'success' : 'info');
            });

            posterWrapper.appendChild(posterImg);
            posterWrapper.appendChild(posterOverlay);
            posterWrapper.appendChild(badgesTop);
            posterWrapper.appendChild(btnFav);

            // Details section
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'card-details';

            const titleH4 = document.createElement('h4');
            titleH4.className = 'card-title';
            window.SecurityEngine.safeSetText(titleH4, title);

            const metaDiv = document.createElement('div');
            metaDiv.className = 'card-meta';

            const epSpan = document.createElement('span');
            epSpan.className = 'card-episodes';
            epSpan.innerHTML = `<i class="fa-solid fa-circle-play"></i> ${episodes}`;

            const seasonSpan = document.createElement('span');
            seasonSpan.className = 'card-season';
            seasonSpan.textContent = seasonYear;

            metaDiv.appendChild(epSpan);
            metaDiv.appendChild(seasonSpan);

            detailsDiv.appendChild(titleH4);
            detailsDiv.appendChild(metaDiv);

            card.appendChild(posterWrapper);
            card.appendChild(detailsDiv);

            // Open Detail Modal on Card Click
            card.addEventListener('click', () => openDetailModal(malId));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') openDetailModal(malId);
            });

            elements.animeGrid.appendChild(card);
        });
    }

    // ==========================================
    // DETAIL MODAL LOGIC
    // ==========================================
    async function openDetailModal(animeId) {
        elements.detailModalBody.innerHTML = `
            <div style="text-align: center; padding: 4rem;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.5rem; color: var(--primary-cyan); margin-bottom: 1rem;"></i>
                <p>Mengambil data lengkap serial anime...</p>
            </div>
        `;
        elements.detailModalBackdrop.classList.add('show');
        elements.detailModalBackdrop.setAttribute('aria-hidden', 'false');

        try {
            const [detailRes, episodesRes, streamingRes] = await Promise.all([
                window.AnimeAPI.getAnimeDetails(animeId),
                window.AnimeAPI.getAnimeEpisodes(animeId),
                window.AnimeAPI.getAnimeStreaming(animeId)
            ]);

            const anime = (detailRes && detailRes.data) || null;
            if (!anime) throw new Error('Data anime tidak ditemukan.');

            const episodes = (episodesRes && episodesRes.data) || [];
            const streamLinks = (streamingRes && streamingRes.data) || [];

            renderDetailModalContent(anime, episodes, streamLinks);
        } catch (err) {
            console.error('Modal detail fetch failed:', err);
            elements.detailModalBody.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; color: var(--accent-red); margin-bottom: 1rem;"></i>
                    <p>Gagal memuat detail serial anime. Coba lagi nanti.</p>
                </div>
            `;
        }
    }

    function renderDetailModalContent(anime, episodes, streaming) {
        const title = anime.title_english || anime.title || 'Serial Anime';
        const jTitle = anime.title_japanese || '';
        const imgUrl = (anime.images && anime.images.webp && anime.images.webp.large_image_url) 
                    || (anime.images && anime.images.jpg && anime.images.large_image_url) 
                    || '';
        const score = anime.score ? anime.score.toFixed(2) : 'N/A';
        const rank = anime.rank ? `#${anime.rank}` : '-';
        const popularity = anime.popularity ? `#${anime.popularity}` : '-';
        const status = anime.status || '-';
        const type = anime.type || '-';
        const duration = anime.duration || '-';
        const rating = anime.rating || 'Semua Umur';
        const studios = (anime.studios && anime.studios.map(s => s.name).join(', ')) || 'Tidak Diketahui';
        const synopsis = anime.synopsis || 'Sinopsis belum tersedia.';

        const isFav = window.AuthEngine.isBookmarked(anime.mal_id, 'favorite');
        const isWatch = window.AuthEngine.isBookmarked(anime.mal_id, 'watchlist');

        elements.detailModalBody.innerHTML = `
            <div class="detail-header-flex">
                <div class="detail-poster-wrapper">
                    <img src="${window.SecurityEngine.isSafeUrl(imgUrl) ? imgUrl : ''}" alt="${window.SecurityEngine.sanitizeString(title)}" class="detail-poster">
                </div>
                <div class="detail-info-col">
                    <div class="detail-titles-block">
                        <h2>${window.SecurityEngine.sanitizeString(title)}</h2>
                        <div class="detail-alt-title">${window.SecurityEngine.sanitizeString(jTitle)}</div>
                    </div>

                    <div class="detail-meta-grid">
                        <div class="meta-box"><span class="meta-box-label">Skor MAL</span><span class="meta-box-val" style="color: var(--accent-gold);"><i class="fa-solid fa-star"></i> ${score}</span></div>
                        <div class="meta-box"><span class="meta-box-label">Peringkat</span><span class="meta-box-val">${rank}</span></div>
                        <div class="meta-box"><span class="meta-box-label">Popularitas</span><span class="meta-box-val">${popularity}</span></div>
                        <div class="meta-box"><span class="meta-box-label">Format</span><span class="meta-box-val">${type}</span></div>
                        <div class="meta-box"><span class="meta-box-label">Status</span><span class="meta-box-val">${status}</span></div>
                        <div class="meta-box"><span class="meta-box-label">Studio</span><span class="meta-box-val">${window.SecurityEngine.sanitizeString(studios)}</span></div>
                        <div class="meta-box"><span class="meta-box-label">Durasi</span><span class="meta-box-val">${window.SecurityEngine.sanitizeString(duration)}</span></div>
                        <div class="meta-box"><span class="meta-box-label">Rating Usia</span><span class="meta-box-val">${window.SecurityEngine.sanitizeString(rating)}</span></div>
                    </div>

                    <div class="detail-actions">
                        ${anime.trailer && anime.trailer.embed_url ? `
                            <button class="btn-neon-cta" id="btnModalPlayTrailer">
                                <i class="fa-solid fa-play"></i> Putar Trailer Resmi
                            </button>
                        ` : ''}
                        <button class="btn-glass-secondary" id="btnModalToggleFav">
                            <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i> ${isFav ? 'Favorit' : 'Tambah Favorit'}
                        </button>
                        <button class="btn-glass-secondary" id="btnModalToggleWatch">
                            <i class="fa-${isWatch ? 'solid' : 'regular'} fa-bookmark"></i> ${isWatch ? 'Watchlist' : 'Tambah Watchlist'}
                        </button>
                    </div>
                </div>
            </div>

            <div class="detail-section-block">
                <h3><i class="fa-solid fa-book-open"></i> Sinopsis Cerita</h3>
                <p class="synopsis-text">${window.SecurityEngine.sanitizeString(synopsis)}</p>
            </div>

            ${streaming.length > 0 ? `
                <div class="detail-section-block">
                    <h3><i class="fa-solid fa-tv"></i> Platform Streaming Resmi</h3>
                    <div class="streaming-providers">
                        ${streaming.map(s => {
                            if (window.SecurityEngine.isSafeUrl(s.url)) {
                                return `<a href="${s.url}" target="_blank" rel="noopener noreferrer" class="stream-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${window.SecurityEngine.sanitizeString(s.name)}</a>`;
                            }
                            return '';
                        }).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="detail-section-block">
                <h3><i class="fa-solid fa-list-ol"></i> Daftar Episode (${episodes.length || anime.episodes || '?'})</h3>
                <div class="episodes-grid">
                    ${episodes.length > 0 ? episodes.map(ep => `
                        <div class="episode-item">
                            <span><strong>Ep ${ep.mal_id}:</strong> ${window.SecurityEngine.sanitizeString(ep.title || 'Episode ' + ep.mal_id, 35)}</span>
                            <i class="fa-regular fa-circle-play" style="color: var(--primary-cyan);"></i>
                        </div>
                    `).join('') : '<p style="color: var(--text-muted); font-size: 0.85rem;">Informasi rincian judul episode sedang dimuat dari server resmi.</p>'}
                </div>
            </div>
        `;

        // Event hooks in modal
        const playBtn = document.getElementById('btnModalPlayTrailer');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                openTrailerModal(anime.trailer.embed_url);
            });
        }

        const favBtn = document.getElementById('btnModalToggleFav');
        if (favBtn) {
            favBtn.addEventListener('click', async () => {
                const added = await window.AuthEngine.toggleBookmark(anime.mal_id, 'favorite');
                favBtn.innerHTML = `<i class="fa-${added ? 'solid' : 'regular'} fa-heart"></i> ${added ? 'Favorit' : 'Tambah Favorit'}`;
                showToast(added ? `Ditambahkan ke Favorit` : `Dihapus dari Favorit`, added ? 'success' : 'info');
            });
        }

        const watchBtn = document.getElementById('btnModalToggleWatch');
        if (watchBtn) {
            watchBtn.addEventListener('click', async () => {
                const added = await window.AuthEngine.toggleBookmark(anime.mal_id, 'watchlist');
                watchBtn.innerHTML = `<i class="fa-${added ? 'solid' : 'regular'} fa-bookmark"></i> ${added ? 'Watchlist' : 'Tambah Watchlist'}`;
                showToast(added ? `Ditambahkan ke Watchlist` : `Dihapus dari Watchlist`, added ? 'success' : 'info');
            });
        }
    }

    // ==========================================
    // TRAILER VIDEO MODAL (Sandboxed)
    // ==========================================
    function openTrailerModal(embedUrl) {
        const safeEmbed = window.SecurityEngine.getSafeYoutubeEmbed(embedUrl);
        if (!safeEmbed) {
            showToast('Tautan trailer tidak memenuhi standar keamanan sandboxing.', 'error');
            return;
        }

        elements.trailerContainer.innerHTML = `
            <iframe 
                src="${safeEmbed}" 
                title="Anime Trailer Video" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                sandbox="allow-scripts allow-same-origin allow-presentation" 
                allowfullscreen
            ></iframe>
        `;

        elements.trailerModalBackdrop.classList.add('show');
        elements.trailerModalBackdrop.setAttribute('aria-hidden', 'false');
    }

    function closeTrailerModal() {
        elements.trailerContainer.innerHTML = '';
        elements.trailerModalBackdrop.classList.remove('show');
        elements.trailerModalBackdrop.setAttribute('aria-hidden', 'true');
    }

    // ==========================================
    // MODALS CONTROLLER & SHORTCUTS
    // ==========================================
    function setupModals() {
        // Close detail
        elements.btnCloseDetailModal.addEventListener('click', () => {
            elements.detailModalBackdrop.classList.remove('show');
            elements.detailModalBackdrop.setAttribute('aria-hidden', 'true');
        });
        elements.detailModalBackdrop.addEventListener('click', (e) => {
            if (e.target === elements.detailModalBackdrop) {
                elements.detailModalBackdrop.classList.remove('show');
            }
        });

        // Close trailer
        elements.btnCloseTrailerModal.addEventListener('click', closeTrailerModal);
        elements.trailerModalBackdrop.addEventListener('click', (e) => {
            if (e.target === elements.trailerModalBackdrop) closeTrailerModal();
        });

        // Auth Modal open/close
        elements.btnOpenLogin.addEventListener('click', () => {
            elements.authModalBackdrop.classList.add('show');
            elements.authModalBackdrop.setAttribute('aria-hidden', 'false');
        });
        elements.btnCloseAuthModal.addEventListener('click', () => {
            elements.authModalBackdrop.classList.remove('show');
            elements.authModalBackdrop.setAttribute('aria-hidden', 'true');
        });
        elements.authModalBackdrop.addEventListener('click', (e) => {
            if (e.target === elements.authModalBackdrop) {
                elements.authModalBackdrop.classList.remove('show');
            }
        });

        // Security Telemetry Modal
        elements.btnSecurityModal.addEventListener('click', () => {
            elements.securityModalBackdrop.classList.add('show');
            elements.securityModalBackdrop.setAttribute('aria-hidden', 'false');
        });
        elements.btnCloseSecurityModal.addEventListener('click', () => {
            elements.securityModalBackdrop.classList.remove('show');
            elements.securityModalBackdrop.setAttribute('aria-hidden', 'true');
        });
        elements.securityModalBackdrop.addEventListener('click', (e) => {
            if (e.target === elements.securityModalBackdrop) {
                elements.securityModalBackdrop.classList.remove('show');
            }
        });
    }

    function setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            // Escape to close open modal
            if (e.key === 'Escape') {
                elements.detailModalBackdrop.classList.remove('show');
                elements.authModalBackdrop.classList.remove('show');
                elements.securityModalBackdrop.classList.remove('show');
                closeTrailerModal();
            }
            // '/' to focus search
            if (e.key === '/' && document.activeElement !== elements.globalSearchInput) {
                e.preventDefault();
                elements.globalSearchInput.focus();
            }
        });
    }

    // ==========================================
    // AUTHENTICATION UI & FORMS
    // ==========================================
    function setupAuthUI() {
        // Switch between Login & Register tabs
        elements.tabBtnLogin.addEventListener('click', () => {
            elements.tabBtnLogin.classList.add('active');
            elements.tabBtnRegister.classList.remove('active');
            elements.loginForm.style.display = 'flex';
            elements.registerForm.style.display = 'none';
            elements.authModalTitle.textContent = 'Masuk ke AnimeLovers';
            elements.authModalSubtitle.textContent = 'Akses watchlist terenkripsi & sinkronisasi serial favorit Anda.';
        });

        elements.tabBtnRegister.addEventListener('click', () => {
            elements.tabBtnRegister.classList.add('active');
            elements.tabBtnLogin.classList.remove('active');
            elements.loginForm.style.display = 'none';
            elements.registerForm.style.display = 'flex';
            elements.authModalTitle.textContent = 'Daftar Akun Baru';
            elements.authModalSubtitle.textContent = 'Buat akun dengan enkripsi kuat standar OWASP.';
        });

        // Password toggles
        elements.toggleLoginPw.addEventListener('click', () => {
            const isPw = elements.authPassword.type === 'password';
            elements.authPassword.type = isPw ? 'text' : 'password';
            elements.toggleLoginPw.innerHTML = `<i class="fa-regular fa-eye${isPw ? '-slash' : ''}"></i>`;
        });

        elements.toggleRegPw.addEventListener('click', () => {
            const isPw = elements.regPassword.type === 'password';
            elements.regPassword.type = isPw ? 'text' : 'password';
            elements.toggleRegPw.innerHTML = `<i class="fa-regular fa-eye${isPw ? '-slash' : ''}"></i>`;
        });

        // Realtime Password Strength Meter on Register
        elements.regPassword.addEventListener('input', (e) => {
            const res = window.SecurityEngine.analyzePasswordStrength(e.target.value);
            elements.pwStrengthFill.style.width = `${res.score}%`;

            if (res.score < 40) {
                elements.pwStrengthFill.style.backgroundColor = 'var(--accent-red)';
                elements.pwStrengthLabel.textContent = 'Sangat Lemah';
                elements.pwStrengthLabel.style.color = 'var(--accent-red)';
            } else if (res.score < 80) {
                elements.pwStrengthFill.style.backgroundColor = 'var(--accent-gold)';
                elements.pwStrengthLabel.textContent = 'Sedang';
                elements.pwStrengthLabel.style.color = 'var(--accent-gold)';
            } else {
                elements.pwStrengthFill.style.backgroundColor = 'var(--accent-green)';
                elements.pwStrengthLabel.textContent = 'Kuat & Aman';
                elements.pwStrengthLabel.style.color = 'var(--accent-green)';
            }
        });

        // Login Form Submission
        elements.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            elements.authEmailError.textContent = '';
            elements.authPasswordError.textContent = '';

            const email = elements.authEmail.value.trim();
            const password = elements.authPassword.value;
            const remember = elements.rememberMe.checked;

            if (!email) {
                elements.authEmailError.textContent = 'Email wajib diisi.';
                return;
            }
            if (!password) {
                elements.authPasswordError.textContent = 'Kata sandi wajib diisi.';
                return;
            }

            const btn = document.getElementById('btnSubmitLogin');
            const origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Memverifikasi...</span>`;

            const res = await window.AuthEngine.login(email, password, remember);

            btn.disabled = false;
            btn.innerHTML = origHtml;

            if (res.success) {
                showToast(`Selamat datang kembali, ${res.user.username}!`, 'success');
                elements.authModalBackdrop.classList.remove('show');
                renderAuthStatus();
            } else {
                elements.authPasswordError.textContent = res.message;
                showToast(res.message, 'error');
            }
        });

        // Register Form Submission
        elements.registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            elements.regUsernameError.textContent = '';
            elements.regEmailError.textContent = '';
            elements.regPasswordError.textContent = '';

            const username = elements.regUsername.value.trim();
            const email = elements.regEmail.value.trim();
            const password = elements.regPassword.value;

            if (!username) {
                elements.regUsernameError.textContent = 'Username wajib diisi.';
                return;
            }
            if (!email) {
                elements.regEmailError.textContent = 'Email wajib diisi.';
                return;
            }

            const btn = document.getElementById('btnSubmitRegister');
            const origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Mendaftarkan...</span>`;

            const res = await window.AuthEngine.register(username, email, password);

            btn.disabled = false;
            btn.innerHTML = origHtml;

            if (res.success) {
                showToast(`Akun berhasil dibuat! Selamat datang, ${res.user.username}`, 'success');
                elements.authModalBackdrop.classList.remove('show');
                renderAuthStatus();
            } else {
                elements.regPasswordError.textContent = res.message;
                showToast(res.message, 'error');
            }
        });

        // Listen to global auth state changes
        window.addEventListener('animelovers:auth-change', renderAuthStatus);
    }

    function renderAuthStatus() {
        const user = window.AuthEngine.getCurrentUser();
        if (user && window.AuthEngine.isLoggedIn()) {
            const initial = (user.username || 'U').charAt(0).toUpperCase();
            elements.authWrapper.innerHTML = `
                <div class="user-menu-pill">
                    <div class="user-avatar-small">${initial}</div>
                    <span>${window.SecurityEngine.sanitizeString(user.username, 14)}</span>
                    <button class="btn-logout-mini" id="btnLogout" title="Keluar dari Akun">
                        <i class="fa-solid fa-right-from-bracket"></i>
                    </button>
                </div>
            `;
            document.getElementById('btnLogout').addEventListener('click', () => {
                window.AuthEngine.logout();
                showToast('Anda telah keluar dari akun.', 'info');
                renderAuthStatus();
            });
        } else {
            elements.authWrapper.innerHTML = `
                <button class="btn-glass-primary" id="btnOpenLoginDynamic">
                    <i class="fa-solid fa-arrow-right-to-bracket"></i>
                    <span>Masuk</span>
                </button>
            `;
            document.getElementById('btnOpenLoginDynamic').addEventListener('click', () => {
                elements.authModalBackdrop.classList.add('show');
            });
        }
    }

    // Initialize on DOM Ready
    document.addEventListener('DOMContentLoaded', init);
})();

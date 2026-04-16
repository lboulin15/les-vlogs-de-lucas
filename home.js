// ============================================================
// home.js — V3 avec recherche, continuer à regarder, notifications, thème
// ============================================================
import { supabase } from './supabaseClient.js';

// ---- Thème ----
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');

// ---- Navigation ----
const pageTransition = document.getElementById('pageTransition');
function navigateTo(url) {
  pageTransition.classList.add('out');
  setTimeout(() => { window.location.href = url; }, 280);
}

function showPage() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('navbar').style.display = 'flex';
  document.getElementById('homePage').style.display = 'block';
  setTimeout(() => { pageTransition.style.opacity = '0'; }, 50);
}

function getThumb(v, quality = 'mq') {
  if (v.thumbnail_url) return v.thumbnail_url;
  if ((v.platform || 'youtube') === 'youtube') {
    const q = quality === 'max' ? 'maxresdefault' : quality === 'hq' ? 'hqdefault' : 'mqdefault';
    return `https://img.youtube.com/vi/${v.youtube_id}/${q}.jpg`;
  }
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect fill="%231a1a1a" width="320" height="180"/><text x="50%" y="50%" fill="%23555" font-size="14" text-anchor="middle" dy=".3em">Vimeo</text></svg>`;
}

(async () => {
  try {
    const navUserEmail  = document.getElementById('navUserEmail');
    const adminLink     = document.getElementById('adminLink');
    const logoutBtn     = document.getElementById('logoutBtn');
    const navBrand      = document.getElementById('navBrand');
    const heroContent   = document.getElementById('heroContent');
    const videoSections = document.getElementById('videoSections');
    const heroSlideshow = document.getElementById('heroSlideshow');
    const heroDots      = document.getElementById('heroDots');
    const themeToggle   = document.getElementById('themeToggle');
    const notifBtn      = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const notifBadge    = document.getElementById('notifBadge');
    const notifList     = document.getElementById('notifList');
    const notifMarkAll  = document.getElementById('notifMarkAll');
    const searchInput   = document.getElementById('searchInput');
    const searchDropdown = document.getElementById('searchDropdown');
    const continueSection = document.getElementById('continueSection');
    const continueRow   = document.getElementById('continueRow');

    // ---- Auth ----
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    const user = session.user;

    // ---- Profil ----
    const { data: profile } = await supabase
      .from('profiles').select('email, is_admin').eq('id', user.id).single();
    const isAdmin = profile?.is_admin === true;
    navUserEmail.textContent = profile?.email || user.email;
    if (isAdmin) adminLink.style.display = 'inline-flex';

    // ---- Thème toggle ----
    function applyTheme(t) {
      if (t === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeToggle) themeToggle.textContent = '☀️';
      } else {
        document.documentElement.removeAttribute('data-theme');
        if (themeToggle) themeToggle.textContent = '🌙';
      }
      localStorage.setItem('theme', t);
    }
    applyTheme(savedTheme);
    themeToggle.addEventListener('click', () => {
      const current = localStorage.getItem('theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    // ---- Events ----
    logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); navigateTo('index.html'); });
    navBrand.addEventListener('click', triggerConfetti);
    adminLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.location.href = 'admin.html';
});

    // ---- Vidéos ----
    let videos = [];
    if (isAdmin) {
      const { data } = await supabase
        .from('videos').select('id, title, youtube_id, platform, vimeo_hash, thumbnail_url, created_at')
        .order('created_at', { ascending: false });
      videos = data || [];
    } else {
      const { data: uvData } = await supabase.from('user_videos').select('video_id').eq('user_id', user.id);
      if (uvData && uvData.length > 0) {
        const ids = uvData.map(uv => uv.video_id);
        const { data } = await supabase
          .from('videos').select('id, title, youtube_id, platform, vimeo_hash, thumbnail_url, created_at')
          .in('id', ids).order('created_at', { ascending: false });
        videos = data || [];
      }
    }

    // ---- Commentaires count ----
    const commentCounts = {};
    if (videos.length > 0) {
      const ids = videos.map(v => v.id);
      const { data: comments } = await supabase.from('comments').select('video_id').in('video_id', ids);
      (comments || []).forEach(c => { commentCounts[c.video_id] = (commentCounts[c.video_id] || 0) + 1; });
    }

    // ---- Watch history (continuer à regarder) ----
    let watchMap = {}; // video_id -> progress %
    if (videos.length > 0) {
      const { data: wh } = await supabase
        .from('watch_history')
        .select('video_id, progress')
        .eq('user_id', user.id)
        .in('video_id', videos.map(v => v.id));
      (wh || []).forEach(w => { watchMap[w.video_id] = w.progress; });
    }

    // Continuer à regarder : vidéos entre 5% et 95%
    const inProgress = videos.filter(v => {
      const p = watchMap[v.id] || 0;
      return p > 5 && p < 95;
    });
    if (inProgress.length > 0) {
      continueSection.style.display = 'block';
      inProgress.forEach(v => {
        const pct = watchMap[v.id] || 0;
        const card = document.createElement('div');
        card.className = 'continue-card';
        card.innerHTML = `
          <div class="continue-thumb">
            <img src="${getThumb(v, 'mq')}" alt="${escapeHtml(v.title)}" loading="lazy" />
            <div class="continue-progress" style="width:${pct}%"></div>
          </div>
          <div class="continue-info">
            <div class="continue-card-title">${escapeHtml(v.title)}</div>
            <div class="continue-pct">${pct}% regardé</div>
          </div>`;
        card.addEventListener('click', () => navigateTo(`video.html?id=${v.id}`));
        continueRow.appendChild(card);
      });
    }

    // ---- Notifications ----
    async function loadNotifications() {
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      const unread = (notifs || []).filter(n => !n.read).length;
      if (unread > 0) {
        notifBadge.style.display = 'flex';
        notifBadge.textContent = unread > 9 ? '9+' : unread;
      } else {
        notifBadge.style.display = 'none';
      }
      notifList.innerHTML = '';
      if (!notifs || notifs.length === 0) {
        notifList.innerHTML = '<div class="notif-empty">Aucune notification</div>';
        return;
      }
      notifs.forEach(n => {
        const div = document.createElement('div');
        div.className = `notif-item${n.read ? '' : ' unread'}`;
        const timeAgo = formatTimeAgo(new Date(n.created_at));
        div.innerHTML = `
          <div class="notif-dot"></div>
          <div class="notif-content">
            <div class="notif-title">${escapeHtml(n.title)}</div>
            <div class="notif-msg">${escapeHtml(n.message)}</div>
            <div class="notif-time">${timeAgo}</div>
          </div>`;
        if (n.video_id) {
          div.addEventListener('click', () => {
            navigateTo(`video.html?id=${n.video_id}`);
          });
        }
        notifList.appendChild(div);
      });
    }
    await loadNotifications();

    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('open');
    });
    notifMarkAll.addEventListener('click', async () => {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
      await loadNotifications();
    });
    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
        notifDropdown.classList.remove('open');
      }
    });

    // ---- Recherche ----
    let searchTimer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = searchInput.value.trim().toLowerCase();
      if (!q) { searchDropdown.classList.remove('open'); return; }
      searchTimer = setTimeout(() => {
        const results = videos.filter(v => v.title.toLowerCase().includes(q)).slice(0, 6);
        if (results.length === 0) {
          searchDropdown.innerHTML = `<div style="padding:14px 16px;font-size:0.82rem;color:var(--text-dim);">Aucun résultat</div>`;
        } else {
          searchDropdown.innerHTML = '';
          results.forEach(v => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
              <img class="search-result-thumb" src="${getThumb(v, 'mq')}" alt="" />
              <div class="search-result-title">${escapeHtml(v.title)}</div>`;
            item.addEventListener('click', () => navigateTo(`video.html?id=${v.id}`));
            searchDropdown.appendChild(item);
          });
        }
        searchDropdown.classList.add('open');
      }, 200);
    });
    document.addEventListener('click', (e) => {
      if (!document.getElementById('navSearch').contains(e.target)) {
        searchDropdown.classList.remove('open');
      }
    });

    // ============================================================
    // DIAPORAMA HERO
    // ============================================================
    if (videos.length > 0) {
      let currentSlide   = 0;
      let slideshowTimer = null;
      const INTERVAL     = 5000;
      const slideVideos  = videos.slice(0, 8);

      slideVideos.forEach((v, i) => {
        const slide = document.createElement('div');
        slide.className = `hero-slide${i === 0 ? ' active' : ''}`;
        const platform = v.platform || 'youtube';
        if (platform === 'youtube') {
          const img = new Image();
          img.onload  = () => { slide.style.backgroundImage = `url(${img.src})`; };
          img.onerror = () => { slide.style.backgroundImage = `url(https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg)`; };
          img.src = `https://img.youtube.com/vi/${v.youtube_id}/maxresdefault.jpg`;
        } else {
          if (v.thumbnail_url) slide.style.backgroundImage = `url(${v.thumbnail_url})`;
          else slide.style.background = 'linear-gradient(135deg, #1a0a1a, #0a0a0a)';
        }
        heroSlideshow.appendChild(slide);
        const dot = document.createElement('button');
        dot.className = `hero-dot${i === 0 ? ' active' : ''}`;
        dot.setAttribute('aria-label', `Slide ${i + 1}`);
        dot.addEventListener('click', () => goToSlide(i));
        heroDots.appendChild(dot);
      });

      const slides = heroSlideshow.querySelectorAll('.hero-slide');
      const dots   = heroDots.querySelectorAll('.hero-dot');

      function goToSlide(index) {
        slides[currentSlide].classList.remove('active');
        dots[currentSlide].classList.remove('active');
        currentSlide = index;
        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
        updateHeroContent(slideVideos[currentSlide]);
        resetTimer();
      }
      function nextSlide() { goToSlide((currentSlide + 1) % slideVideos.length); }
      function resetTimer() {
        if (slideshowTimer) clearInterval(slideshowTimer);
        if (slideVideos.length > 1) slideshowTimer = setInterval(nextSlide, INTERVAL);
      }
      function updateHeroContent(v) {
        const date   = new Date(v.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        const isNew  = (Date.now() - new Date(v.created_at)) < 7 * 24 * 60 * 60 * 1000;
        const count  = commentCounts[v.id] || 0;
        const isVimeo = (v.platform || 'youtube') === 'vimeo';
        heroContent.innerHTML = `
          <div class="hero-badge">${isNew ? '✨ Nouveau vlog' : '🎬 À la une'}</div>
          <h1 class="hero-title">${escapeHtml(v.title)}</h1>
          <div class="hero-meta">
            ${date} · ${count} commentaire${count !== 1 ? 's' : ''}
            ${isVimeo ? ' · <span style="color:#1ab7ea;font-size:0.8rem;">Vimeo</span>' : ''}
          </div>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" id="heroPlayBtn">▶ Regarder</button>
            <button class="btn btn-secondary btn-lg" id="heroInfoBtn">↓ Voir tout</button>
          </div>`;
        document.getElementById('heroPlayBtn').addEventListener('click', () => navigateTo(`video.html?id=${v.id}`));
        document.getElementById('heroInfoBtn').addEventListener('click', () =>
          document.querySelector('.home-content').scrollIntoView({ behavior: 'smooth' }));
      }
      updateHeroContent(slideVideos[0]);
      resetTimer();
      const hero = document.getElementById('hero');
      hero.addEventListener('mouseenter', () => { if (slideshowTimer) clearInterval(slideshowTimer); });
      hero.addEventListener('mouseleave', () => resetTimer());
    } else {
      heroSlideshow.style.background = 'linear-gradient(135deg,#1a0000,#0a0a0a)';
      heroContent.innerHTML = `
        <div class="hero-badge">👋 Bienvenue</div>
        <h1 class="hero-title">${isAdmin ? 'Bonjour Lucas 👑' : `Bienvenue !`}</h1>
        <div class="hero-meta">Aucune vidéo disponible pour l'instant.</div>`;
    }

    // ============================================================
    // GRILLE DES VLOGS
    // ============================================================
    if (videos.length === 0) {
      videoSections.innerHTML = `
        <div class="empty-state" style="padding:60px 20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z"/>
          </svg>
          <p>Aucune vidéo disponible.<br>Contactez l'administrateur.</p>
        </div>`;
    } else {
      const groups = groupByMonth(videos);
      let idx = 0;
      groups.forEach(group => {
        const curLabel  = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const isCurrent = group.label === curLabel;
        const section   = document.createElement('div');
        section.className = 'video-section';
        section.innerHTML = `
          <div class="video-section-title">
            ${isCurrent ? '🔥 Ce mois-ci' : `📅 ${capitalize(group.label)}`}
            <span>${group.videos.length} vidéo${group.videos.length > 1 ? 's' : ''}</span>
          </div>
          <div class="video-row"></div>`;
        videoSections.appendChild(section);
        const row = section.querySelector('.video-row');
        group.videos.forEach((v, i) => {
          row.appendChild(buildCard(v, commentCounts[v.id] || 0, watchMap[v.id] || 0, idx + i));
        });
        idx += group.videos.length;
      });
    }

  } catch (err) {
    console.error('Erreur globale home.js:', err);
  } finally {
    showPage();
  }

  // ---- Helpers ----
  function groupByMonth(list) {
    const groups = {};
    list.forEach(v => {
      const d   = new Date(v.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = { label, videos: [] };
      groups[key].videos.push(v);
    });
    return Object.values(groups);
  }

  function buildCard(video, commentCount, progress, index) {
    const card     = document.createElement('div');
    card.className = 'video-card fade-in';
    card.style.animationDelay = `${Math.min(index * 0.05, 0.5)}s`;
    const thumb    = getThumb(video, 'mq');
    const date     = new Date(video.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const isNew    = (Date.now() - new Date(video.created_at)) < 7 * 24 * 60 * 60 * 1000;
    const isVimeo  = (video.platform || 'youtube') === 'vimeo';
    card.innerHTML = `
      <div class="video-thumb">
        <img src="${thumb}" alt="${escapeHtml(video.title)}" loading="lazy" />
        <div class="video-thumb-overlay">
          <div class="play-icon"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
        </div>
        ${isNew ? '<div class="badge-new">Nouveau</div>' : ''}
        ${isVimeo ? '<div class="badge-vimeo">Vimeo</div>' : ''}
        ${progress > 0 ? `<div class="video-progress-bar" style="width:${progress}%"></div>` : ''}
      </div>
      <div class="video-info">
        <div class="video-title-card">${escapeHtml(video.title)}</div>
        <div class="video-meta-row">
          <span>${date}</span>
          <span class="video-comment-count">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>
            </svg>
            ${commentCount}
          </span>
        </div>
      </div>`;
    card.addEventListener('click', () => navigateTo(`video.html?id=${video.id}`));
    return card;
  }

  function triggerConfetti() {
    const colors = ['#e50914','#ff4d4d','#f5a623','#fff','#ffd700','#ff8c00'];
    for (let i = 0; i < 80; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.cssText = `left:${Math.random()*100}vw;top:-10px;background:${colors[Math.floor(Math.random()*colors.length)]};width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${1.5+Math.random()*2}s;animation-delay:${Math.random()*0.4}s;`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }
  }

  function formatTimeAgo(date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'à l\'instant';
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `il y a ${days}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }
  function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

  supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') window.location.href = 'index.html'; });
})();
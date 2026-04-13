// ============================================================
// home.js — V2 anti-freeze
// ============================================================
import { supabase } from './supabaseClient.js';

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

(async () => {
  try {
    const navUserEmail  = document.getElementById('navUserEmail');
    const adminLink     = document.getElementById('adminLink');
    const logoutBtn     = document.getElementById('logoutBtn');
    const navBrand      = document.getElementById('navBrand');
    const heroBg        = document.getElementById('heroBg');
    const heroContent   = document.getElementById('heroContent');
    const videoSections = document.getElementById('videoSections');

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

    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      navigateTo('index.html');
    });
    navBrand.addEventListener('click', triggerConfetti);
    adminLink.addEventListener('click', (e) => { e.preventDefault(); navigateTo('admin.html'); });

    // ---- Vidéos ----
    let videos = [];
    try {
      if (isAdmin) {
        const { data } = await supabase
          .from('videos').select('id, title, youtube_id, created_at')
          .order('created_at', { ascending: false });
        videos = data || [];
      } else {
        const { data: uvData } = await supabase
          .from('user_videos').select('video_id').eq('user_id', user.id);
        if (uvData && uvData.length > 0) {
          const ids = uvData.map(uv => uv.video_id);
          const { data } = await supabase
            .from('videos').select('id, title, youtube_id, created_at')
            .in('id', ids).order('created_at', { ascending: false });
          videos = data || [];
        }
      }
    } catch (e) { console.warn('videos error', e); }

    // ---- Commentaires — optionnel, ne bloque pas ----
    const commentCounts = {};
    try {
      if (videos.length > 0) {
        const ids = videos.map(v => v.id);
        const { data: comments } = await supabase
          .from('comments').select('video_id').in('video_id', ids);
        (comments || []).forEach(c => {
          commentCounts[c.video_id] = (commentCounts[c.video_id] || 0) + 1;
        });
      }
    } catch (e) { console.warn('comments count error (ignoré)', e); }

    // ---- Hero ----
    try {
      if (videos.length > 0) {
        const f = videos[0];
        heroBg.style.backgroundImage =
          `url(https://img.youtube.com/vi/${f.youtube_id}/maxresdefault.jpg)`;
        const date = new Date(f.created_at).toLocaleDateString('fr-FR',
          { day: 'numeric', month: 'long', year: 'numeric' });
        const isNew = (Date.now() - new Date(f.created_at)) < 7 * 24 * 60 * 60 * 1000;
        const count = commentCounts[f.id] || 0;
        heroContent.innerHTML = `
          <div class="hero-badge">${isNew ? '✨ Nouveau vlog' : '🎬 À la une'}</div>
          <h1 class="hero-title">${escapeHtml(f.title)}</h1>
          <div class="hero-meta">Ajouté le ${date} · ${count} commentaire${count > 1 ? 's' : ''}</div>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" id="heroPlayBtn">▶ Regarder</button>
            <button class="btn btn-secondary btn-lg" id="heroInfoBtn">↓ Voir tout</button>
          </div>`;
        document.getElementById('heroPlayBtn')
          .addEventListener('click', () => navigateTo(`video.html?id=${f.id}`));
        document.getElementById('heroInfoBtn')
          .addEventListener('click', () =>
            document.querySelector('.home-content').scrollIntoView({ behavior: 'smooth' }));
      } else {
        heroBg.style.background = 'linear-gradient(135deg,#1a0000,#0a0a0a)';
        heroContent.innerHTML = `
          <div class="hero-badge">👋 Bienvenue</div>
          <h1 class="hero-title">${isAdmin ? 'Bonjour Lucas 👑' : `Bonjour ${(profile?.email||'').split('@')[0]} !`}</h1>
          <div class="hero-meta">Aucune vidéo disponible.</div>`;
      }
    } catch (e) { console.warn('hero error', e); }

    // ---- Sections ----
    try {
      if (videos.length === 0) {
        videoSections.innerHTML = `
          <div class="empty-state" style="padding:60px 20px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53
                   l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0
                   0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z"/>
            </svg>
            <p>Aucune vidéo disponible.<br>Contactez l'administrateur.</p>
          </div>`;
      } else {
        const groups = groupByMonth(videos);
        let idx = 0;
        groups.forEach(group => {
          const now = new Date();
          const curLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
          const isCurrent = group.label === curLabel;
          const section = document.createElement('div');
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
            row.appendChild(buildCard(v, commentCounts[v.id] || 0, getProgress(v.id), idx + i));
          });
          idx += group.videos.length;
        });
      }
    } catch (e) { console.warn('sections error', e); }

  } catch (globalErr) {
    console.error('Erreur globale home.js:', globalErr);
  } finally {
    // Toujours afficher la page, quoi qu'il arrive
    showPage();
  }

  // ---- Helpers ----
  function getProgress(videoId) {
    try { return parseInt(localStorage.getItem(`progress_${videoId}`) || '0'); } catch { return 0; }
  }

  function groupByMonth(list) {
    const groups = {};
    list.forEach(v => {
      const d = new Date(v.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = { label, videos: [] };
      groups[key].videos.push(v);
    });
    return Object.values(groups);
  }

  function buildCard(video, commentCount, progress, index) {
    const card = document.createElement('div');
    card.className = 'video-card fade-in';
    card.style.animationDelay = `${Math.min(index * 0.05, 0.5)}s`;
    const thumb = `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`;
    const date  = new Date(video.created_at).toLocaleDateString('fr-FR',
      { day: 'numeric', month: 'short' });
    const isNew = (Date.now() - new Date(video.created_at)) < 7 * 24 * 60 * 60 * 1000;
    card.innerHTML = `
      <div class="video-thumb">
        <img src="${thumb}" alt="${escapeHtml(video.title)}" loading="lazy" />
        <div class="video-thumb-overlay">
          <div class="play-icon">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        ${isNew ? '<div class="badge-new">Nouveau</div>' : ''}
        ${progress > 0 ? `<div class="video-progress-bar" style="width:${progress}%"></div>` : ''}
      </div>
      <div class="video-info">
        <div class="video-title-card">${escapeHtml(video.title)}</div>
        <div class="video-meta-row">
          <span>${date}</span>
          <span class="video-comment-count">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125
                   0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375
                   0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25
                   -9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a
                   5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133
                   -.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9
                   -8.25s9 3.694 9 8.25z"/>
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
      p.style.cssText = `
        left:${Math.random()*100}vw;top:-10px;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;
        border-radius:${Math.random()>.5?'50%':'2px'};
        animation-duration:${1.5+Math.random()*2}s;
        animation-delay:${Math.random()*0.4}s;`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
  });
})();
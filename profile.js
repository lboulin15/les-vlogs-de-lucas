// ============================================================
// profile.js — Page profil utilisateur
// ============================================================
import { supabase } from './supabaseClient.js';

const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');

const pageTransition = document.getElementById('pageTransition');
function navigateTo(url) {
  pageTransition.classList.add('out');
  setTimeout(() => { window.location.href = url; }, 280);
}

const AVATAR_COLORS = [
  ['#e50914','#fff'], ['#f5a623','#000'], ['#3b82f6','#fff'],
  ['#10b981','#fff'], ['#8b5cf6','#fff'], ['#ec4899','#fff'],
  ['#06b6d4','#fff'], ['#f59e0b','#000'], ['#6366f1','#fff'],
];
function getAvatarColor(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}

function getYoutubeThumb(youtubeId, quality = 'mqdefault') {
  return `https://img.youtube.com/vi/${youtubeId}/${quality}.jpg`;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

(async () => {
  try {
    const navbar        = document.getElementById('navbar');
    const profilePage   = document.getElementById('profilePage');
    const loadingScreen = document.getElementById('loadingScreen');
    const navUserEmail  = document.getElementById('navUserEmail');
    const adminLink     = document.getElementById('adminLink');
    const logoutBtn     = document.getElementById('logoutBtn');
    const themeToggle   = document.getElementById('themeToggle');

    // ---- Thème ----
    function applyTheme(t) {
      if (t === 'light') { document.documentElement.setAttribute('data-theme', 'light'); themeToggle.textContent = '☀️'; }
      else { document.documentElement.removeAttribute('data-theme'); themeToggle.textContent = '🌙'; }
      localStorage.setItem('theme', t);
    }
    applyTheme(savedTheme);
    themeToggle.addEventListener('click', () => applyTheme(localStorage.getItem('theme') === 'dark' ? 'light' : 'dark'));

    // ---- Auth ----
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    const user = session.user;

    const { data: profile } = await supabase
      .from('profiles').select('id, email, is_admin, created_at').eq('id', user.id).single();
    const isAdmin = profile?.is_admin === true;
    navUserEmail.textContent = profile?.email || user.email;
    if (isAdmin) adminLink.style.display = 'inline-flex';
    logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); navigateTo('index.html'); });
    adminLink?.addEventListener('click', e => { e.preventDefault(); navigateTo('admin.html'); });

    // ---- Profil hero ----
    const email = profile?.email || user.email;
    const [bg, fg] = getAvatarColor(email);
    const initials = email.split('@')[0].substring(0, 2).toUpperCase();
    document.getElementById('profileAvatar').style.cssText = `background:${bg};color:${fg};`;
    document.getElementById('profileAvatar').textContent = initials;
    const username = email.split('@')[0];
document.getElementById('profileName').textContent =
  username.charAt(0).toUpperCase() + username.slice(1);
    document.getElementById('profileEmail').textContent = email;
    document.getElementById('profileJoined').textContent = `Membre depuis ${new Date(profile?.created_at || user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;

    // ---- Charger les données ----
    // Vidéos accessibles
    let videos = [];
    if (isAdmin) {
      const { data } = await supabase.from('videos').select('id, title, youtube_id, platform, thumbnail_url, created_at').order('created_at', { ascending: false });
      videos = data || [];
    } else {
      const { data: uvData } = await supabase.from('user_videos').select('video_id').eq('user_id', user.id);
      if (uvData && uvData.length > 0) {
        const ids = uvData.map(uv => uv.video_id);
        const { data } = await supabase.from('videos').select('id, title, youtube_id, platform, thumbnail_url, created_at').in('id', ids).order('created_at', { ascending: false });
        videos = data || [];
      }
    }
    const videoMap = {};
    videos.forEach(v => { videoMap[v.id] = v; });

    // Historique de visionnage
    const { data: watchHistory } = await supabase
      .from('watch_history').select('video_id, progress, watched_at').eq('user_id', user.id).order('watched_at', { ascending: false });

    // Commentaires
    const { data: myComments } = await supabase
      .from('comments').select('id, content, created_at, video_id').eq('user_id', user.id).is('parent_id', null).order('created_at', { ascending: false });

    // Notes
    const { data: myRatings } = await supabase
      .from('ratings').select('video_id, rating, created_at').eq('user_id', user.id).order('created_at', { ascending: false });

    // Stats
    const watched  = (watchHistory || []).filter(w => w.progress >= 95).length;
    const started  = (watchHistory || []).length;
    const comments = (myComments || []).length;
    const avgRating = myRatings && myRatings.length > 0
      ? (myRatings.reduce((a, r) => a + r.rating, 0) / myRatings.length).toFixed(1)
      : '—';

    document.getElementById('profileStatsRow').innerHTML = `
  <div class="profile-stat">
    <div class="profile-stat-val">${started}</div>
    <div class="profile-stat-lbl">Vidéos commencées</div>
  </div>
  <div class="profile-stat">
    <div class="profile-stat-val">${watched}</div>
    <div class="profile-stat-lbl">Vues complètes</div>
  </div>
  <div class="profile-stat">
    <div class="profile-stat-val">${comments}</div>
    <div class="profile-stat-lbl">Commentaires</div>
  </div>
  <div class="profile-stat">
    <div class="profile-stat-val" style="color:var(--gold)">${avgRating}</div>
    <div class="profile-stat-lbl">Note moyenne</div>
  </div>
`;

    // ---- Onglets ----
    // Tab: vidéos vues
   const tabVideos = document.getElementById('tab-videos');
if (!watchHistory || watchHistory.length === 0) {
  tabVideos.innerHTML = `
    <div class="profile-section-header">
      <h2 class="profile-section-title">Mes vidéos vues</h2>
    </div>
    <div class="profile-empty-state">Aucune vidéo regardée pour l’instant.</div>
  `;
} else {
  tabVideos.innerHTML = `
    <div class="profile-section-header">
      <h2 class="profile-section-title">Mes vidéos vues</h2>
    </div>
  `;

  const grid = document.createElement('div');
  grid.className = 'profile-cards-grid';

  watchHistory.forEach(w => {
    const v = videoMap[w.video_id];
    if (!v) return;

    const thumb = v.thumbnail_url || getYoutubeThumb(v.youtube_id);
    const card = document.createElement('article');
    card.className = 'profile-video-card fade-in';

    card.innerHTML = `
      <div class="profile-video-thumb">
        <img src="${thumb}" alt="${escapeHtml(v.title)}" loading="lazy" />
        <div class="profile-video-overlay">
          <div class="play-icon">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        ${w.progress > 0 ? `<div class="profile-video-progress" style="width:${w.progress}%"></div>` : ''}
      </div>

      <div class="profile-video-body">
        <div class="profile-video-title">${escapeHtml(v.title)}</div>
        <div class="profile-video-meta">
          <span class="${w.progress >= 95 ? 'profile-status-done' : 'profile-status-progress'}">
            ${w.progress >= 95 ? '✓ Vu en entier' : `${w.progress}% regardé`}
          </span>
          <span>${formatDate(w.watched_at)}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => navigateTo(`video.html?id=${v.id}`));
    grid.appendChild(card);
  });

  tabVideos.appendChild(grid);
}

    // Tab: commentaires
    const tabComments = document.getElementById('tab-comments');
if (!myComments || myComments.length === 0) {
  tabComments.innerHTML = `
    <div class="profile-section-header">
      <h2 class="profile-section-title">Mes commentaires</h2>
    </div>
    <div class="profile-empty-state">Aucun commentaire posté pour l’instant.</div>
  `;
} else {
  tabComments.innerHTML = `
    <div class="profile-section-header">
      <h2 class="profile-section-title">Mes commentaires</h2>
    </div>
  `;

  const list = document.createElement('div');
  list.className = 'profile-list';

  myComments.forEach(c => {
    const v = videoMap[c.video_id];
    const item = document.createElement('article');
    item.className = `profile-card-item fade-in${v ? ' is-link' : ''}`;

    item.innerHTML = `
      <div class="profile-item-top">
        <div class="profile-item-video">🎬 ${v ? escapeHtml(v.title) : 'Vidéo inconnue'}</div>
        <div class="profile-item-date">${formatDateTime(c.created_at)}</div>
      </div>
      <div class="profile-item-content">${escapeHtml(c.content)}</div>
    `;

    if (v) {
      item.addEventListener('click', () => navigateTo(`video.html?id=${v.id}`));
    }

    list.appendChild(item);
  });

  tabComments.appendChild(list);
}

    // Tab: notes
    const tabRatings = document.getElementById('tab-ratings');
if (!myRatings || myRatings.length === 0) {
  tabRatings.innerHTML = `
    <div class="profile-section-header">
      <h2 class="profile-section-title">Mes notes</h2>
    </div>
    <div class="profile-empty-state">Aucune note donnée pour l’instant.</div>
  `;
} else {
  tabRatings.innerHTML = `
    <div class="profile-section-header">
      <h2 class="profile-section-title">Mes notes</h2>
    </div>
  `;

  const list = document.createElement('div');
  list.className = 'profile-list';

  myRatings.forEach(r => {
    const v = videoMap[r.video_id];
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);

    const item = document.createElement('article');
    item.className = `profile-card-item fade-in${v ? ' is-link' : ''}`;

    item.innerHTML = `
      <div class="profile-item-top">
        <div class="profile-item-video">🎬 ${v ? escapeHtml(v.title) : 'Vidéo inconnue'}</div>
        <div class="profile-item-date">${formatDate(r.created_at)}</div>
      </div>
      <div class="profile-rating-stars">${stars}</div>
    `;

    if (v) {
      item.addEventListener('click', () => navigateTo(`video.html?id=${v.id}`));
    }

    list.appendChild(item);
  });

  tabRatings.appendChild(list);
}

    // ---- Tabs navigation ----
    const tabs = document.querySelectorAll('.profile-tab');
    const panels = document.querySelectorAll('.profile-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      });
    });

  } catch (err) {
    console.error('Erreur profile.js:', err);
  } finally {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('navbar').style.display = 'flex';
    document.getElementById('profilePage').style.display = 'block';
    setTimeout(() => { document.getElementById('pageTransition').style.opacity = '0'; }, 50);
  }

  supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') window.location.href = 'index.html'; });
})();
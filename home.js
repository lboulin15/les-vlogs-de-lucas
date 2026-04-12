// ============================================================
// home.js — Page d'accueil
// ============================================================
import { supabase } from './supabaseClient.js';

(async () => {
  const loadingScreen = document.getElementById('loadingScreen');
  const navbar = document.getElementById('navbar');
  const homePage = document.getElementById('homePage');
  const navUserEmail = document.getElementById('navUserEmail');
  const logoutBtn = document.getElementById('logoutBtn');
  const videoGrid = document.getElementById('videoGrid');
  const heroTitle = document.getElementById('heroTitle');
  const videoCount = document.getElementById('videoCount');

  // ---- Auth check ----
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const user = session.user;

  // ---- Charger le profil ----
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, email')
    .eq('id', user.id)
    .single();

  // Si admin → rediriger vers admin.html
  if (profile?.is_admin) {
    window.location.href = 'admin.html';
    return;
  }

  // ---- Afficher UI ----
  navUserEmail.textContent = profile?.email || user.email;
  const firstName = (profile?.email || user.email).split('@')[0];
  heroTitle.textContent = `Bonjour, ${firstName} 👋`;

  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });

  // ---- Charger les vidéos autorisées ----
  await loadVideos();

  // ---- Afficher ----
  loadingScreen.style.display = 'none';
  navbar.style.display = 'flex';
  homePage.style.display = 'block';

  async function loadVideos() {
    try {
      // Récupérer les video_ids autorisés pour cet user
      const { data: userVideos, error: uvError } = await supabase
        .from('user_videos')
        .select('video_id')
        .eq('user_id', user.id);

      if (uvError) throw uvError;

      if (!userVideos || userVideos.length === 0) {
        videoGrid.innerHTML = emptyState();
        videoCount.innerHTML = '<strong>0</strong> vidéo disponible';
        return;
      }

      const videoIds = userVideos.map(uv => uv.video_id);

      const { data: videos, error: vError } = await supabase
        .from('videos')
        .select('id, title, youtube_id, created_at')
        .in('id', videoIds)
        .order('created_at', { ascending: false });

      if (vError) throw vError;

      videoCount.innerHTML = `<strong>${videos.length}</strong> vidéo${videos.length > 1 ? 's' : ''} disponible${videos.length > 1 ? 's' : ''}`;
      renderVideos(videos);
    } catch (err) {
      console.error('Erreur chargement vidéos:', err);
      videoGrid.innerHTML = `<div class="empty-state"><p>Erreur de chargement. Rechargez la page.</p></div>`;
    }
  }

  function renderVideos(videos) {
    videoGrid.innerHTML = '';

    if (!videos || videos.length === 0) {
      videoGrid.innerHTML = emptyState();
      return;
    }

    videos.forEach((video, index) => {
      const card = document.createElement('div');
      card.className = 'video-card fade-in';
      card.style.animationDelay = `${index * 0.06}s`;

      const thumb = `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`;
      const date = new Date(video.created_at).toLocaleDateString('fr-FR', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      card.innerHTML = `
        <div class="video-thumb">
          <img src="${thumb}" alt="${escapeHtml(video.title)}" loading="lazy" />
          <div class="video-thumb-overlay">
            <div class="play-icon">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </div>
        <div class="video-info">
          <div class="video-title-card">${escapeHtml(video.title)}</div>
          <div class="video-meta">${date}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        window.location.href = `video.html?id=${video.id}`;
      });

      videoGrid.appendChild(card);
    });
  }

  function emptyState() {
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z"/>
        </svg>
        <p>Aucune vidéo disponible pour votre compte.<br>Contactez l'administrateur.</p>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ---- Écouter les changements de session ----
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = 'index.html';
    }
  });
})();
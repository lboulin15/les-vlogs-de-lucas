// ============================================================
// video.js — V4 avec détection d'erreur YouTube + fallback mobile
// ============================================================
import { supabase } from './supabaseClient.js';

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
function getInitials(email) {
  return email.split('@')[0].substring(0, 2).toUpperCase();
}

// ============================================================
// YOUTUBE IFRAME API — chargement global
// ============================================================
let ytApiReady = false;
let ytApiCallbacks = [];

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (ytApiReady) { resolve(); return; }
    ytApiCallbacks.push(resolve);
    if (document.getElementById('yt-api-script')) return; // déjà en cours de chargement
    const script = document.createElement('script');
    script.id  = 'yt-api-script';
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
}

window.onYouTubeIframeAPIReady = () => {
  ytApiReady = true;
  ytApiCallbacks.forEach(cb => cb());
  ytApiCallbacks = [];
};

(async () => {
  const loadingScreen  = document.getElementById('loadingScreen');
  const navbar         = document.getElementById('navbar');
  const videoPage      = document.getElementById('videoPage');
  const navUserEmail   = document.getElementById('navUserEmail');
  const adminLink      = document.getElementById('adminLink');
  const logoutBtn      = document.getElementById('logoutBtn');
  const backBtn        = document.getElementById('backBtn');
  const playerWrap     = document.getElementById('playerWrap');
  const videoTitleEl   = document.getElementById('videoTitle');
  const videoDateEl    = document.getElementById('videoDate');
  const commentInput   = document.getElementById('commentInput');
  const commentSubmit  = document.getElementById('commentSubmit');
  const commentList    = document.getElementById('commentList');
  const suggestedSection = document.getElementById('suggestedSection');
  const suggestedRow     = document.getElementById('suggestedRow');

  // ---- Auth ----
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  const user = session.user;

  const { data: profile } = await supabase
    .from('profiles').select('email, is_admin').eq('id', user.id).single();
  const isAdmin = profile?.is_admin === true;
  navUserEmail.textContent = profile?.email || user.email;
  if (isAdmin) adminLink.style.display = 'inline-flex';

  // ---- Video ID ----
  const params  = new URLSearchParams(window.location.search);
  const videoId = params.get('id');
  if (!videoId) { window.location.href = 'home.html'; return; }

  // ---- Vérifier accès ----
  let hasAccess = isAdmin;
  if (!hasAccess) {
    const { data } = await supabase
      .from('user_videos').select('id').eq('user_id', user.id).eq('video_id', videoId).single();
    hasAccess = !!data;
  }
  if (!hasAccess) { navigateTo('home.html'); return; }

  // ---- Charger vidéo ----
  const { data: video } = await supabase
    .from('videos').select('id, title, youtube_id, created_at').eq('id', videoId).single();
  if (!video) { navigateTo('home.html'); return; }

  videoTitleEl.textContent = video.title;
  videoDateEl.textContent = new Date(video.created_at).toLocaleDateString('fr-FR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // ---- Progression localStorage ----
  const existingProgress = parseInt(localStorage.getItem(`progress_${videoId}`) || '0');
  if (existingProgress < 100) {
    localStorage.setItem(`progress_${videoId}`, existingProgress === 0 ? '60' : '100');
  }

  // ---- Nav events ----
  logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); navigateTo('index.html'); });
  backBtn.addEventListener('click', () => navigateTo('home.html'));
  adminLink?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('admin.html'); });

  // ============================================================
  // LECTEUR YOUTUBE AVEC DÉTECTION D'ERREUR
  // ============================================================
  await loadYouTubeAPI();

  // Conteneur pour le player YT API
  const playerDiv = document.createElement('div');
  playerDiv.id = 'yt-player';
  playerWrap.appendChild(playerDiv);

  new YT.Player('yt-player', {
    videoId: video.youtube_id,
    playerVars: {
      rel:            0,
      modestbranding: 1,
      playsinline:    1,   // Indispensable pour iOS (lecture inline)
      origin:         window.location.origin,
    },
    events: {
      onError: (event) => {
        // Codes d'erreur YouTube :
        // 2   = paramètre invalide
        // 5   = erreur HTML5
        // 100 = vidéo introuvable / privée
        // 101 = intégration désactivée par le propriétaire
        // 150 = idem (alias de 101)
        showPlayerFallback(video.youtube_id, event.data);
      },
    },
  });

  // ---- Fallback si la vidéo ne peut pas être intégrée ----
  function showPlayerFallback(youtubeId, errorCode) {
    // On vide le player cassé
    playerWrap.innerHTML = '';

    // On affiche une belle carte de remplacement
    const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    const thumb      = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

    playerWrap.innerHTML = `
      <div class="player-fallback">
        <img class="player-fallback-thumb" src="${thumb}" alt="Miniature" />
        <div class="player-fallback-overlay">
          <div class="player-fallback-icon">⚠️</div>
          <p class="player-fallback-msg">
            Cette vidéo ne peut pas être lue directement ici
            ${errorCode === 101 || errorCode === 150 ? '(intégration désactivée sur mobile)' : ''}.
          </p>
          <a href="${youtubeUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-lg player-fallback-btn">
            ▶ Ouvrir sur YouTube
          </a>
        </div>
      </div>
    `;
  }

  // ============================================================
  // NOTATION
  // ============================================================
  const starRating    = document.getElementById('starRating');
  const ratingAverage = document.getElementById('ratingAverage');
  const stars         = starRating.querySelectorAll('.star');
  let userRating = 0;

  async function loadRatings() {
    try {
      const { data: myRating } = await supabase
        .from('ratings').select('rating')
        .eq('video_id', videoId).eq('user_id', user.id).single();
      const { data: allRatings } = await supabase
        .from('ratings').select('rating').eq('video_id', videoId);
      userRating = myRating?.rating || 0;
      renderStars(userRating);
      if (allRatings && allRatings.length > 0) {
        const avg = (allRatings.reduce((a, r) => a + r.rating, 0) / allRatings.length).toFixed(1);
        ratingAverage.innerHTML = `
          <span class="rating-avg-number">${avg}</span>
          <span class="rating-avg-stars">${renderStarsText(parseFloat(avg))}</span>
          <span class="rating-avg-count">${allRatings.length} avis</span>`;
      } else {
        ratingAverage.innerHTML = `<span class="rating-avg-empty">Aucune note pour l'instant</span>`;
      }
    } catch (e) {
      ratingAverage.innerHTML = `<span class="rating-avg-empty">Notes indisponibles</span>`;
    }
  }
  function renderStars(value) {
    stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= value));
  }
  function renderStarsText(avg) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(avg)) html += '<span class="star-filled">★</span>';
      else if (i - avg < 1)     html += '<span class="star-half">★</span>';
      else                       html += '<span class="star-empty">★</span>';
    }
    return html;
  }
  stars.forEach(star => {
    star.addEventListener('mouseenter', () => renderStars(parseInt(star.dataset.value)));
    star.addEventListener('mouseleave', () => renderStars(userRating));
    star.addEventListener('click', async () => {
      const newRating = parseInt(star.dataset.value);
      const finalRating = newRating === userRating ? 0 : newRating;
      try {
        if (finalRating === 0) {
          await supabase.from('ratings').delete().eq('video_id', videoId).eq('user_id', user.id);
          showToast('Note supprimée.', 'success');
        } else {
          await supabase.from('ratings').upsert(
            { user_id: user.id, video_id: videoId, rating: finalRating },
            { onConflict: 'user_id,video_id' }
          );
          showToast(`${finalRating} étoile${finalRating > 1 ? 's' : ''} — Merci !`, 'success');
        }
        userRating = finalRating;
        await loadRatings();
      } catch { showToast('Erreur lors de la notation.', 'error'); }
    });
  });
  await loadRatings();

  // ---- Vidéos suggérées ----
  try {
    let allAccessVideos = [];
    if (isAdmin) {
      const { data } = await supabase.from('videos').select('id, title, youtube_id')
        .neq('id', videoId).order('created_at', { ascending: false }).limit(6);
      allAccessVideos = data || [];
    } else {
      const { data: uvData } = await supabase.from('user_videos').select('video_id').eq('user_id', user.id);
      const ids = (uvData || []).map(uv => uv.video_id).filter(id => id !== videoId);
      if (ids.length > 0) {
        const { data } = await supabase.from('videos').select('id, title, youtube_id')
          .in('id', ids).order('created_at', { ascending: false }).limit(6);
        allAccessVideos = data || [];
      }
    }
    if (allAccessVideos.length > 0) {
      suggestedSection.style.display = 'block';
      allAccessVideos.forEach(v => {
        const card = document.createElement('div');
        card.className = 'suggested-card';
        card.innerHTML = `
          <div class="suggested-thumb">
            <img src="https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg"
                 alt="${escapeHtml(v.title)}" loading="lazy" />
          </div>
          <div class="suggested-info">
            <div class="suggested-card-title">${escapeHtml(v.title)}</div>
          </div>`;
        card.addEventListener('click', () => navigateTo(`video.html?id=${v.id}`));
        suggestedRow.appendChild(card);
      });
    }
  } catch (e) {}

  // ---- Afficher la page ----
  loadingScreen.style.display = 'none';
  navbar.style.display = 'flex';
  videoPage.style.display = 'block';
  setTimeout(() => { pageTransition.style.opacity = '0'; }, 50);

  // ---- Commentaires ----
  await loadComments();

  commentSubmit.addEventListener('click', async () => {
    const content = commentInput.value.trim();
    if (!content) { showToast('Commentaire vide.', 'error'); return; }
    if (content.length > 1000) { showToast('Trop long (max 1000 caractères).', 'error'); return; }
    commentSubmit.disabled = true;
    commentSubmit.textContent = 'Publication...';
    const { error } = await supabase.from('comments')
      .insert({ video_id: videoId, user_id: user.id, content });
    commentSubmit.disabled = false;
    commentSubmit.textContent = 'Publier';
    if (error) { showToast('Erreur lors de la publication.', 'error'); return; }
    commentInput.value = '';
    showToast('Commentaire publié !', 'success');
    await loadComments();
  });

  async function loadComments() {
    const { data: comments, error } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, profiles:user_id(email)')
      .eq('video_id', videoId).order('created_at', { ascending: false });
    if (error) {
      commentList.innerHTML = `<p style="color:var(--text-dim);font-size:0.85rem;">Impossible de charger les commentaires.</p>`;
      return;
    }
    if (!comments || comments.length === 0) {
      commentList.innerHTML = `<p style="color:var(--text-dim);font-size:0.85rem;padding:12px 0;">Aucun commentaire. Soyez le premier !</p>`;
      return;
    }
    commentList.innerHTML = '';
    comments.forEach(comment => {
      const email    = comment.profiles?.email || 'utilisateur@lucas.fr';
      const initials = getInitials(email);
      const [bg, fg] = getAvatarColor(email);
      const author   = email.split('@')[0];
      const date     = new Date(comment.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const canDelete = comment.user_id === user.id || isAdmin;
      const el = document.createElement('div');
      el.className = 'comment-item';
      el.dataset.id = comment.id;
      el.innerHTML = `
        <div class="comment-header">
          <div class="comment-avatar" style="background:${bg};color:${fg};">${initials}</div>
          <div class="comment-header-info">
            <div class="comment-author">@${escapeHtml(author)}</div>
            <div class="comment-date">${date}</div>
          </div>
          ${canDelete ? `<button class="btn btn-danger btn-sm delete-comment-btn" data-id="${comment.id}">✕</button>` : ''}
        </div>
        <div class="comment-body">${escapeHtml(comment.content)}</div>`;
      commentList.appendChild(el);
    });
    commentList.querySelectorAll('.delete-comment-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { error } = await supabase.from('comments').delete().eq('id', btn.dataset.id);
        if (error) { showToast('Erreur suppression.', 'error'); return; }
        showToast('Commentaire supprimé.', 'success');
        const el = commentList.querySelector(`[data-id="${btn.dataset.id}"]`);
        if (el) el.remove();
        if (commentList.children.length === 0) {
          commentList.innerHTML = `<p style="color:var(--text-dim);font-size:0.85rem;padding:12px 0;">Aucun commentaire. Soyez le premier !</p>`;
        }
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
  function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
  });
})();
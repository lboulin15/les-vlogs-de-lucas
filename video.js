// ============================================================
// video.js — V3 avec système de notation
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

  // ---- Player ----
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${video.youtube_id}?rel=0&modestbranding=1`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  playerWrap.appendChild(iframe);

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
  // SYSTÈME DE NOTATION
  // ============================================================
  const starRating    = document.getElementById('starRating');
  const ratingAverage = document.getElementById('ratingAverage');
  const stars         = starRating.querySelectorAll('.star');
  let userRating = 0;

  // Charger la note de l'utilisateur + moyenne
  async function loadRatings() {
    try {
      // Note de l'utilisateur connecté
      const { data: myRating } = await supabase
        .from('ratings')
        .select('rating')
        .eq('video_id', videoId)
        .eq('user_id', user.id)
        .single();

      // Toutes les notes pour la moyenne
      const { data: allRatings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('video_id', videoId);

      // Afficher la note de l'utilisateur
      userRating = myRating?.rating || 0;
      renderStars(userRating);

      // Calculer et afficher la moyenne
      if (allRatings && allRatings.length > 0) {
        const sum = allRatings.reduce((acc, r) => acc + r.rating, 0);
        const avg = (sum / allRatings.length).toFixed(1);
        const count = allRatings.length;
        ratingAverage.innerHTML = `
          <span class="rating-avg-number">${avg}</span>
          <span class="rating-avg-stars">${renderStarsText(parseFloat(avg))}</span>
          <span class="rating-avg-count">${count} avis</span>
        `;
      } else {
        ratingAverage.innerHTML = `<span class="rating-avg-empty">Aucune note pour l'instant</span>`;
      }
    } catch (e) {
      // Table ratings peut ne pas exister encore
      ratingAverage.innerHTML = `<span class="rating-avg-empty">Notes indisponibles</span>`;
    }
  }

  function renderStars(value) {
    stars.forEach(star => {
      const v = parseInt(star.dataset.value);
      star.classList.toggle('active', v <= value);
    });
  }

  function renderStarsText(avg) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(avg)) html += '<span class="star-filled">★</span>';
      else if (i - avg < 1 && i - avg > 0) html += '<span class="star-half">★</span>';
      else html += '<span class="star-empty">★</span>';
    }
    return html;
  }

  // Hover sur les étoiles
  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      const v = parseInt(star.dataset.value);
      renderStars(v);
    });
    star.addEventListener('mouseleave', () => {
      renderStars(userRating);
    });
    star.addEventListener('click', async () => {
      const newRating = parseInt(star.dataset.value);

      // Si même note → retirer la note
      const finalRating = newRating === userRating ? 0 : newRating;

      try {
        if (finalRating === 0) {
          await supabase.from('ratings')
            .delete()
            .eq('video_id', videoId)
            .eq('user_id', user.id);
          showToast('Note supprimée.', 'success');
        } else {
          await supabase.from('ratings')
            .upsert(
              { user_id: user.id, video_id: videoId, rating: finalRating },
              { onConflict: 'user_id,video_id' }
            );
          showToast(`${finalRating} étoile${finalRating > 1 ? 's' : ''} — Merci !`, 'success');
        }
        userRating = finalRating;
        await loadRatings();
      } catch (err) {
        showToast('Erreur lors de la notation.', 'error');
      }
    });
  });

  await loadRatings();

  // ---- Vidéos suggérées ----
  let allAccessVideos = [];
  try {
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
  } catch (e) { /* silencieux */ }

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
        </div>
      `;
      card.addEventListener('click', () => navigateTo(`video.html?id=${v.id}`));
      suggestedRow.appendChild(card);
    });
  }

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
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

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
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
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
        <div class="comment-body">${escapeHtml(comment.content)}</div>
      `;
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
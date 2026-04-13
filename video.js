// ============================================================
// video.js — V2 Enhanced
// ============================================================
import { supabase } from './supabaseClient.js';

const pageTransition = document.getElementById('pageTransition');
function navigateTo(url) {
  pageTransition.classList.add('out');
  setTimeout(() => { window.location.href = url; }, 280);
}

// Couleurs pour avatars
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
  const name = email.split('@')[0];
  return name.substring(0, 2).toUpperCase();
}

(async () => {
  const loadingScreen = document.getElementById('loadingScreen');
  const navbar = document.getElementById('navbar');
  const videoPage = document.getElementById('videoPage');
  const navUserEmail = document.getElementById('navUserEmail');
  const adminLink = document.getElementById('adminLink');
  const logoutBtn = document.getElementById('logoutBtn');
  const backBtn = document.getElementById('backBtn');
  const playerWrap = document.getElementById('playerWrap');
  const videoTitleEl = document.getElementById('videoTitle');
  const videoDateEl = document.getElementById('videoDate');
  const commentInput = document.getElementById('commentInput');
  const commentSubmit = document.getElementById('commentSubmit');
  const commentList = document.getElementById('commentList');
  const suggestedSection = document.getElementById('suggestedSection');
  const suggestedRow = document.getElementById('suggestedRow');

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
  const params = new URLSearchParams(window.location.search);
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

  // ---- Charger la vidéo ----
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

  // ---- Marquer progression localStorage (simulé à 100% à l'ouverture) ----
  const existingProgress = parseInt(localStorage.getItem(`progress_${videoId}`) || '0');
  if (existingProgress < 100) {
    // On met 60% si première visite, 100% après
    localStorage.setItem(`progress_${videoId}`, existingProgress === 0 ? '60' : '100');
  }

  // ---- UI ----
  logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); navigateTo('index.html'); });
  backBtn.addEventListener('click', () => navigateTo('home.html'));
  adminLink?.addEventListener('click', (e) => { e.preventDefault(); navigateTo('admin.html'); });

  // ---- Vidéos suggérées ----
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
          <img src="https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg" alt="${escapeHtml(v.title)}" loading="lazy" />
        </div>
        <div class="suggested-info">
          <div class="suggested-card-title">${escapeHtml(v.title)}</div>
        </div>
      `;
      card.addEventListener('click', () => navigateTo(`video.html?id=${v.id}`));
      suggestedRow.appendChild(card);
    });
  }

  // ---- Afficher ----
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
    const { error } = await supabase.from('comments').insert({ video_id: videoId, user_id: user.id, content });
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
      const email = comment.profiles?.email || 'utilisateur@lucas.fr';
      const initials = getInitials(email);
      const [bg, fg] = getAvatarColor(email);
      const author = email.split('@')[0];
      const date = new Date(comment.created_at).toLocaleDateString('fr-FR', {
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
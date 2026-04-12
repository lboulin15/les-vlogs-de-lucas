// ============================================================
// video.js — Page vidéo + commentaires
// ============================================================
import { supabase } from './supabaseClient.js';

(async () => {
  const loadingScreen = document.getElementById('loadingScreen');
  const navbar = document.getElementById('navbar');
  const videoPage = document.getElementById('videoPage');
  const navUserEmail = document.getElementById('navUserEmail');
  const logoutBtn = document.getElementById('logoutBtn');
  const backBtn = document.getElementById('backBtn');
  const playerWrap = document.getElementById('playerWrap');
  const videoTitle = document.getElementById('videoTitle');
  const videoDate = document.getElementById('videoDate');
  const commentInput = document.getElementById('commentInput');
  const commentSubmit = document.getElementById('commentSubmit');
  const commentList = document.getElementById('commentList');

  // ---- Auth check ----
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  const user = session.user;

  // ---- Profil ----
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, is_admin')
    .eq('id', user.id)
    .single();

  navUserEmail.textContent = profile?.email || user.email;

  // ---- Video ID depuis URL ----
  const params = new URLSearchParams(window.location.search);
  const videoId = params.get('id');

  if (!videoId) {
    window.location.href = 'home.html';
    return;
  }

  // ---- Vérifier accès (ou admin) ----
  let hasAccess = profile?.is_admin;

  if (!hasAccess) {
    const { data: access } = await supabase
      .from('user_videos')
      .select('id')
      .eq('user_id', user.id)
      .eq('video_id', videoId)
      .single();
    hasAccess = !!access;
  }

  if (!hasAccess) {
    window.location.href = 'home.html';
    return;
  }

  // ---- Charger la vidéo ----
  const { data: video, error: vError } = await supabase
    .from('videos')
    .select('id, title, youtube_id, created_at')
    .eq('id', videoId)
    .single();

  if (vError || !video) {
    window.location.href = 'home.html';
    return;
  }

  // ---- Afficher la vidéo ----
  videoTitle.textContent = video.title;
  videoDate.textContent = new Date(video.created_at).toLocaleDateString('fr-FR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${video.youtube_id}?rel=0&modestbranding=1`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  playerWrap.appendChild(iframe);

  // ---- UI ----
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });

  backBtn.addEventListener('click', () => {
    window.location.href = profile?.is_admin ? 'admin.html' : 'home.html';
  });

  loadingScreen.style.display = 'none';
  navbar.style.display = 'flex';
  videoPage.style.display = 'block';

  // ---- Charger les commentaires ----
  await loadComments();

  // ---- Soumettre un commentaire ----
  commentSubmit.addEventListener('click', async () => {
    const content = commentInput.value.trim();
    if (!content) { showToast('Commentaire vide.', 'error'); return; }
    if (content.length > 1000) { showToast('Commentaire trop long (max 1000 caractères).', 'error'); return; }

    commentSubmit.disabled = true;
    commentSubmit.textContent = 'Publication...';

    const { error } = await supabase
      .from('comments')
      .insert({ video_id: videoId, user_id: user.id, content });

    commentSubmit.disabled = false;
    commentSubmit.textContent = 'Publier';

    if (error) {
      showToast('Erreur lors de la publication.', 'error');
      return;
    }

    commentInput.value = '';
    showToast('Commentaire publié !', 'success');
    await loadComments();
  });

  // ---- Charger les commentaires ----
  async function loadComments() {
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles:user_id ( email )
      `)
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
      const el = document.createElement('div');
      el.className = 'comment-item';
      el.dataset.id = comment.id;

      const authorEmail = comment.profiles?.email || 'Utilisateur';
      const author = authorEmail.split('@')[0];
      const date = new Date(comment.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const isOwn = comment.user_id === user.id || profile?.is_admin;

      el.innerHTML = `
        <div class="comment-header">
          <span class="comment-author">@${escapeHtml(author)}</span>
          <span class="comment-date">${date}</span>
        </div>
        <div class="comment-body">${escapeHtml(comment.content)}</div>
        ${isOwn ? `
          <div class="comment-footer">
            <button class="btn btn-danger btn-sm delete-comment-btn" data-id="${comment.id}">
              Supprimer
            </button>
          </div>
        ` : ''}
      `;

      commentList.appendChild(el);
    });

    // Bind delete buttons
    commentList.querySelectorAll('.delete-comment-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cid = btn.dataset.id;
        await deleteComment(cid);
      });
    });
  }

  async function deleteComment(commentId) {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) { showToast('Erreur lors de la suppression.', 'error'); return; }

    showToast('Commentaire supprimé.', 'success');
    const el = commentList.querySelector(`[data-id="${commentId}"]`);
    if (el) el.remove();

    if (commentList.children.length === 0) {
      commentList.innerHTML = `<p style="color:var(--text-dim);font-size:0.85rem;padding:12px 0;">Aucun commentaire. Soyez le premier !</p>`;
    }
  }

  // ---- Helpers ----
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
  });
})();
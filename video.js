// ============================================================
// video.js — V3 : Vimeo hash, description, historique, réactions, réponses
// ============================================================
import { supabase } from './supabaseClient.js';

// ---- Thème ----
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
function getInitials(email) { return email.split('@')[0].substring(0, 2).toUpperCase(); }

let ytApiReady = false;
let ytApiCallbacks = [];
function loadYouTubeAPI() {
  return new Promise(resolve => {
    if (ytApiReady) { resolve(); return; }
    ytApiCallbacks.push(resolve);
    if (document.getElementById('yt-api-script')) return;
    const s = document.createElement('script');
    s.id = 'yt-api-script'; s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
}
window.onYouTubeIframeAPIReady = () => {
  ytApiReady = true;
  ytApiCallbacks.forEach(cb => cb());
  ytApiCallbacks = [];
};

(async () => {
  const loadingScreen    = document.getElementById('loadingScreen');
  const navbar           = document.getElementById('navbar');
  const videoPage        = document.getElementById('videoPage');
  const navUserEmail     = document.getElementById('navUserEmail');
  const adminLink        = document.getElementById('adminLink');
  const logoutBtn        = document.getElementById('logoutBtn');
  const backBtn          = document.getElementById('backBtn');
  const playerWrap       = document.getElementById('playerWrap');
  const videoTitleEl     = document.getElementById('videoTitle');
  const videoDateEl      = document.getElementById('videoDate');
  const videoDescEl      = document.getElementById('videoDescription');
  const commentInput     = document.getElementById('commentInput');
  const commentSubmit    = document.getElementById('commentSubmit');
  const commentList      = document.getElementById('commentList');
  const suggestedSection = document.getElementById('suggestedSection');
  const suggestedRow     = document.getElementById('suggestedRow');
  const themeToggle      = document.getElementById('themeToggle');

  // ---- Thème toggle ----
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
    .from('profiles').select('email, is_admin').eq('id', user.id).single();
  const isAdmin = profile?.is_admin === true;
  navUserEmail.textContent = profile?.email || user.email;
  if (isAdmin) adminLink.style.display = 'inline-flex';

  // ---- Video ID ----
  const params  = new URLSearchParams(window.location.search);
  const videoId = params.get('id');
  if (!videoId) { window.location.href = 'home.html'; return; }

  // ---- Accès ----
  let hasAccess = isAdmin;
  if (!hasAccess) {
    const { data } = await supabase.from('user_videos').select('id').eq('user_id', user.id).eq('video_id', videoId).single();
    hasAccess = !!data;
  }
  if (!hasAccess) { navigateTo('home.html'); return; }

  // ---- Charger vidéo ----
  const { data: video } = await supabase
    .from('videos').select('id, title, description, youtube_id, platform, vimeo_hash, thumbnail_url, created_at').eq('id', videoId).single();
  if (!video) { navigateTo('home.html'); return; }

  const platform = video.platform || 'youtube';
  videoTitleEl.textContent = video.title;
  videoDateEl.textContent  = new Date(video.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

  // Description
  if (video.description && video.description.trim()) {
    videoDescEl.textContent = video.description;
    videoDescEl.classList.add('has-content');
  }

  // ---- Nav ----
  logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); navigateTo('index.html'); });
  backBtn.addEventListener('click', () => navigateTo('home.html'));
  adminLink?.addEventListener('click', e => { e.preventDefault(); navigateTo('admin.html'); });

  // ---- Log vue + historique ----
  const device = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' :
                 window.innerWidth < 1024 ? 'tablet' : 'desktop';

  // Log vue (pour stats admin)
  supabase.from('video_views').insert({ video_id: videoId, user_id: user.id, device }).catch(() => {});

  // Historique de visionnage — marquer comme "commencé"
  async function updateWatchProgress(pct) {
    await supabase.from('watch_history').upsert(
      { user_id: user.id, video_id: videoId, progress: pct, device, watched_at: new Date().toISOString() },
      { onConflict: 'user_id,video_id' }
    );
  }
  // Marquer à 30% après 5s (simplifié — pour une vraie intégration utiliser l'API Vimeo Player)
  setTimeout(() => updateWatchProgress(30), 5000);
  setTimeout(() => updateWatchProgress(70), 30000);
  window.addEventListener('beforeunload', () => updateWatchProgress(95));

  // ============================================================
  // LECTEUR
  // ============================================================
  if (platform === 'vimeo') {
    const hashParam = video.vimeo_hash ? `&h=${video.vimeo_hash}` : '';
    const iframe = document.createElement('iframe');
    iframe.src = `https://player.vimeo.com/video/${video.youtube_id}?title=0&byline=0&portrait=0&playsinline=1&color=e50914${hashParam}`;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;border:none;');
    playerWrap.appendChild(iframe);
  } else {
    await loadYouTubeAPI();
    const playerDiv = document.createElement('div');
    playerDiv.id = 'yt-player';
    playerWrap.appendChild(playerDiv);
    new YT.Player('yt-player', {
      videoId: video.youtube_id,
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
      events: { onError: (event) => { showPlayerFallback(video.youtube_id, event.data); } },
    });
  }

  function showPlayerFallback(youtubeId, errorCode) {
    playerWrap.innerHTML = '';
    const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    const thumb      = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    playerWrap.innerHTML = `
      <div class="player-fallback">
        <img class="player-fallback-thumb" src="${thumb}" alt="Miniature" />
        <div class="player-fallback-overlay">
          <div class="player-fallback-icon">⚠️</div>
          <p class="player-fallback-msg">Cette vidéo ne peut pas être lue ici${errorCode === 101 || errorCode === 150 ? ' (intégration désactivée)' : ''}.</p>
          <a href="${youtubeUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-lg player-fallback-btn">▶ Ouvrir sur YouTube</a>
        </div>
      </div>`;
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
      const { data: myRating }   = await supabase.from('ratings').select('rating').eq('video_id', videoId).eq('user_id', user.id).single();
      const { data: allRatings } = await supabase.from('ratings').select('rating').eq('video_id', videoId);
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
    } catch { ratingAverage.innerHTML = `<span class="rating-avg-empty">Notes indisponibles</span>`; }
  }

  function renderStars(value) { stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.value) <= value)); }
  function renderStarsText(avg) {
    let h = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(avg)) h += '<span class="star-filled">★</span>';
      else if (i - avg < 1)    h += '<span class="star-half">★</span>';
      else                      h += '<span class="star-empty">★</span>';
    }
    return h;
  }
  stars.forEach(star => {
    star.addEventListener('mouseenter', () => renderStars(parseInt(star.dataset.value)));
    star.addEventListener('mouseleave', () => renderStars(userRating));
    star.addEventListener('click', async () => {
      const n = parseInt(star.dataset.value);
      const f = n === userRating ? 0 : n;
      if (f === 0) {
        await supabase.from('ratings').delete().eq('video_id', videoId).eq('user_id', user.id);
        showToast('Note supprimée.', 'success');
      } else {
        await supabase.from('ratings').upsert({ user_id: user.id, video_id: videoId, rating: f }, { onConflict: 'user_id,video_id' });
        showToast(`${f} étoile${f > 1 ? 's' : ''} — Merci !`, 'success');
      }
      userRating = f;
      await loadRatings();
    });
  });
  await loadRatings();

  // ---- Vidéos suggérées ----
  try {
    let allAccessVideos = [];
    if (isAdmin) {
      const { data } = await supabase.from('videos').select('id, title, youtube_id, platform, thumbnail_url')
        .neq('id', videoId).order('created_at', { ascending: false }).limit(6);
      allAccessVideos = data || [];
    } else {
      const { data: uvData } = await supabase.from('user_videos').select('video_id').eq('user_id', user.id);
      const ids = (uvData || []).map(uv => uv.video_id).filter(id => id !== videoId);
      if (ids.length > 0) {
        const { data } = await supabase.from('videos').select('id, title, youtube_id, platform, thumbnail_url')
          .in('id', ids).order('created_at', { ascending: false }).limit(6);
        allAccessVideos = data || [];
      }
    }
    if (allAccessVideos.length > 0) {
      suggestedSection.style.display = 'block';
      allAccessVideos.forEach(v => {
        const thumb = v.thumbnail_url || ((v.platform || 'youtube') === 'youtube'
          ? `https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`
          : '');
        const card  = document.createElement('div');
        card.className = 'suggested-card';
        card.innerHTML = `
          <div class="suggested-thumb">
            <img src="${thumb}" alt="${escapeHtml(v.title)}" loading="lazy" />
            ${(v.platform || 'youtube') === 'vimeo' ? '<span class="suggested-platform-badge">Vimeo</span>' : ''}
          </div>
          <div class="suggested-info">
            <div class="suggested-card-title">${escapeHtml(v.title)}</div>
          </div>`;
        card.addEventListener('click', () => navigateTo(`video.html?id=${v.id}`));
        suggestedRow.appendChild(card);
      });
    }
  } catch {}

  // ---- Afficher la page ----
  loadingScreen.style.display = 'none';
  navbar.style.display = 'flex';
  videoPage.style.display = 'block';
  setTimeout(() => { pageTransition.style.opacity = '0'; }, 50);

  // ============================================================
  // COMMENTAIRES avec réactions et réponses
  // ============================================================
  await loadComments();

  commentSubmit.addEventListener('click', async () => {
    const content = commentInput.value.trim();
    if (!content) { showToast('Commentaire vide.', 'error'); return; }
    if (content.length > 1000) { showToast('Trop long (max 1000 caractères).', 'error'); return; }
    commentSubmit.disabled = true; commentSubmit.textContent = 'Publication...';
    const { error } = await supabase.from('comments').insert({ video_id: videoId, user_id: user.id, content });
    commentSubmit.disabled = false; commentSubmit.textContent = 'Publier';
    if (error) { showToast('Erreur publication.', 'error'); return; }
    commentInput.value = '';
    showToast('Commentaire publié !', 'success');
    await loadComments();
  });

  async function loadComments() {
    // Charger tous les commentaires (top-level + réponses)
    const { data: allComments, error } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, parent_id, profiles:user_id(email)')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true });

    if (error) { commentList.innerHTML = `<p style="color:var(--text-dim);">Impossible de charger les commentaires.</p>`; return; }
    if (!allComments || allComments.length === 0) {
      commentList.innerHTML = `<p style="color:var(--text-dim);padding:12px 0;">Aucun commentaire. Soyez le premier !</p>`;
      return;
    }

    // Charger les réactions
    const commentIds = allComments.map(c => c.id);
    let reactionsMap = {}; // comment_id -> { '👍': count, '❤️': count, myReactions: Set }
    try {
      const { data: reactions } = await supabase
        .from('comment_reactions').select('comment_id, user_id, emoji').in('comment_id', commentIds);
      (reactions || []).forEach(r => {
        if (!reactionsMap[r.comment_id]) reactionsMap[r.comment_id] = { '👍': 0, '❤️': 0, mine: new Set() };
        reactionsMap[r.comment_id][r.emoji]++;
        if (r.user_id === user.id) reactionsMap[r.comment_id].mine.add(r.emoji);
      });
    } catch {}

    // Séparer top-level et réponses
    const topLevel = allComments.filter(c => !c.parent_id);
    const replies  = allComments.filter(c => c.parent_id);
    const repliesByParent = {};
    replies.forEach(r => {
      if (!repliesByParent[r.parent_id]) repliesByParent[r.parent_id] = [];
      repliesByParent[r.parent_id].push(r);
    });

    commentList.innerHTML = '';
    // Afficher en ordre décroissant pour les top-level
    [...topLevel].reverse().forEach(comment => {
      const el = buildCommentEl(comment, reactionsMap, false);
      // Réponses
      const commentReplies = repliesByParent[comment.id] || [];
      if (commentReplies.length > 0) {
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'comment-replies';
        commentReplies.forEach(rep => {
          const repEl = buildCommentEl(rep, reactionsMap, true);
          repliesContainer.appendChild(repEl);
        });
        el.appendChild(repliesContainer);
      }
      commentList.appendChild(el);
    });
  }

  function buildCommentEl(comment, reactionsMap, isReply) {
    const email    = comment.profiles?.email || 'utilisateur@lucas.fr';
    const initials = getInitials(email);
    const [bg, fg] = getAvatarColor(email);
    const author   = email.split('@')[0];
    const date     = new Date(comment.created_at).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const canDelete = comment.user_id === user.id || isAdmin;
    const reactions = reactionsMap[comment.id] || { '👍': 0, '❤️': 0, mine: new Set() };

    const el = document.createElement('div');
    el.className = isReply ? 'reply-item' : 'comment-item';
    el.dataset.id = comment.id;

    el.innerHTML = `
      <div class="comment-header">
        <div class="comment-avatar" style="background:${bg};color:${fg};">${initials}</div>
        <div class="comment-header-info">
          <div class="comment-author">@${escapeHtml(author)}</div>
          <div class="comment-date">${date}</div>
        </div>
        ${canDelete ? `<button class="btn btn-danger btn-sm delete-comment-btn" data-id="${comment.id}" style="margin-left:auto;">✕</button>` : ''}
      </div>
      <div class="comment-body">${escapeHtml(comment.content)}</div>
      <div class="comment-actions">
        <button class="reaction-btn ${reactions.mine.has('👍') ? 'active' : ''}" data-comment="${comment.id}" data-emoji="👍">
          👍 <span class="reaction-count">${reactions['👍'] || ''}</span>
        </button>
        <button class="reaction-btn ${reactions.mine.has('❤️') ? 'active' : ''}" data-comment="${comment.id}" data-emoji="❤️">
          ❤️ <span class="reaction-count">${reactions['❤️'] || ''}</span>
        </button>
        ${!isReply ? `<button class="reply-btn" data-comment="${comment.id}">Répondre</button>` : ''}
      </div>
      ${!isReply ? `
        <div class="reply-form" id="reply-form-${comment.id}">
          <textarea placeholder="Votre réponse..." rows="2"></textarea>
          <button class="btn btn-primary btn-sm send-reply-btn" data-parent="${comment.id}">Envoyer</button>
        </div>` : ''}`;

    // Supprimer
    el.querySelector('.delete-comment-btn')?.addEventListener('click', async () => {
      const { error } = await supabase.from('comments').delete().eq('id', comment.id);
      if (error) { showToast('Erreur suppression.', 'error'); return; }
      showToast('Commentaire supprimé.', 'success');
      await loadComments();
    });

    // Réactions
    el.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cId   = btn.dataset.comment;
        const emoji = btn.dataset.emoji;
        const isActive = btn.classList.contains('active');
        try {
          if (isActive) {
            await supabase.from('comment_reactions').delete()
              .eq('comment_id', cId).eq('user_id', user.id).eq('emoji', emoji);
          } else {
            await supabase.from('comment_reactions').upsert(
              { comment_id: cId, user_id: user.id, emoji },
              { onConflict: 'comment_id,user_id,emoji' }
            );
          }
          await loadComments();
        } catch { showToast('Erreur réaction.', 'error'); }
      });
    });

    // Reply toggle
    el.querySelector('.reply-btn')?.addEventListener('click', () => {
      const form = document.getElementById(`reply-form-${comment.id}`);
      form.classList.toggle('open');
      if (form.classList.contains('open')) form.querySelector('textarea').focus();
    });

    // Send reply
    el.querySelector('.send-reply-btn')?.addEventListener('click', async (e) => {
      const parentId = e.target.dataset.parent;
      const form = document.getElementById(`reply-form-${parentId}`);
      const content = form.querySelector('textarea').value.trim();
      if (!content) return;
      e.target.disabled = true;
      const { error } = await supabase.from('comments').insert({
        video_id: videoId, user_id: user.id, content, parent_id: parentId
      });
      e.target.disabled = false;
      if (error) { showToast('Erreur.', 'error'); return; }
      showToast('Réponse publiée !', 'success');
      await loadComments();
    });

    return el;
  }

  // ---- Helpers ----
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }
  function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg; toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') window.location.href = 'index.html'; });
})();
// ============================================================
// video.js — Netflix-like player page
// ============================================================
import { supabase } from './supabaseClient.js';

// ============================================================
// DOM
// ============================================================
const loadingScreen = document.getElementById('loadingScreen');
const videoPage = document.getElementById('videoPage');

const backBtn = document.getElementById('backBtn');
const logoutBtn = document.getElementById('logoutBtn');

const playerWrap = document.getElementById('playerWrap');
const videoTitleEl = document.getElementById('videoTitle');
const videoDateEl = document.getElementById('videoDate');
const videoDescriptionEl = document.getElementById('videoDescription');

const starRating = document.getElementById('starRating');

const suggestedSection = document.getElementById('suggestedSection');
const suggestedTrack = document.getElementById('suggestedTrack');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

const commentInput = document.getElementById('commentInput');
const commentSubmit = document.getElementById('commentSubmit');
const commentList = document.getElementById('commentList');

const toast = document.getElementById('toast');

// ============================================================
// STATE
// ============================================================
const params = new URLSearchParams(window.location.search);
const videoId = params.get('id');

let currentUser = null;
let currentProfile = null;
let currentVideo = null;

let userRating = 0;
let sliderIndex = 0;

let youtubePlayer = null;
let saveProgressInterval = null;
let resumeProgress = 0;
let videoDuration = 0;

// ratingAverage n'est pas toujours présent dans le HTML
let ratingAverage = document.getElementById('ratingAverage');
if (!ratingAverage && starRating?.parentElement) {
  ratingAverage = document.createElement('div');
  ratingAverage.id = 'ratingAverage';
  ratingAverage.className = 'video-meta';
  ratingAverage.style.marginTop = '10px';
  starRating.parentElement.appendChild(ratingAverage);
}

// ============================================================
// HELPERS
// ============================================================
function showToast(message, type = 'success') {
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type} show`;

  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

function formatLongDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getYoutubeThumb(youtubeId, quality = 'mqdefault') {
  return `https://img.youtube.com/vi/${youtubeId}/${quality}.jpg`;
}

function getDeviceType() {
  if (/Mobi|Android/i.test(navigator.userAgent)) return 'mobile';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
}

function getVisibleCardsCount() {
  if (window.innerWidth < 560) return 1;
  if (window.innerWidth < 900) return 2;
  return 3;
}

function renderStars(value) {
  const stars = starRating?.querySelectorAll('span') || [];
  stars.forEach((star) => {
    const starValue = parseInt(star.dataset.value, 10);
    star.classList.toggle('active', starValue <= value);
  });
}

function updateSliderButtons() {
  const totalCards = suggestedTrack?.children?.length || 0;
  const visibleCards = getVisibleCardsCount();
  const maxIndex = Math.max(0, totalCards - visibleCards);

  if (prevBtn) prevBtn.disabled = sliderIndex <= 0;
  if (nextBtn) nextBtn.disabled = sliderIndex >= maxIndex;
}

function updateSliderPosition() {
  const firstCard = suggestedTrack?.querySelector('.card');
  if (!firstCard) {
    updateSliderButtons();
    return;
  }

  const styles = window.getComputedStyle(suggestedTrack);
  const gap = parseFloat(styles.gap || styles.columnGap || '0') || 0;
  const cardWidth = firstCard.getBoundingClientRect().width;
  const offset = sliderIndex * (cardWidth + gap);

  suggestedTrack.style.transform = `translateX(-${offset}px)`;
  updateSliderButtons();
}

function resetSliderIfNeeded() {
  const totalCards = suggestedTrack?.children?.length || 0;
  const visibleCards = getVisibleCardsCount();
  const maxIndex = Math.max(0, totalCards - visibleCards);

  if (sliderIndex > maxIndex) {
    sliderIndex = maxIndex;
  }

  updateSliderPosition();
}

function createSuggestedCard(video) {
  const article = document.createElement('article');
  article.className = 'card fade-in';

  const thumb = video.thumbnail_url || getYoutubeThumb(video.youtube_id);
  article.innerHTML = `
    <img
      src="${thumb}"
      alt="${escapeHtml(video.title)}"
      loading="lazy"
    />
  `;

  article.addEventListener('click', () => {
    window.location.href = `video.html?id=${video.id}`;
  });

  return article;
}

function createCommentElement(comment) {
  const item = document.createElement('div');
  item.className = 'comment fade-in';

  const author =
    comment.profiles?.email?.split('@')[0] ||
    comment.author_email?.split('@')[0] ||
    'Utilisateur';

  item.innerHTML = `
    <div class="comment-header">
      <strong>${escapeHtml(author)}</strong> · ${formatShortDate(comment.created_at)}
    </div>
    <div class="comment-body">${escapeHtml(comment.content)}</div>
  `;

  return item;
}

function showPage() {
  if (loadingScreen) loadingScreen.style.display = 'none';
  if (videoPage) videoPage.style.display = 'block';
}

// ============================================================
// AUTH / PROFILE / ACCESS
// ============================================================
async function loadSessionAndProfile() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData?.session?.user) {
    window.location.href = 'index.html';
    return false;
  }

  currentUser = sessionData.session.user;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, is_admin')
    .eq('id', currentUser.id)
    .single();

  if (profileError) {
    console.error('Erreur profil :', profileError);
    window.location.href = 'index.html';
    return false;
  }

  currentProfile = profile;
  return true;
}

async function userHasAccessToVideo() {
  if (!currentUser || !videoId) return false;

  if (currentProfile?.is_admin === true) return true;

  const { data, error } = await supabase
    .from('user_videos')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('video_id', videoId)
    .maybeSingle();

  if (error) {
    console.error('Erreur accès vidéo :', error);
    return false;
  }

  return !!data;
}

// ============================================================
// VIDEO
// ============================================================
async function loadSavedProgress() {
  if (!currentUser || !videoId) return 0;

  try {
    const { data, error } = await supabase
      .from('watch_history')
      .select('progress')
      .eq('user_id', currentUser.id)
      .eq('video_id', videoId)
      .maybeSingle();

    if (error) {
      console.error('Erreur récupération progression :', error);
      return 0;
    }

    return data?.progress || 0;
  } catch (err) {
    console.error('Erreur loadSavedProgress :', err);
    return 0;
  }
}

async function loadVideo() {
  const { data: video, error } = await supabase
    .from('videos')
    .select('id, title, description, youtube_id, thumbnail_url, created_at, deleted_at')
    .eq('id', videoId)
    .maybeSingle();

  if (error || !video || video.deleted_at) {
    console.error('Erreur vidéo :', error);
    window.location.href = 'home.html';
    return false;
  }

  currentVideo = video;

  videoTitleEl.textContent = video.title || 'Sans titre';
  videoDateEl.textContent = formatLongDate(video.created_at);
  videoDescriptionEl.textContent =
    video.description?.trim() || 'Aucune description pour cette vidéo pour le moment.';

  resumeProgress = await loadSavedProgress();

  playerWrap.innerHTML = `<div id="youtubePlayer"></div>`;

  loadYouTubePlayer(video.youtube_id);

  return true;
}

function loadYouTubeIframeAPI() {
  return new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    let timeoutId = null;
    let intervalId = null;

    function cleanup() {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    }

    const existingScript = document.querySelector('script[data-youtube-api="true"]');

    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.setAttribute('data-youtube-api', 'true');
      document.head.appendChild(tag);
    }

    window.onYouTubeIframeAPIReady = () => {
      cleanup();
      resolve();
    };

    intervalId = setInterval(() => {
      if (window.YT && window.YT.Player) {
        cleanup();
        resolve();
      }
    }, 100);

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('L’API YouTube n’a pas chargé à temps.'));
    }, 10000);
  });
}

async function loadYouTubePlayer(youtubeId) {
  try {
    await loadYouTubeIframeAPI();

    youtubePlayer = new window.YT.Player('youtubePlayer', {
      videoId: youtubeId,
      playerVars: {
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        start: 0,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  } catch (err) {
    console.error('Erreur chargement player YouTube :', err);

    playerWrap.innerHTML = `
      <iframe
        src="https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1"
        title="Lecteur vidéo"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    `;
  }
}

function onPlayerReady(event) {
  try {
    videoDuration = event.target.getDuration() || 0;

    if (resumeProgress > 0 && resumeProgress < 95 && videoDuration > 0) {
      const resumeSeconds = Math.floor((resumeProgress / 100) * videoDuration);

      if (resumeSeconds > 5 && resumeSeconds < videoDuration - 5) {
        event.target.seekTo(resumeSeconds, true);
      }
    }
  } catch (err) {
    console.error('Erreur onPlayerReady :', err);
  }
}

function onPlayerStateChange(event) {
  const YTState = window.YT?.PlayerState;
  if (!YTState) return;

  if (event.data === YTState.PLAYING) {
    startProgressTracking();
  }

  if (event.data === YTState.PAUSED) {
    saveCurrentProgress();
    stopProgressTracking();
  }

  if (event.data === YTState.ENDED) {
    updateWatchProgress(100);
    stopProgressTracking();
  }
}

function startProgressTracking() {
  stopProgressTracking();

  saveProgressInterval = window.setInterval(() => {
    saveCurrentProgress();
  }, 5000);
}

function stopProgressTracking() {
  if (saveProgressInterval) {
    window.clearInterval(saveProgressInterval);
    saveProgressInterval = null;
  }
}

function saveCurrentProgress() {
  if (!youtubePlayer || typeof youtubePlayer.getCurrentTime !== 'function') return;
  if (!youtubePlayer.getDuration || typeof youtubePlayer.getDuration !== 'function') return;

  try {
    const currentTime = youtubePlayer.getCurrentTime();
    const duration = youtubePlayer.getDuration();

    if (!duration || duration <= 0) return;

    const progress = Math.min(100, Math.round((currentTime / duration) * 100));
    updateWatchProgress(progress);
  } catch (err) {
    console.error('Erreur saveCurrentProgress :', err);
  }
}

async function logView() {
  if (!currentUser || !videoId) return;

  try {
    const { error } = await supabase.from('video_views').insert({
      video_id: videoId,
      user_id: currentUser.id,
      device: getDeviceType(),
    });

    if (error) {
      console.error('Erreur log vue :', error);
    }
  } catch (err) {
    console.error('Erreur inattendue log vue :', err);
  }
}

async function updateWatchProgress(progress) {
  if (!currentUser || !videoId) return;

  try {
    const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));

    const { data: existing, error: readError } = await supabase
      .from('watch_history')
      .select('progress')
      .eq('user_id', currentUser.id)
      .eq('video_id', videoId)
      .maybeSingle();

    if (readError) {
      console.error('Erreur lecture watch history :', readError);
      return;
    }

    const previousProgress = existing?.progress || 0;
    const nextProgress = Math.max(previousProgress, safeProgress);

    const { error } = await supabase.from('watch_history').upsert(
      {
        user_id: currentUser.id,
        video_id: videoId,
        progress: nextProgress,
        device: getDeviceType(),
        watched_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,video_id' }
    );

    if (error) {
      console.error('Erreur watch history :', error);
    }
  } catch (err) {
    console.error('Erreur inattendue watch history :', err);
  }
}

// ============================================================
// RATINGS
// ============================================================
async function loadRatings() {
  try {
    const { data: myRating, error: myRatingError } = await supabase
      .from('ratings')
      .select('rating')
      .eq('video_id', videoId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (myRatingError) {
      console.error('Erreur note user :', myRatingError);
    }

    const { data: allRatings, error: allRatingsError } = await supabase
      .from('ratings')
      .select('rating')
      .eq('video_id', videoId);

    if (allRatingsError) {
      console.error('Erreur notes vidéo :', allRatingsError);
      if (ratingAverage) ratingAverage.textContent = 'Notes indisponibles';
      return;
    }

    userRating = myRating?.rating || 0;
    renderStars(userRating);

    if (!allRatings || allRatings.length === 0) {
      if (ratingAverage) ratingAverage.textContent = 'Aucune note pour le moment';
      return;
    }

    const average =
      allRatings.reduce((sum, item) => sum + item.rating, 0) / allRatings.length;

    if (ratingAverage) {
      ratingAverage.textContent = `${average.toFixed(1)} / 5 · ${allRatings.length} avis`;
    }
  } catch (err) {
    console.error('Erreur loadRatings :', err);
    if (ratingAverage) ratingAverage.textContent = 'Notes indisponibles';
  }
}

function bindRatingEvents() {
  const stars = starRating?.querySelectorAll('span') || [];

  stars.forEach((star) => {
    star.addEventListener('mouseenter', () => {
      renderStars(parseInt(star.dataset.value, 10));
    });

    star.addEventListener('mouseleave', () => {
      renderStars(userRating);
    });

    star.addEventListener('click', async () => {
      const clickedValue = parseInt(star.dataset.value, 10);
      const nextValue = clickedValue === userRating ? 0 : clickedValue;

      try {
        if (nextValue === 0) {
          const { error } = await supabase
            .from('ratings')
            .delete()
            .eq('video_id', videoId)
            .eq('user_id', currentUser.id);

          if (error) {
            console.error(error);
            showToast('Impossible de supprimer la note.', 'error');
            return;
          }

          showToast('Note supprimée.');
        } else {
          const { error } = await supabase.from('ratings').upsert(
            {
              video_id: videoId,
              user_id: currentUser.id,
              rating: nextValue,
            },
            { onConflict: 'user_id,video_id' }
          );

          if (error) {
            console.error(error);
            showToast('Impossible d’enregistrer la note.', 'error');
            return;
          }

          showToast('Note enregistrée.');
        }

        await loadRatings();
      } catch (err) {
        console.error(err);
        showToast('Erreur lors de la note.', 'error');
      }
    });
  });
}

// ============================================================
// SUGGESTIONS
// ============================================================
async function loadSuggestions() {
  try {
    let suggestions = [];

    if (currentProfile?.is_admin) {
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, youtube_id, thumbnail_url, created_at, deleted_at')
        .neq('id', videoId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) {
        console.error('Erreur suggestions admin :', error);
        return;
      }

      suggestions = data || [];
    } else {
      const { data: accessRows, error: accessError } = await supabase
        .from('user_videos')
        .select('video_id')
        .eq('user_id', currentUser.id);

      if (accessError) {
        console.error('Erreur accès suggestions :', accessError);
        return;
      }

      const ids = (accessRows || [])
        .map((row) => row.video_id)
        .filter((id) => id !== videoId);

      if (!ids.length) {
        suggestedSection.style.display = 'none';
        return;
      }

      const { data, error } = await supabase
        .from('videos')
        .select('id, title, youtube_id, thumbnail_url, created_at, deleted_at')
        .in('id', ids)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) {
        console.error('Erreur suggestions user :', error);
        return;
      }

      suggestions = data || [];
    }

    if (!suggestions.length) {
      suggestedSection.style.display = 'none';
      return;
    }

    suggestedTrack.innerHTML = '';
    suggestions.forEach((video) => {
      suggestedTrack.appendChild(createSuggestedCard(video));
    });

    suggestedSection.style.display = 'block';
    sliderIndex = 0;
    resetSliderIfNeeded();
  } catch (err) {
    console.error('Erreur loadSuggestions :', err);
  }
}

function bindSliderEvents() {
  prevBtn?.addEventListener('click', () => {
    if (sliderIndex <= 0) return;
    sliderIndex -= 1;
    updateSliderPosition();
  });

  nextBtn?.addEventListener('click', () => {
    const totalCards = suggestedTrack?.children?.length || 0;
    const visibleCards = getVisibleCardsCount();
    const maxIndex = Math.max(0, totalCards - visibleCards);

    if (sliderIndex >= maxIndex) return;
    sliderIndex += 1;
    updateSliderPosition();
  });

  window.addEventListener('resize', () => {
    resetSliderIfNeeded();
  });
}

// ============================================================
// COMMENTS
// ============================================================
async function loadComments() {
  try {
    const { data: comments, error } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, profiles:user_id(email)')
      .eq('video_id', videoId)
      .is('parent_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur commentaires :', error);
      commentList.innerHTML = `<p class="comment-empty">Impossible de charger les commentaires.</p>`;
      return;
    }

    if (!comments || !comments.length) {
      commentList.innerHTML = `<p class="comment-empty">Aucun commentaire pour le moment.</p>`;
      return;
    }

    commentList.innerHTML = '';
    comments.forEach((comment) => {
      commentList.appendChild(createCommentElement(comment));
    });
  } catch (err) {
    console.error('Erreur loadComments :', err);
    commentList.innerHTML = `<p class="comment-empty">Impossible de charger les commentaires.</p>`;
  }
}

function bindCommentEvents() {
  commentSubmit?.addEventListener('click', async () => {
    const content = commentInput.value.trim();

    if (!content) {
      showToast('Le commentaire est vide.', 'error');
      return;
    }

    if (content.length > 1000) {
      showToast('Commentaire trop long.', 'error');
      return;
    }

    commentSubmit.disabled = true;
    commentSubmit.textContent = 'Publication...';

    try {
      const { error } = await supabase.from('comments').insert({
        video_id: videoId,
        user_id: currentUser.id,
        content,
      });

      if (error) {
        console.error(error);
        showToast('Impossible de publier.', 'error');
        return;
      }

      commentInput.value = '';
      showToast('Commentaire publié.');
      await loadComments();
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de la publication.', 'error');
    } finally {
      commentSubmit.disabled = false;
      commentSubmit.textContent = 'Publier';
    }
  });
}

// ============================================================
// NAV
// ============================================================
function bindNavEvents() {
  backBtn?.addEventListener('click', () => {
    saveCurrentProgress();
    window.location.href = 'home.html';
  });

  logoutBtn?.addEventListener('click', async () => {
    saveCurrentProgress();
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });
}

// ============================================================
// AUTH SYNC
// ============================================================
function bindAuthSync() {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = 'index.html';
    }
  });
}

// ============================================================
// INIT
// ============================================================
async function init() {
  try {
    if (!videoId) {
      window.location.href = 'home.html';
      return;
    }

    const sessionOk = await loadSessionAndProfile();
    if (!sessionOk) return;

    const hasAccess = await userHasAccessToVideo();
    if (!hasAccess) {
      window.location.href = 'home.html';
      return;
    }

    const videoOk = await loadVideo();
    if (!videoOk) return;

    bindNavEvents();
    bindAuthSync();
    bindRatingEvents();
    bindSliderEvents();
    bindCommentEvents();

    await Promise.all([
      logView(),
      loadRatings(),
      loadSuggestions(),
      loadComments(),
    ]);

    window.addEventListener('beforeunload', () => {
      saveCurrentProgress();
    });

    showPage();
  } catch (err) {
    console.error('Erreur init vidéo :', err);
    showPage();
    showToast('Une erreur est survenue lors du chargement.', 'error');
  }
}

init();
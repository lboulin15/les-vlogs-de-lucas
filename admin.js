// ============================================================
// admin.js — V3 : Vimeo hash, miniature custom, description, invitation, stats
// ============================================================
import { supabase } from './supabaseClient.js';

const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');

(async () => {
  const loadingScreen = document.getElementById('loadingScreen');
  const navbar        = document.getElementById('navbar');
  const adminPage     = document.getElementById('adminPage');
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
    .from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) { window.location.href = 'home.html'; return; }

  loadingScreen.style.display = 'none';
  navbar.style.display = 'flex';
  adminPage.style.display = 'block';

  logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); window.location.href = 'index.html'; });

  // ============================================================
  // NAVIGATION SIDEBAR
  // ============================================================
  const navItems = document.querySelectorAll('.sidebar-nav-item');
  const panels   = document.querySelectorAll('.admin-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.panel;
      navItems.forEach(i => i.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`panel-${target}`).classList.add('active');
      if (target === 'dashboard') loadDashboard();
      if (target === 'videos')    loadVideos();
      if (target === 'users')     loadUsers();
      if (target === 'assign')    loadAssign();
      if (target === 'invite')    loadInvitations();
      if (target === 'stats')     loadStats();
    });
  });

  // ============================================================
  // DASHBOARD
  // ============================================================
  async function loadDashboard() {
    try {
      const [{ count: vCount }, { count: uCount }, { count: aCount }, { count: cCount }, { count: viewCount }, { count: nCount }] =
        await Promise.all([
          supabase.from('videos').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', false),
          supabase.from('user_videos').select('*', { count: 'exact', head: true }),
          supabase.from('comments').select('*', { count: 'exact', head: true }),
          supabase.from('video_views').select('*', { count: 'exact', head: true }),
          supabase.from('notifications').select('*', { count: 'exact', head: true }),
        ]);
      document.getElementById('statVideos').textContent   = vCount ?? 0;
      document.getElementById('statUsers').textContent    = uCount ?? 0;
      document.getElementById('statAssigns').textContent  = aCount ?? 0;
      document.getElementById('statComments').textContent = cCount ?? 0;
      document.getElementById('statViews').textContent    = viewCount ?? 0;
      document.getElementById('statNotifs').textContent   = nCount ?? 0;
    } catch (err) { console.error('Dashboard error:', err); }
  }

  // ============================================================
  // VIDEOS
  // ============================================================
  const addVideoBtn       = document.getElementById('addVideoBtn');
  const newVideoTitle     = document.getElementById('newVideoTitle');
  const newVideoDesc      = document.getElementById('newVideoDesc');
  const newVideoId        = document.getElementById('newVideoId');
  const videoIdLabel      = document.getElementById('videoIdLabel');
  const videoIdHint       = document.getElementById('videoIdHint');
  const adminVideoList    = document.getElementById('adminVideoList');
  const videoListCount    = document.getElementById('videoListCount');
  const vimeoThumbPreview = document.getElementById('vimeoThumbPreview');
  const vimeoThumbImg     = document.getElementById('vimeoThumbImg');
  const vimeoThumbStatus  = document.getElementById('vimeoThumbStatus');
  const vimeoPrivateInfo  = document.getElementById('vimeoPrivateInfo');
  const thumbFileInput    = document.getElementById('thumbFileInput');
  const thumbUploadZone   = document.getElementById('thumbUploadZone');
  const customThumbPreview = document.getElementById('customThumbPreview');

  let selectedPlatform = 'youtube';
  let customThumbFile  = null;

  // Platform toggle
  document.getElementById('btnYoutube').addEventListener('click', () => setPlatform('youtube'));
  document.getElementById('btnVimeo').addEventListener('click', () => setPlatform('vimeo'));

  function setPlatform(platform) {
    selectedPlatform = platform;
    document.getElementById('btnYoutube').classList.toggle('active', platform === 'youtube');
    document.getElementById('btnVimeo').classList.toggle('active', platform === 'vimeo');
    newVideoId.value = '';
    vimeoThumbPreview.style.display = 'none';
    vimeoPrivateInfo.style.display = platform === 'vimeo' ? 'block' : 'none';
    if (platform === 'youtube') {
      videoIdLabel.textContent = 'ID ou URL YouTube';
      newVideoId.placeholder   = 'dQw4w9WgXcQ ou https://youtube.com/watch?v=...';
      videoIdHint.textContent  = 'Colle l\'ID ou l\'URL complète YouTube';
    } else {
      videoIdLabel.textContent = 'URL Vimeo (privée ou publique)';
      newVideoId.placeholder   = 'https://vimeo.com/123456789/abc123def456';
      videoIdHint.textContent  = 'Pour une vidéo privée, colle l\'URL complète avec le hash';
    }
  }

  // Extract IDs
  function extractYoutubeId(input) {
    const patterns = [
      /^([a-zA-Z0-9_-]{11})$/,
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) { const m = input.match(p); if (m) return m[1]; }
    return null;
  }

  function extractVimeoInfo(input) {
    // URL privée avec hash : vimeo.com/123456789/abc123def
    const privateMatch = input.match(/vimeo\.com\/(\d+)\/([a-f0-9]+)/i);
    if (privateMatch) return { id: privateMatch[1], hash: privateMatch[2] };
    // URL standard
    const patterns = [/^(\d+)$/, /vimeo\.com\/(\d+)/, /player\.vimeo\.com\/video\/(\d+)/];
    for (const p of patterns) { const m = input.match(p); if (m) return { id: m[1], hash: null }; }
    return null;
  }

  // Vimeo oEmbed thumbnail
  async function fetchVimeoThumbnail(vimeoId, hash = null) {
    try {
      const url = hash
        ? `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}/${hash}`
        : `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.thumbnail_url || null;
    } catch { return null; }
  }

  // Vimeo preview on input
  let vimeoPreviewTimer = null;
  newVideoId.addEventListener('input', () => {
    if (selectedPlatform !== 'vimeo') return;
    clearTimeout(vimeoPreviewTimer);
    const info = extractVimeoInfo(newVideoId.value.trim());
    if (!info) { vimeoThumbPreview.style.display = 'none'; return; }
    vimeoPreviewTimer = setTimeout(async () => {
      vimeoThumbStatus.textContent = 'Chargement de la miniature...';
      vimeoThumbImg.src = '';
      vimeoThumbPreview.style.display = 'flex';
      const url = await fetchVimeoThumbnail(info.id, info.hash);
      if (url) {
        vimeoThumbImg.src = url;
        vimeoThumbStatus.textContent = info.hash ? '✓ Vidéo privée détectée + miniature trouvée' : '✓ Miniature trouvée';
        vimeoThumbStatus.style.color = '#4ade80';
      } else {
        vimeoThumbStatus.textContent = info.hash ? '⚠ Hash détecté, miniature indisponible' : '⚠ Miniature introuvable';
        vimeoThumbStatus.style.color = 'var(--gold)';
      }
    }, 600);
  });

  // Custom thumbnail preview
  thumbUploadZone.addEventListener('click', () => thumbFileInput.click());
  thumbUploadZone.addEventListener('dragover', (e) => { e.preventDefault(); thumbUploadZone.style.borderColor = 'var(--accent)'; });
  thumbUploadZone.addEventListener('dragleave', () => { thumbUploadZone.style.borderColor = ''; });
  thumbUploadZone.addEventListener('drop', (e) => {
    e.preventDefault(); thumbUploadZone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleThumbFile(file);
  });
  thumbFileInput.addEventListener('change', () => {
    const file = thumbFileInput.files[0];
    if (file) handleThumbFile(file);
  });
  function handleThumbFile(file) {
    if (file.size > 2 * 1024 * 1024) { showToast('Image trop grande (max 2Mo).', 'error'); return; }
    customThumbFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      customThumbPreview.src = e.target.result;
      customThumbPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  // Add video
  addVideoBtn.addEventListener('click', async () => {
    const title = newVideoTitle.value.trim();
    const desc  = newVideoDesc.value.trim();
    const raw   = newVideoId.value.trim();
    if (!title || !raw) { showToast('Remplissez les champs obligatoires.', 'error'); return; }

    addVideoBtn.disabled = true; addVideoBtn.textContent = 'Ajout...';

    let videoIdExtracted = null;
    let vimeoHash        = null;
    let thumbnailUrl     = null;

    if (selectedPlatform === 'youtube') {
      videoIdExtracted = extractYoutubeId(raw);
      if (!videoIdExtracted) { showToast('ID YouTube invalide.', 'error'); addVideoBtn.disabled = false; addVideoBtn.textContent = 'Ajouter la vidéo'; return; }
      thumbnailUrl = `https://img.youtube.com/vi/${videoIdExtracted}/mqdefault.jpg`;
    } else {
      const info = extractVimeoInfo(raw);
      if (!info) { showToast('ID/URL Vimeo invalide.', 'error'); addVideoBtn.disabled = false; addVideoBtn.textContent = 'Ajouter la vidéo'; return; }
      videoIdExtracted = info.id;
      vimeoHash = info.hash;
      // Essayer de récupérer la miniature Vimeo
      const vimeoThumb = await fetchVimeoThumbnail(info.id, info.hash);
      if (vimeoThumb) thumbnailUrl = vimeoThumb;
    }

    // Upload miniature custom si fournie
    if (customThumbFile) {
      try {
        const ext = customThumbFile.name.split('.').pop();
        const path = `${videoIdExtracted}_${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('thumbnails').upload(path, customThumbFile, { cacheControl: '3600', upsert: false });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(path);
          thumbnailUrl = publicUrl;
        }
      } catch {}
    }

    const { error } = await supabase.from('videos').insert({
      title,
      description: desc,
      youtube_id: videoIdExtracted,
      platform: selectedPlatform,
      vimeo_hash: vimeoHash,
      thumbnail_url: thumbnailUrl,
    });

    addVideoBtn.disabled = false; addVideoBtn.textContent = 'Ajouter la vidéo';

    if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
    showToast(`✓ "${title}" ajoutée avec succès !`, 'success');

    // Reset
    newVideoTitle.value = ''; newVideoDesc.value = ''; newVideoId.value = '';
    vimeoThumbPreview.style.display = 'none'; vimeoPrivateInfo.style.display = 'none';
    customThumbFile = null; customThumbPreview.style.display = 'none'; customThumbPreview.src = '';
    thumbFileInput.value = '';

    await loadVideos();
    await loadDashboard();
  });

  async function loadVideos() {
    const { data: videos, error } = await supabase
      .from('videos').select('id, title, youtube_id, platform, vimeo_hash, thumbnail_url, created_at').order('created_at', { ascending: false });

    if (error) { adminVideoList.innerHTML = `<p style="color:var(--text-dim);">Erreur de chargement.</p>`; return; }
    videoListCount.textContent = videos?.length ?? 0;

    if (!videos || videos.length === 0) {
      adminVideoList.innerHTML = `<p style="color:var(--text-dim);font-size:0.85rem;">Aucune vidéo ajoutée.</p>`;
      return;
    }

    adminVideoList.innerHTML = '';
    videos.forEach(v => {
      const platform = v.platform || 'youtube';
      const thumb = v.thumbnail_url ||
        (platform === 'youtube' ? `https://img.youtube.com/vi/${v.youtube_id}/default.jpg` : '');
      const platformBadge = platform === 'vimeo'
        ? `<span class="platform-badge vimeo">Vimeo${v.vimeo_hash ? ' 🔒' : ''}</span>`
        : `<span class="platform-badge youtube">YouTube</span>`;

      const item = document.createElement('div');
      item.className = 'admin-video-item';
      item.innerHTML = `
        ${thumb
          ? `<img class="admin-video-thumb" src="${thumb}" alt="${escapeHtml(v.title)}" />`
          : `<div class="admin-video-thumb admin-video-thumb-placeholder"></div>`
        }
        <div class="admin-video-info">
          <div class="admin-video-title">${escapeHtml(v.title)}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
            ${platformBadge}
            <span class="admin-video-id">${v.youtube_id}</span>
          </div>
        </div>
        <div class="admin-video-actions">
          <button class="btn btn-ghost btn-sm view-btn" data-id="${v.id}">Voir</button>
          <button class="btn btn-danger btn-sm delete-video-btn" data-id="${v.id}" data-title="${escapeHtml(v.title)}">Supprimer</button>
        </div>`;
      adminVideoList.appendChild(item);
    });

    adminVideoList.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => { window.location.href = `video.html?id=${btn.dataset.id}`; });
    });
    adminVideoList.querySelectorAll('.delete-video-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Supprimer "${btn.dataset.title}" ?`)) return;
        const { error } = await supabase.from('videos').delete().eq('id', btn.dataset.id);
        if (error) { showToast('Erreur suppression.', 'error'); return; }
        showToast('Vidéo supprimée.', 'success');
        await loadVideos(); await loadDashboard();
      });
    });
  }

  // ============================================================
  // USERS
  // ============================================================
  async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-dim);">Chargement...</td></tr>';
    const { data: users, error } = await supabase
      .from('profiles').select('id, email, is_admin, created_at').order('created_at', { ascending: true });
    if (error) { tbody.innerHTML = `<tr><td colspan="4">Erreur.</td></tr>`; return; }
    const { data: uvData } = await supabase.from('user_videos').select('user_id');
    const accessCount = {};
    (uvData || []).forEach(uv => { accessCount[uv.user_id] = (accessCount[uv.user_id] || 0) + 1; });
    tbody.innerHTML = '';
    users.forEach(u => {
      const date  = new Date(u.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      const count = accessCount[u.id] || 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:var(--text);">${escapeHtml(u.email)}</td>
        <td>${u.is_admin ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-user">User</span>'}</td>
        <td>${date}</td>
        <td><span style="color:var(--accent);font-weight:600;">${count}</span> vidéo${count > 1 ? 's' : ''}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ============================================================
  // ASSIGN
  // ============================================================
  const assignVideoSelect  = document.getElementById('assignVideoSelect');
  const assignUsersCard    = document.getElementById('assignUsersCard');
  const assignCheckboxList = document.getElementById('assignCheckboxList');
  const saveAssignBtn      = document.getElementById('saveAssignBtn');
  let allUsers = [], allVideos = [], currentVideoAccesses = new Set();

  async function loadAssign() {
    const { data: videos } = await supabase.from('videos').select('id, title').order('created_at', { ascending: false });
    allVideos = videos || [];
    assignVideoSelect.innerHTML = '<option value="">— Choisir une vidéo —</option>';
    allVideos.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id; opt.textContent = v.title;
      assignVideoSelect.appendChild(opt);
    });
    const { data: users } = await supabase.from('profiles').select('id, email').eq('is_admin', false).order('email');
    allUsers = users || [];
  }

  assignVideoSelect.addEventListener('change', async () => {
    const videoId = assignVideoSelect.value;
    if (!videoId) { assignUsersCard.style.display = 'none'; return; }
    assignUsersCard.style.display = 'block';
    assignCheckboxList.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Chargement...</div>';
    const { data: existing } = await supabase.from('user_videos').select('user_id').eq('video_id', videoId);
    currentVideoAccesses = new Set((existing || []).map(e => e.user_id));
    renderCheckboxes();
  });

  function renderCheckboxes() {
    assignCheckboxList.innerHTML = '';
    if (allUsers.length === 0) { assignCheckboxList.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">Aucun utilisateur.</p>'; return; }
    allUsers.forEach(u => {
      const isChecked = currentVideoAccesses.has(u.id);
      const item = document.createElement('label');
      item.className = `checkbox-item ${isChecked ? 'checked' : ''}`;
      item.innerHTML = `
        <input type="checkbox" value="${u.id}" ${isChecked ? 'checked' : ''} />
        <div class="custom-checkbox"><svg viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <span class="checkbox-email">${escapeHtml(u.email)}</span>`;
      item.querySelector('input').addEventListener('change', (e) => { item.classList.toggle('checked', e.target.checked); });
      assignCheckboxList.appendChild(item);
    });
  }

  saveAssignBtn.addEventListener('click', async () => {
    const videoId = assignVideoSelect.value;
    if (!videoId) { showToast('Sélectionnez une vidéo.', 'error'); return; }
    saveAssignBtn.disabled = true; saveAssignBtn.textContent = 'Enregistrement...';
    const selectedIds = [...assignCheckboxList.querySelectorAll('input:checked')].map(cb => cb.value);
    try {
      await supabase.from('user_videos').delete().eq('video_id', videoId);
      if (selectedIds.length > 0) {
        const { error } = await supabase.from('user_videos').insert(selectedIds.map(uid => ({ user_id: uid, video_id: videoId })));
        if (error) throw error;
      }
      showToast(`Accès mis à jour (${selectedIds.length} utilisateur${selectedIds.length > 1 ? 's' : ''}).`, 'success');
      currentVideoAccesses = new Set(selectedIds);
    } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
    saveAssignBtn.disabled = false; saveAssignBtn.textContent = 'Enregistrer les accès';
  });

  // ============================================================
  // INVITE — Créer un compte via Supabase Auth invite
  // ============================================================
  async function loadInvitations() {
    const inviteList = document.getElementById('inviteList');
    const { data: invites } = await supabase.from('invitations').select('*').order('created_at', { ascending: false });
    if (!invites || invites.length === 0) {
      inviteList.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">Aucune invitation envoyée.</p>';
      return;
    }
    inviteList.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'users-table';
    table.innerHTML = `<thead><tr><th>Email</th><th>Statut</th><th>Envoyé le</th><th>Expire le</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    invites.forEach(inv => {
      const tr = document.createElement('tr');
      const isExpired = new Date(inv.expires_at) < new Date();
      tr.innerHTML = `
        <td style="color:var(--text);">${escapeHtml(inv.email)}</td>
        <td>${inv.accepted ? '<span class="badge badge-admin">✓ Accepté</span>' : isExpired ? '<span class="badge" style="background:rgba(255,100,0,0.1);color:#ff6400;border:1px solid rgba(255,100,0,0.3);">Expiré</span>' : '<span class="badge badge-user">En attente</span>'}</td>
        <td>${new Date(inv.created_at).toLocaleDateString('fr-FR')}</td>
        <td>${new Date(inv.expires_at).toLocaleDateString('fr-FR')}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const wrap = document.createElement('div');
    wrap.className = 'users-table-wrap';
    wrap.appendChild(table);
    inviteList.appendChild(wrap);
  }

  document.getElementById('inviteBtn').addEventListener('click', async () => {
    const email = document.getElementById('inviteEmail').value.trim();
    if (!email) { showToast('Entrez un email.', 'error'); return; }
    const btn = document.getElementById('inviteBtn');
    btn.disabled = true; btn.textContent = 'Génération...';

    try {
      // Créer l'invitation dans la table
      const { data: inv, error: invErr } = await supabase.from('invitations').insert({
        email, invited_by: user.id
      }).select().single();

      if (invErr) throw invErr;

      // Utiliser Supabase Auth Admin invite (nécessite la clé service — ici on simule avec un lien)
      // En prod : appeler une Edge Function qui fait supabase.auth.admin.inviteUserByEmail(email)
      const inviteLink = `${window.location.origin}/index.html?invite=${inv.token}`;

      const resultDiv = document.getElementById('inviteResult');
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = `
        <div class="invite-card">
          <strong>✓ Invitation créée pour ${escapeHtml(email)}</strong><br>
          Envoyez ce lien manuellement à votre invité (valable 7 jours) :<br>
          <div class="invite-link">${inviteLink}</div>
        </div>`;

      document.getElementById('inviteEmail').value = '';
      showToast('Invitation créée !', 'success');
      await loadInvitations();
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Générer le lien d\'invitation';
  });

  // ============================================================
  // STATISTIQUES AVANCÉES
  // ============================================================
  async function loadStats() {
    const statsContent = document.getElementById('statsContent');
    statsContent.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Chargement...</div>';

    try {
      // Vues par vidéo
      const { data: videos } = await supabase.from('videos').select('id, title, platform');
      const { data: views }  = await supabase.from('video_views').select('video_id, device, viewed_at');
      const { data: watches } = await supabase.from('watch_history').select('video_id, user_id, progress, device');

      // Agréger les vues
      const viewsByVideo = {};
      (views || []).forEach(v => {
        if (!viewsByVideo[v.video_id]) viewsByVideo[v.video_id] = { total: 0, mobile: 0, desktop: 0, tablet: 0 };
        viewsByVideo[v.video_id].total++;
        if (v.device) viewsByVideo[v.video_id][v.device] = (viewsByVideo[v.video_id][v.device] || 0) + 1;
      });

      // Max vues pour la barre de progression
      const maxViews = Math.max(...Object.values(viewsByVideo).map(v => v.total), 1);

      // Stats par appareil global
      const deviceCount = { mobile: 0, desktop: 0, tablet: 0 };
      (views || []).forEach(v => { if (v.device) deviceCount[v.device]++; });
      const totalViews = (views || []).length;

      // Viewers uniques par vidéo
      const uniqueByVideo = {};
      (watches || []).forEach(w => {
        if (!uniqueByVideo[w.video_id]) uniqueByVideo[w.video_id] = new Set();
        uniqueByVideo[w.video_id].add(w.user_id);
      });

      // Taux de complétion
      const completionByVideo = {};
      (watches || []).forEach(w => {
        if (!completionByVideo[w.video_id]) completionByVideo[w.video_id] = [];
        completionByVideo[w.video_id].push(w.progress);
      });

      statsContent.innerHTML = '';

      // Carte appareils
      const deviceCard = document.createElement('div');
      deviceCard.style.cssText = 'margin-bottom:24px;';
      deviceCard.innerHTML = `
        <div class="admin-card-title" style="margin-bottom:16px;">📱 Répartition par appareil (${totalViews} vues)</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
          ${['mobile','desktop','tablet'].map(d => `
            <div style="background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px;text-align:center;">
              <div style="font-size:1.8rem;margin-bottom:6px;">${d==='mobile'?'📱':d==='desktop'?'💻':'📋'}</div>
              <div style="font-family:var(--font-display);font-size:1.4rem;color:var(--accent);">${deviceCount[d]}</div>
              <div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;font-weight:700;">${d}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">${totalViews ? Math.round(deviceCount[d]/totalViews*100) : 0}%</div>
            </div>`).join('')}
        </div>`;
      statsContent.appendChild(deviceCard);

      // Tableau par vidéo
      const tableCard = document.createElement('div');
      tableCard.innerHTML = `<div class="admin-card-title" style="margin-bottom:16px;">🎬 Vues par vidéo</div>`;
      const wrap = document.createElement('div');
      wrap.className = 'users-table-wrap';
      const table = document.createElement('table');
      table.className = 'stats-detail-table';
      table.innerHTML = `<thead><tr><th>Vidéo</th><th>Vues</th><th>Viewers uniques</th><th>Complétion moy.</th><th>📱 Mobile</th><th>💻 Desktop</th></tr></thead>`;
      const tbody = document.createElement('tbody');

      (videos || []).sort((a, b) => (viewsByVideo[b.id]?.total || 0) - (viewsByVideo[a.id]?.total || 0)).forEach(v => {
        const vData = viewsByVideo[v.id] || { total: 0, mobile: 0, desktop: 0 };
        const unique = uniqueByVideo[v.id]?.size || 0;
        const completions = completionByVideo[v.id] || [];
        const avgCompletion = completions.length > 0
          ? Math.round(completions.reduce((a, b) => a + b, 0) / completions.length)
          : 0;
        const barWidth = maxViews > 0 ? Math.round((vData.total / maxViews) * 100) : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="color:var(--text);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(v.title)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="stats-bar"><div class="stats-bar-fill" style="width:${barWidth}%"></div></div>
              <span style="font-weight:700;color:var(--accent);">${vData.total}</span>
            </div>
          </td>
          <td style="color:var(--text-muted);">${unique}</td>
          <td>
            <span style="color:${avgCompletion>=70?'var(--green)':avgCompletion>=40?'var(--gold)':'var(--text-muted)'};">
              ${avgCompletion}%
            </span>
          </td>
          <td style="color:var(--text-muted);">${vData.mobile || 0}</td>
          <td style="color:var(--text-muted);">${vData.desktop || 0}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      tableCard.appendChild(wrap);
      statsContent.appendChild(tableCard);

    } catch (err) {
      statsContent.innerHTML = `<p style="color:var(--accent);">Erreur : ${err.message}</p>`;
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }
  function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg; toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

  await loadDashboard();
  supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') window.location.href = 'index.html'; });
})();
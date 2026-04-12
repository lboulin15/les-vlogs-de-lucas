// ============================================================
// admin.js — Panel Admin complet
// ============================================================
import { supabase } from './supabaseClient.js';

(async () => {
  // ---- DOM refs ----
  const loadingScreen = document.getElementById('loadingScreen');
  const navbar = document.getElementById('navbar');
  const adminPage = document.getElementById('adminPage');
  const logoutBtn = document.getElementById('logoutBtn');

  // ---- Auth check ----
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  const user = session.user;

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    window.location.href = 'home.html';
    return;
  }

  // ---- Show UI ----
  loadingScreen.style.display = 'none';
  navbar.style.display = 'flex';
  adminPage.style.display = 'block';

  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });

  // ============================================================
  // NAVIGATION SIDEBAR
  // ============================================================
  const navItems = document.querySelectorAll('.sidebar-nav-item');
  const panels = document.querySelectorAll('.admin-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.panel;
      navItems.forEach(i => i.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`panel-${target}`).classList.add('active');

      if (target === 'dashboard') loadDashboard();
      if (target === 'videos') loadVideos();
      if (target === 'users') loadUsers();
      if (target === 'assign') loadAssign();
    });
  });

  // ============================================================
  // DASHBOARD
  // ============================================================
  async function loadDashboard() {
    try {
      const [
        { count: vCount },
        { count: uCount },
        { count: aCount },
        { count: cCount },
      ] = await Promise.all([
        supabase.from('videos').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', false),
        supabase.from('user_videos').select('*', { count: 'exact', head: true }),
        supabase.from('comments').select('*', { count: 'exact', head: true }),
      ]);

      document.getElementById('statVideos').textContent = vCount ?? 0;
      document.getElementById('statUsers').textContent = uCount ?? 0;
      document.getElementById('statAssigns').textContent = aCount ?? 0;
      document.getElementById('statComments').textContent = cCount ?? 0;
    } catch (err) {
      console.error('Dashboard error:', err);
    }
  }

  // ============================================================
  // VIDEOS
  // ============================================================
  const addVideoBtn = document.getElementById('addVideoBtn');
  const newVideoTitle = document.getElementById('newVideoTitle');
  const newVideoYoutubeId = document.getElementById('newVideoYoutubeId');
  const adminVideoList = document.getElementById('adminVideoList');
  const videoListCount = document.getElementById('videoListCount');

  addVideoBtn.addEventListener('click', async () => {
    const title = newVideoTitle.value.trim();
    const youtube_id = newVideoYoutubeId.value.trim();

    if (!title || !youtube_id) {
      showToast('Remplissez tous les champs.', 'error');
      return;
    }

    // Extraire l'ID si l'utilisateur colle une URL complète
    const extracted = extractYoutubeId(youtube_id);
    if (!extracted) {
      showToast('ID YouTube invalide.', 'error');
      return;
    }

    addVideoBtn.disabled = true;
    addVideoBtn.textContent = 'Ajout...';

    const { error } = await supabase
      .from('videos')
      .insert({ title, youtube_id: extracted });

    addVideoBtn.disabled = false;
    addVideoBtn.textContent = 'Ajouter la vidéo';

    if (error) { showToast('Erreur : ' + error.message, 'error'); return; }

    newVideoTitle.value = '';
    newVideoYoutubeId.value = '';
    showToast('Vidéo ajoutée avec succès !', 'success');
    await loadVideos();
    await loadDashboard();
  });

  async function loadVideos() {
    adminVideoList.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Chargement...</div>';

    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, title, youtube_id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      adminVideoList.innerHTML = `<p style="color:var(--text-dim);">Erreur de chargement.</p>`;
      return;
    }

    videoListCount.textContent = videos?.length ?? 0;

    if (!videos || videos.length === 0) {
      adminVideoList.innerHTML = `<p style="color:var(--text-dim);font-size:0.85rem;">Aucune vidéo ajoutée.</p>`;
      return;
    }

    adminVideoList.innerHTML = '';
    videos.forEach(v => {
      const thumb = `https://img.youtube.com/vi/${v.youtube_id}/default.jpg`;
      const item = document.createElement('div');
      item.className = 'admin-video-item';
      item.innerHTML = `
        <img class="admin-video-thumb" src="${thumb}" alt="${escapeHtml(v.title)}" />
        <div class="admin-video-info">
          <div class="admin-video-title">${escapeHtml(v.title)}</div>
          <div class="admin-video-id">${v.youtube_id}</div>
        </div>
        <div class="admin-video-actions">
          <button class="btn btn-ghost btn-sm view-btn" data-id="${v.id}">
            Voir
          </button>
          <button class="btn btn-danger btn-sm delete-video-btn" data-id="${v.id}" data-title="${escapeHtml(v.title)}">
            Supprimer
          </button>
        </div>
      `;
      adminVideoList.appendChild(item);
    });

    adminVideoList.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.href = `video.html?id=${btn.dataset.id}`;
      });
    });

    adminVideoList.querySelectorAll('.delete-video-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Supprimer "${btn.dataset.title}" ? Cette action est irréversible.`)) return;
        const { error } = await supabase.from('videos').delete().eq('id', btn.dataset.id);
        if (error) { showToast('Erreur suppression.', 'error'); return; }
        showToast('Vidéo supprimée.', 'success');
        await loadVideos();
        await loadDashboard();
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
      .from('profiles')
      .select('id, email, is_admin, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      tbody.innerHTML = `<tr><td colspan="4" style="color:var(--text-dim);">Erreur de chargement.</td></tr>`;
      return;
    }

    // Compter les accès par user
    const { data: uvData } = await supabase
      .from('user_videos')
      .select('user_id');

    const accessCount = {};
    (uvData || []).forEach(uv => {
      accessCount[uv.user_id] = (accessCount[uv.user_id] || 0) + 1;
    });

    tbody.innerHTML = '';
    users.forEach(u => {
      const date = new Date(u.created_at).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
      const count = accessCount[u.id] || 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:var(--text);">${escapeHtml(u.email)}</td>
        <td>${u.is_admin
          ? '<span class="badge badge-admin">Admin</span>'
          : '<span class="badge badge-user">User</span>'
        }</td>
        <td>${date}</td>
        <td><span style="color:var(--accent);font-weight:600;">${count}</span> vidéo${count > 1 ? 's' : ''}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ============================================================
  // ASSIGN
  // ============================================================
  const assignVideoSelect = document.getElementById('assignVideoSelect');
  const assignUsersCard = document.getElementById('assignUsersCard');
  const assignCheckboxList = document.getElementById('assignCheckboxList');
  const saveAssignBtn = document.getElementById('saveAssignBtn');

  let allUsers = [];
  let allVideos = [];
  let currentVideoAccesses = new Set();

  async function loadAssign() {
    // Charger les vidéos dans le select
    const { data: videos } = await supabase
      .from('videos')
      .select('id, title')
      .order('created_at', { ascending: false });

    allVideos = videos || [];

    assignVideoSelect.innerHTML = '<option value="">— Choisir une vidéo —</option>';
    allVideos.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.title;
      assignVideoSelect.appendChild(opt);
    });

    // Charger les users (non-admin)
    const { data: users } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('is_admin', false)
      .order('email');

    allUsers = users || [];
  }

  assignVideoSelect.addEventListener('change', async () => {
    const videoId = assignVideoSelect.value;
    if (!videoId) {
      assignUsersCard.style.display = 'none';
      return;
    }

    assignUsersCard.style.display = 'block';
    assignCheckboxList.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Chargement...</div>';

    // Récupérer les accès actuels
    const { data: existing } = await supabase
      .from('user_videos')
      .select('user_id')
      .eq('video_id', videoId);

    currentVideoAccesses = new Set((existing || []).map(e => e.user_id));
    renderCheckboxes();
  });

  function renderCheckboxes() {
    assignCheckboxList.innerHTML = '';

    if (allUsers.length === 0) {
      assignCheckboxList.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">Aucun utilisateur.</p>';
      return;
    }

    allUsers.forEach(u => {
      const isChecked = currentVideoAccesses.has(u.id);
      const item = document.createElement('label');
      item.className = `checkbox-item ${isChecked ? 'checked' : ''}`;
      item.innerHTML = `
        <input type="checkbox" value="${u.id}" ${isChecked ? 'checked' : ''} />
        <div class="custom-checkbox">
          <svg viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <span class="checkbox-email">${escapeHtml(u.email)}</span>
      `;

      const cb = item.querySelector('input');
      cb.addEventListener('change', () => {
        item.classList.toggle('checked', cb.checked);
      });

      assignCheckboxList.appendChild(item);
    });
  }

  saveAssignBtn.addEventListener('click', async () => {
    const videoId = assignVideoSelect.value;
    if (!videoId) { showToast('Sélectionnez une vidéo.', 'error'); return; }

    saveAssignBtn.disabled = true;
    saveAssignBtn.textContent = 'Enregistrement...';

    const checkboxes = assignCheckboxList.querySelectorAll('input[type="checkbox"]');
    const selectedUserIds = [];
    checkboxes.forEach(cb => {
      if (cb.checked) selectedUserIds.push(cb.value);
    });

    try {
      // 1. Supprimer tous les anciens accès pour cette vidéo
      await supabase.from('user_videos').delete().eq('video_id', videoId);

      // 2. Insérer les nouveaux accès
      if (selectedUserIds.length > 0) {
        const inserts = selectedUserIds.map(uid => ({
          user_id: uid,
          video_id: videoId,
        }));
        const { error } = await supabase.from('user_videos').insert(inserts);
        if (error) throw error;
      }

      showToast(`Accès mis à jour (${selectedUserIds.length} utilisateur${selectedUserIds.length > 1 ? 's' : ''}).`, 'success');

      // Refresh
      currentVideoAccesses = new Set(selectedUserIds);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    }

    saveAssignBtn.disabled = false;
    saveAssignBtn.textContent = 'Enregistrer les accès';
  });

  // ============================================================
  // HELPERS
  // ============================================================
  function extractYoutubeId(input) {
    // Accepte l'ID direct (11 chars) ou une URL YouTube complète
    const patterns = [
      /^([a-zA-Z0-9_-]{11})$/,
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = input.match(p);
      if (m) return m[1];
    }
    return null;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => { toast.classList.remove('show'); }, 3500);
  }

  // ---- Init dashboard ----
  await loadDashboard();

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
  });
})();
// ============================================================
// admin.js — YouTube only
// ============================================================
import { supabase } from './supabaseClient.js';

const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
}

(async () => {
  window.addEventListener('error', (e) => {
    console.error('JS ERROR:', e.message, 'ligne', e.lineno, e.filename);
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('PROMISE ERROR:', e.reason);
  });

  const loadingScreen = document.getElementById('loadingScreen');
  const navbar = document.getElementById('navbar');
  const adminPage = document.getElementById('adminPage');
  const logoutBtn = document.getElementById('logoutBtn');
  const themeToggle = document.getElementById('themeToggle');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3500);
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      themeToggle.textContent = '☀️';
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeToggle.textContent = '🌙';
    }
    localStorage.setItem('theme', theme);
  }

  function showAdminPage() {
    loadingScreen.style.display = 'none';
    if (loadingScreen.parentNode) loadingScreen.remove();
    navbar.style.display = 'flex';
    adminPage.style.display = 'block';
  }

  function safeDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function extractYoutubeId(input) {
    const value = (input || '').trim();

    const patterns = [
      /^([a-zA-Z0-9_-]{11})$/,
      /[?&]v=([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  applyTheme(savedTheme);
  themeToggle.addEventListener('click', () => {
    const current = localStorage.getItem('theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    window.location.href = 'index.html';
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, is_admin')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    window.location.href = 'home.html';
    return;
  }

  showAdminPage();

  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });

  const navItems = document.querySelectorAll('.sidebar-nav-item');
  const panels = document.querySelectorAll('.admin-panel');

  function openPanel(target) {
    navItems.forEach((item) => item.classList.remove('active'));
    panels.forEach((panel) => panel.classList.remove('active'));

    const btn = document.querySelector(`.sidebar-nav-item[data-panel="${target}"]`);
    const panel = document.getElementById(`panel-${target}`);

    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');

    if (target === 'dashboard') loadDashboard();
    if (target === 'videos') loadVideos();
    if (target === 'users') loadUsers();
    if (target === 'assign') loadAssign();
    if (target === 'invite') loadInvitations();
    if (target === 'stats') loadStats();
  }

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const target = item.dataset.panel;
      if (target) openPanel(target);
    });
  });

  async function loadDashboard() {
    try {
      const results = await Promise.all([
        supabase.from('videos').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', false),
        supabase.from('user_videos').select('*', { count: 'exact', head: true }),
        supabase.from('comments').select('*', { count: 'exact', head: true }),
        supabase.from('video_views').select('*', { count: 'exact', head: true }),
        supabase.from('notifications').select('*', { count: 'exact', head: true }),
      ]);

      const [videosRes, usersRes, assignsRes, commentsRes, viewsRes, notifRes] = results;

      document.getElementById('statVideos').textContent = videosRes.count ?? 0;
      document.getElementById('statUsers').textContent = usersRes.count ?? 0;
      document.getElementById('statAssigns').textContent = assignsRes.count ?? 0;
      document.getElementById('statComments').textContent = commentsRes.count ?? 0;
      document.getElementById('statViews').textContent = viewsRes.count ?? 0;
      document.getElementById('statNotifs').textContent = notifRes.count ?? 0;
    } catch (err) {
      console.error('Dashboard error:', err);
    }
  }

  const addVideoBtn = document.getElementById('addVideoBtn');
  const newVideoTitle = document.getElementById('newVideoTitle');
  const newVideoDesc = document.getElementById('newVideoDesc');
  const newVideoId = document.getElementById('newVideoId');
  const adminVideoList = document.getElementById('adminVideoList');
  const videoListCount = document.getElementById('videoListCount');
  const thumbFileInput = document.getElementById('thumbFileInput');
  const thumbUploadZone = document.getElementById('thumbUploadZone');
  const customThumbPreview = document.getElementById('customThumbPreview');

  let customThumbFile = null;

  function resetVideoForm() {
    newVideoTitle.value = '';
    newVideoDesc.value = '';
    newVideoId.value = '';
    if (thumbFileInput) thumbFileInput.value = '';
    customThumbFile = null;
    if (customThumbPreview) {
      customThumbPreview.style.display = 'none';
      customThumbPreview.src = '';
    }
  }

  function handleThumbFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Fichier image invalide.', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image trop grande (max 2Mo).', 'error');
      return;
    }

    customThumbFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!customThumbPreview) return;
      customThumbPreview.src = e.target.result;
      customThumbPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  if (thumbUploadZone && thumbFileInput) {
    thumbUploadZone.addEventListener('click', () => thumbFileInput.click());

    thumbUploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      thumbUploadZone.style.borderColor = 'var(--accent)';
    });

    thumbUploadZone.addEventListener('dragleave', () => {
      thumbUploadZone.style.borderColor = '';
    });

    thumbUploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      thumbUploadZone.style.borderColor = '';
      const file = e.dataTransfer.files?.[0];
      handleThumbFile(file);
    });

    thumbFileInput.addEventListener('change', () => {
      const file = thumbFileInput.files?.[0];
      handleThumbFile(file);
    });
  }

  async function uploadThumbnail() {
    if (!customThumbFile) return null;

    try {
      const ext = (customThumbFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(path, customThumbFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Erreur upload miniature:', uploadError);
        return null;
      }

      const { data } = supabase.storage.from('thumbnails').getPublicUrl(path);
      return data?.publicUrl || null;
    } catch (err) {
      console.error('Erreur upload miniature:', err);
      return null;
    }
  }

  if (addVideoBtn) {
    addVideoBtn.addEventListener('click', async () => {
      const title = newVideoTitle.value.trim();
      const description = newVideoDesc.value.trim();
      const raw = newVideoId.value.trim();

      if (!title || !raw) {
        showToast('Remplis les champs obligatoires.', 'error');
        return;
      }

      const youtubeId = extractYoutubeId(raw);
      if (!youtubeId) {
        showToast('ID ou URL YouTube invalide.', 'error');
        return;
      }

      addVideoBtn.disabled = true;
      addVideoBtn.textContent = 'Ajout...';

      try {
        let thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;

        const customThumbUrl = await uploadThumbnail();
        if (customThumbUrl) thumbnailUrl = customThumbUrl;

        const payload = {
          title,
          description,
          youtube_id: youtubeId,
          platform: 'youtube',
          vimeo_hash: null,
          thumbnail_url: thumbnailUrl,
        };

        const { error } = await supabase.from('videos').insert(payload);
        if (error) throw error;

        showToast(`✓ "${title}" ajoutée avec succès !`, 'success');
        resetVideoForm();
        await loadVideos();
        await loadDashboard();
      } catch (err) {
        console.error(err);
        showToast(`Erreur : ${err.message}`, 'error');
      } finally {
        addVideoBtn.disabled = false;
        addVideoBtn.textContent = 'Ajouter la vidéo';
      }
    });
  }

  async function loadVideos() {
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, title, youtube_id, thumbnail_url, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      adminVideoList.innerHTML = `<p style="color:var(--text-dim);">Erreur de chargement.</p>`;
      return;
    }

    videoListCount.textContent = videos?.length ?? 0;

    if (!videos || videos.length === 0) {
      adminVideoList.innerHTML = `<p style="color:var(--text-dim);font-size:0.85rem;">Aucune vidéo ajoutée.</p>`;
      return;
    }

    adminVideoList.innerHTML = '';

    videos.forEach((v) => {
      const thumb = v.thumbnail_url || `https://img.youtube.com/vi/${v.youtube_id}/default.jpg`;

      const item = document.createElement('div');
      item.className = 'admin-video-item';
      item.innerHTML = `
        <img class="admin-video-thumb" src="${thumb}" alt="${escapeHtml(v.title)}" />
        <div class="admin-video-info">
          <div class="admin-video-title">${escapeHtml(v.title)}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
            <span class="platform-badge youtube">YouTube</span>
            <span class="admin-video-id">${escapeHtml(v.youtube_id || '—')}</span>
          </div>
        </div>
        <div class="admin-video-actions">
          <button class="btn btn-ghost btn-sm view-btn" data-id="${v.id}">Voir</button>
          <button class="btn btn-danger btn-sm delete-video-btn" data-id="${v.id}" data-title="${escapeHtml(v.title)}">Supprimer</button>
        </div>
      `;
      adminVideoList.appendChild(item);
    });

    adminVideoList.querySelectorAll('.view-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.href = `video.html?id=${btn.dataset.id}`;
      });
    });

    adminVideoList.querySelectorAll('.delete-video-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Supprimer "${btn.dataset.title}" ?`)) return;

        const { error } = await supabase.from('videos').delete().eq('id', btn.dataset.id);
        if (error) {
          console.error(error);
          showToast('Erreur suppression.', 'error');
          return;
        }

        showToast('Vidéo supprimée.', 'success');
        await loadVideos();
        await loadDashboard();
      });
    });
  }

  async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-dim);">Chargement...</td></tr>';

    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, is_admin, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      tbody.innerHTML = `<tr><td colspan="4">Erreur.</td></tr>`;
      return;
    }

    const { data: uvData } = await supabase.from('user_videos').select('user_id');
    const accessCount = {};
    (uvData || []).forEach((uv) => {
      accessCount[uv.user_id] = (accessCount[uv.user_id] || 0) + 1;
    });

    tbody.innerHTML = '';

    users.forEach((u) => {
      const count = accessCount[u.id] || 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:var(--text);">${escapeHtml(u.email || '—')}</td>
        <td>${u.is_admin ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-user">User</span>'}</td>
        <td>${safeDate(u.created_at)}</td>
        <td><span style="color:var(--accent);font-weight:600;">${count}</span> vidéo${count > 1 ? 's' : ''}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  const assignVideoSelect = document.getElementById('assignVideoSelect');
  const assignUsersCard = document.getElementById('assignUsersCard');
  const assignCheckboxList = document.getElementById('assignCheckboxList');
  const saveAssignBtn = document.getElementById('saveAssignBtn');

  let allUsers = [];
  let currentVideoAccesses = new Set();

  async function loadAssign() {
    const { data: videos } = await supabase
      .from('videos')
      .select('id, title')
      .order('created_at', { ascending: false });

    assignVideoSelect.innerHTML = '<option value="">— Choisir une vidéo —</option>';

    (videos || []).forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.title;
      assignVideoSelect.appendChild(opt);
    });

    const { data: users } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('is_admin', false)
      .order('email');

    allUsers = users || [];
  }

  function renderCheckboxes() {
    assignCheckboxList.innerHTML = '';

    if (allUsers.length === 0) {
      assignCheckboxList.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">Aucun utilisateur.</p>';
      return;
    }

    allUsers.forEach((u) => {
      const isChecked = currentVideoAccesses.has(u.id);

      const item = document.createElement('label');
      item.className = `checkbox-item ${isChecked ? 'checked' : ''}`;
      item.innerHTML = `
        <input type="checkbox" value="${u.id}" ${isChecked ? 'checked' : ''} />
        <div class="custom-checkbox">
          <svg viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="checkbox-email">${escapeHtml(u.email)}</span>
      `;
      item.querySelector('input').addEventListener('change', (e) => {
        item.classList.toggle('checked', e.target.checked);
      });
      assignCheckboxList.appendChild(item);
    });
  }

  assignVideoSelect?.addEventListener('change', async () => {
    const videoId = assignVideoSelect.value;

    if (!videoId) {
      assignUsersCard.style.display = 'none';
      return;
    }

    assignUsersCard.style.display = 'block';
    assignCheckboxList.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Chargement...</div>';

    const { data: existing } = await supabase
      .from('user_videos')
      .select('user_id')
      .eq('video_id', videoId);

    currentVideoAccesses = new Set((existing || []).map((e) => e.user_id));
    renderCheckboxes();
  });

  saveAssignBtn?.addEventListener('click', async () => {
    const videoId = assignVideoSelect.value;
    if (!videoId) {
      showToast('Sélectionne une vidéo.', 'error');
      return;
    }

    saveAssignBtn.disabled = true;
    saveAssignBtn.textContent = 'Enregistrement...';

    try {
      const selectedIds = [...assignCheckboxList.querySelectorAll('input:checked')].map((cb) => cb.value);

      await supabase.from('user_videos').delete().eq('video_id', videoId);

      if (selectedIds.length > 0) {
        const payload = selectedIds.map((uid) => ({ user_id: uid, video_id: videoId }));
        const { error } = await supabase.from('user_videos').insert(payload);
        if (error) throw error;
      }

      currentVideoAccesses = new Set(selectedIds);
      showToast(`Accès mis à jour (${selectedIds.length} utilisateur${selectedIds.length > 1 ? 's' : ''}).`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      saveAssignBtn.disabled = false;
      saveAssignBtn.textContent = 'Enregistrer les accès';
    }
  });

  async function loadInvitations() {
    const inviteList = document.getElementById('inviteList');

    const { data: invites, error } = await supabase
      .from('invitations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      inviteList.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">Erreur de chargement.</p>';
      return;
    }

    if (!invites || invites.length === 0) {
      inviteList.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">Aucune invitation envoyée.</p>';
      return;
    }

    inviteList.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'users-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Email</th>
          <th>Statut</th>
          <th>Envoyé le</th>
          <th>Expire le</th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement('tbody');

    invites.forEach((inv) => {
      const tr = document.createElement('tr');
      const isExpired = new Date(inv.expires_at) < new Date();

      tr.innerHTML = `
        <td style="color:var(--text);">${escapeHtml(inv.email)}</td>
        <td>${inv.accepted ? '<span class="badge badge-admin">✓ Accepté</span>' : isExpired ? '<span class="badge" style="background:rgba(255,100,0,0.1);color:#ff6400;border:1px solid rgba(255,100,0,0.3);">Expiré</span>' : '<span class="badge badge-user">En attente</span>'}</td>
        <td>${safeDate(inv.created_at)}</td>
        <td>${safeDate(inv.expires_at)}</td>
      `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    const wrap = document.createElement('div');
    wrap.className = 'users-table-wrap';
    wrap.appendChild(table);
    inviteList.appendChild(wrap);
  }

  const inviteBtn = document.getElementById('inviteBtn');
  const inviteEmail = document.getElementById('inviteEmail');
  const inviteResult = document.getElementById('inviteResult');

  inviteBtn?.addEventListener('click', async () => {
    const email = inviteEmail.value.trim();
    if (!email) {
      showToast('Entrez un email.', 'error');
      return;
    }

    inviteBtn.disabled = true;
    inviteBtn.textContent = 'Génération...';

    try {
      const { data: inv, error: invErr } = await supabase
        .from('invitations')
        .insert({ email, invited_by: user.id })
        .select()
        .single();

      if (invErr) throw invErr;

      const inviteLink = `${window.location.origin}/index.html?invite=${inv.token}`;

      inviteResult.style.display = 'block';
      inviteResult.innerHTML = `
        <div class="invite-card">
          <strong>✓ Invitation créée pour ${escapeHtml(email)}</strong><br>
          Envoyez ce lien manuellement à votre invité (valable 7 jours) :<br>
          <div class="invite-link">${inviteLink}</div>
        </div>
      `;

      inviteEmail.value = '';
      showToast('Invitation créée !', 'success');
      await loadInvitations();
    } catch (err) {
      console.error(err);
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      inviteBtn.disabled = false;
      inviteBtn.textContent = 'Générer le lien d\'invitation';
    }
  });

  async function loadStats() {
    const statsContent = document.getElementById('statsContent');
    statsContent.innerHTML = '<div style="color:var(--text-dim);font-size:0.85rem;">Chargement...</div>';

    try {
      const { data: videos } = await supabase.from('videos').select('id, title');
      const { data: views } = await supabase.from('video_views').select('video_id, device, viewed_at');
      const { data: watches } = await supabase.from('watch_history').select('video_id, user_id, progress, device');

      const viewsByVideo = {};
      (views || []).forEach((v) => {
        if (!viewsByVideo[v.video_id]) {
          viewsByVideo[v.video_id] = { total: 0, mobile: 0, desktop: 0, tablet: 0 };
        }
        viewsByVideo[v.video_id].total++;
        if (v.device) viewsByVideo[v.video_id][v.device] = (viewsByVideo[v.video_id][v.device] || 0) + 1;
      });

      const totals = Object.values(viewsByVideo).map((v) => v.total);
      const maxViews = totals.length ? Math.max(...totals) : 1;

      const deviceCount = { mobile: 0, desktop: 0, tablet: 0 };
      (views || []).forEach((v) => {
        if (v.device && deviceCount[v.device] !== undefined) deviceCount[v.device]++;
      });

      const totalViews = (views || []).length;

      const uniqueByVideo = {};
      (watches || []).forEach((w) => {
        if (!uniqueByVideo[w.video_id]) uniqueByVideo[w.video_id] = new Set();
        uniqueByVideo[w.video_id].add(w.user_id);
      });

      const completionByVideo = {};
      (watches || []).forEach((w) => {
        if (!completionByVideo[w.video_id]) completionByVideo[w.video_id] = [];
        completionByVideo[w.video_id].push(w.progress);
      });

      statsContent.innerHTML = '';

      const deviceCard = document.createElement('div');
      deviceCard.style.cssText = 'margin-bottom:24px;';
      deviceCard.innerHTML = `
        <div class="admin-card-title" style="margin-bottom:16px;">📱 Répartition par appareil (${totalViews} vues)</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
          ${['mobile', 'desktop', 'tablet'].map((d) => `
            <div style="background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px;text-align:center;">
              <div style="font-size:1.8rem;margin-bottom:6px;">${d === 'mobile' ? '📱' : d === 'desktop' ? '💻' : '📋'}</div>
              <div style="font-family:var(--font-display);font-size:1.4rem;color:var(--accent);">${deviceCount[d]}</div>
              <div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;font-weight:700;">${d}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">${totalViews ? Math.round(deviceCount[d] / totalViews * 100) : 0}%</div>
            </div>
          `).join('')}
        </div>
      `;
      statsContent.appendChild(deviceCard);

      const tableCard = document.createElement('div');
      tableCard.innerHTML = '<div class="admin-card-title" style="margin-bottom:16px;">🎬 Vues par vidéo</div>';

      const wrap = document.createElement('div');
      wrap.className = 'users-table-wrap';

      const table = document.createElement('table');
      table.className = 'stats-detail-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Vidéo</th>
            <th>Vues</th>
            <th>Viewers uniques</th>
            <th>Complétion moy.</th>
            <th>📱 Mobile</th>
            <th>💻 Desktop</th>
          </tr>
        </thead>
      `;

      const tbody = document.createElement('tbody');

      (videos || [])
        .sort((a, b) => (viewsByVideo[b.id]?.total || 0) - (viewsByVideo[a.id]?.total || 0))
        .forEach((v) => {
          const vData = viewsByVideo[v.id] || { total: 0, mobile: 0, desktop: 0, tablet: 0 };
          const unique = uniqueByVideo[v.id]?.size || 0;
          const completions = completionByVideo[v.id] || [];
          const avgCompletion = completions.length
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
              <span style="color:${avgCompletion >= 70 ? 'var(--green)' : avgCompletion >= 40 ? 'var(--gold)' : 'var(--text-muted)'};">
                ${avgCompletion}%
              </span>
            </td>
            <td style="color:var(--text-muted);">${vData.mobile || 0}</td>
            <td style="color:var(--text-muted);">${vData.desktop || 0}</td>
          `;
          tbody.appendChild(tr);
        });

      table.appendChild(tbody);
      wrap.appendChild(table);
      tableCard.appendChild(wrap);
      statsContent.appendChild(tableCard);
    } catch (err) {
      console.error('loadStats error:', err);
      statsContent.innerHTML = `<p style="color:var(--accent);">Erreur : ${escapeHtml(err.message)}</p>`;
    }
  }

  await loadDashboard();

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = 'index.html';
    }
  });
})();
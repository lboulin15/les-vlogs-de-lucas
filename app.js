// ============================================================
// app.js — Login : toggle mot de passe + popup bienvenue
// ============================================================
import { supabase } from './supabaseClient.js';

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) { window.location.href = 'home.html'; return; }

  // ---- Toggle mot de passe ----
  const passwordInput  = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  const eyeOff = passwordToggle.querySelector('.eye-off');
  const eyeOn  = passwordToggle.querySelector('.eye-on');

  passwordToggle.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type   = isHidden ? 'text'     : 'password';
    eyeOff.style.display = isHidden ? 'none'     : 'block';
    eyeOn.style.display  = isHidden ? 'block'    : 'none';
    passwordToggle.setAttribute('aria-label',
      isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });

  // ---- Popup bienvenue ----
  const welcomeOverlay  = document.getElementById('welcomeOverlay');
  const welcomeEnterBtn = document.getElementById('welcomeEnterBtn');

  welcomeEnterBtn.addEventListener('click', () => {
    welcomeOverlay.classList.add('closing');
    setTimeout(() => { window.location.href = 'home.html'; }, 400);
  });

  // ---- Formulaire ----
  const form       = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const loginBtn   = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);
    clearError();

    const email    = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) { showError('Veuillez remplir tous les champs.'); setLoading(false); return; }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showError(error.message.includes('Invalid login') ? 'Email ou mot de passe incorrect.' : error.message);
        setLoading(false); return;
      }
      if (data.user) {
        const pseudo = (data.user.email || '').split('@')[0];
        document.getElementById('welcomeName').textContent = pseudo;
        welcomeOverlay.classList.add('open');
      }
    } catch (err) {
      showError('Une erreur est survenue. Réessayez.');
      setLoading(false);
    }
  });

  function showError(msg) { loginError.textContent = msg; loginError.classList.add('visible'); }
  function clearError()   { loginError.textContent = ''; loginError.classList.remove('visible'); }
  function setLoading(l)  { loginBtn.disabled = l; loginBtn.textContent = l ? 'Connexion...' : 'Se connecter'; }
})();
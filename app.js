// ============================================================
// app.js — Login : toggle + popup bienvenue (fix mobile scroll)
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
    passwordInput.type   = isHidden ? 'text'  : 'password';
    eyeOff.style.display = isHidden ? 'none'  : 'block';
    eyeOn.style.display  = isHidden ? 'block' : 'none';
    passwordToggle.setAttribute('aria-label',
      isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });

  // ---- Popup bienvenue ----
  const welcomeOverlay  = document.getElementById('welcomeOverlay');
  const welcomeEnterBtn = document.getElementById('welcomeEnterBtn');

  function showWelcomePopup() {
    // 1. Fermer le clavier virtuel (blur tous les inputs)
    document.activeElement?.blur();

    // 2. Remonter immédiatement en haut de page
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // 3. Bloquer le scroll derrière le popup
    document.body.style.overflow = 'hidden';

    // 4. Petit délai pour laisser le clavier se fermer sur iOS
    setTimeout(() => {
      welcomeOverlay.classList.add('open');
    }, 120);
  }

  welcomeEnterBtn.addEventListener('click', () => {
    welcomeOverlay.classList.add('closing');
    document.body.style.overflow = '';
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

    if (!email || !password) {
      showError('Veuillez remplir tous les champs.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showError(error.message.includes('Invalid login')
          ? 'Email ou mot de passe incorrect.'
          : error.message);
        setLoading(false);
        return;
      }
      if (data.user) {
        const pseudo = (data.user.email || '').split('@')[0];
        document.getElementById('welcomeName').textContent = pseudo;
        showWelcomePopup();
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
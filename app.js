// ============================================================
// app.js — Connexion + popup bienvenue
// ============================================================
import { supabase } from './supabaseClient.js';

(async () => {
  // ============================================================
  // SESSION EXISTANTE
  // ============================================================
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = 'home.html';
    return;
  }

  // ============================================================
  // DOM
  // ============================================================
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');

  const eyeOff = passwordToggle?.querySelector('.eye-off');
  const eyeOn = passwordToggle?.querySelector('.eye-on');

  const welcomeOverlay = document.getElementById('welcomeOverlay');
  const welcomeEnterBtn = document.getElementById('welcomeEnterBtn');
  const welcomeName = document.getElementById('welcomeName');

  // ============================================================
  // HELPERS
  // ============================================================
  function showError(message) {
    if (!loginError) return;
    loginError.textContent = message;
    loginError.classList.add('visible');
  }

  function clearError() {
    if (!loginError) return;
    loginError.textContent = '';
    loginError.classList.remove('visible');
  }

  function setLoading(isLoading) {
    if (!loginBtn) return;
    loginBtn.disabled = isLoading;
    loginBtn.textContent = isLoading ? 'Connexion...' : 'Se connecter';
  }

  function showWelcomePopup(name) {
    if (!welcomeOverlay || !welcomeName) return;

    welcomeName.textContent = name || 'invité';
    document.body.style.overflow = 'hidden';
    welcomeOverlay.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
      welcomeOverlay.classList.add('open');
    });
  }

  function closeWelcomePopupAndEnter() {
    if (!welcomeOverlay) {
      window.location.href = 'home.html';
      return;
    }

    welcomeOverlay.classList.add('closing');
    document.body.style.overflow = '';

    setTimeout(() => {
      window.location.href = 'home.html';
    }, 380);
  }

  // ============================================================
  // THEME
  // ============================================================
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // ============================================================
  // TOGGLE MOT DE PASSE
  // ============================================================
  passwordToggle?.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';

    if (eyeOff) eyeOff.style.display = isHidden ? 'none' : 'inline';
    if (eyeOn) eyeOn.style.display = isHidden ? 'inline' : 'none';
  });

  // ============================================================
  // SOUMISSION FORMULAIRE
  // ============================================================
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    clearError();
    setLoading(true);

    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value || '';

    if (!email || !password) {
      showError('Veuillez remplir tous les champs.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const msg = error.message?.toLowerCase().includes('invalid login')
          ? 'Email ou mot de passe incorrect.'
          : 'Impossible de se connecter.';
        showError(msg);
        setLoading(false);
        return;
      }

      if (data?.user) {
        const pseudo = (data.user.email || email).split('@')[0];
        showWelcomePopup(pseudo);
      } else {
        showError('Connexion impossible.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Erreur connexion :', err);
      showError('Une erreur est survenue. Réessayez.');
      setLoading(false);
    }
  });

  // ============================================================
  // BOUTON DU POPUP
  // ============================================================
  welcomeEnterBtn?.addEventListener('click', () => {
    closeWelcomePopupAndEnter();
  });

  // ============================================================
  // FERMETURE POPUP AVEC ENTRÉE / ÉCHAP
  // ============================================================
  document.addEventListener('keydown', (e) => {
    if (!welcomeOverlay?.classList.contains('open')) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      closeWelcomePopupAndEnter();
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closeWelcomePopupAndEnter();
    }
  });

  // ============================================================
  // SYNC AUTH
  // ============================================================
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') {
      // on laisse le popup gérer la redirection
    }

    if (event === 'SIGNED_OUT') {
      clearError();
      setLoading(false);
    }
  });
})();
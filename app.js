// ============================================================
// app.js — Login page
// ============================================================
import { supabase } from './supabaseClient.js';

(async () => {
  // Si déjà connecté → rediriger vers home
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = 'home.html';
    return;
  }

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);
    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Veuillez remplir tous les champs.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        showError(error.message.includes('Invalid login') ? 'Email ou mot de passe incorrect.' : error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Tout le monde va sur home.html — l'admin y voit le bouton Panel Admin
        window.location.href = 'home.html';
      }
    } catch (err) {
      showError('Une erreur est survenue. Réessayez.');
      setLoading(false);
    }
  });

  function showError(msg) {
    loginError.textContent = msg;
    loginError.classList.add('visible');
  }

  function clearError() {
    loginError.textContent = '';
    loginError.classList.remove('visible');
  }

  function setLoading(loading) {
    loginBtn.disabled = loading;
    loginBtn.textContent = loading ? 'Connexion...' : 'Se connecter';
  }
})();
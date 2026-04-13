// ============================================================
// app.js — Login page avec diaporama + toggle mot de passe
// ============================================================
import { supabase } from './supabaseClient.js';

(async () => {
  // Si déjà connecté → rediriger vers home
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = 'home.html';
    return;
  }

  // ============================================================
  // TOGGLE MOT DE PASSE
  // ============================================================
  const passwordInput  = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  const eyeOff = passwordToggle.querySelector('.eye-off');
  const eyeOn  = passwordToggle.querySelector('.eye-on');

  passwordToggle.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    eyeOff.style.display = isHidden ? 'none'  : 'block';
    eyeOn.style.display  = isHidden ? 'block' : 'none';
    passwordToggle.setAttribute('aria-label',
      isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });

  // ============================================================
  // DIAPORAMA DE FOND
  // ============================================================
  const slides = document.querySelectorAll('.login-slide');
  let currentSlide = 0;
  let slideshowInterval = null;

  async function initSlideshow() {
    try {
      // Charger toutes les vidéos (lecture anonyme possible si RLS le permet)
      const { data: videos } = await supabase
        .from('videos')
        .select('youtube_id')
        .limit(20);

      if (!videos || videos.length === 0) return;

      // Mélanger les vidéos
      const shuffled = [...videos].sort(() => Math.random() - 0.5);

      // Remplir les slides avec les thumbnails YouTube (haute résolution)
      slides.forEach((slide, i) => {
        const v = shuffled[i % shuffled.length];
        // Essayer maxresdefault, fallback hqdefault
        const img = new Image();
        img.onload = () => {
          slide.style.backgroundImage = `url(${img.src})`;
        };
        img.onerror = () => {
          // Fallback qualité inférieure
          slide.style.backgroundImage =
            `url(https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg)`;
        };
        img.src = `https://img.youtube.com/vi/${v.youtube_id}/maxresdefault.jpg`;
      });

      // Démarrer le diaporama après 300ms
      setTimeout(startSlideshow, 300);
    } catch (e) {
      // Silencieux : le fond reste le gradient par défaut
    }
  }

  function startSlideshow() {
    slides[0].classList.add('active');
    slideshowInterval = setInterval(() => {
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % slides.length;
      slides[currentSlide].classList.add('active');
    }, 4000);
  }

  initSlideshow();

  // ============================================================
  // FORMULAIRE DE CONNEXION
  // ============================================================
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
        if (slideshowInterval) clearInterval(slideshowInterval);
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
(() => {
  'use strict';

  window.__GEMFALL_PLATFORM__ = 'capacitor-ios';

  const haptics = window.Capacitor?.Plugins?.Haptics;
  if (haptics && window.navigator) {
    window.navigator.vibrate = (duration = 20) => {
      const style = Number(duration) >= 70 ? 'MEDIUM' : 'LIGHT';
      haptics.impact({ style }).catch(() => {});
      return true;
    };
  }

  const suppressExternalNavigation = () => {
    const home = document.querySelector('#chip-home');
    if (home) {
      home.hidden = true;
      home.setAttribute('aria-hidden', 'true');
    }

    document.querySelectorAll('.lore-link').forEach((link) => {
      link.hidden = true;
      link.removeAttribute('href');
      link.setAttribute('aria-hidden', 'true');
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', suppressExternalNavigation, { once: true });
  } else {
    suppressExternalNavigation();
  }
})();

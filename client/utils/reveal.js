/**
 * reveal.js — drop-in scroll reveal for the VARSITY theme pack.
 *
 * Markup: <section data-reveal="theme" data-reveal-index="0">…</section>
 *   data-reveal        keyframe name, or "theme" to use the theme's --tp-reveal
 *   data-reveal-index  stagger position (index x --tp-stagger)
 *   data-reveal-dur    override --tp-dur-slow
 *
 * Reveals fire once. Nav, tab bars, sheets and above-the-fold app chrome must
 * never carry data-reveal — a product screen is fully present the moment it opens.
 */

const FALLBACK_REVEAL = 'tp-up';
const FALLBACK_DURATION = '480ms';
const FALLBACK_EASE = 'ease';
const FALLBACK_STAGGER = 55;
// A low threshold is important for full-page sections: a tall section may
// never occupy 20% of a short viewport, which would leave it hidden forever.
const VIEWPORT_THRESHOLD = 0;

function readToken(styles, name, fallback) {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

function revealElement(element, rootStyles) {
  const keyframe =
    element.dataset.reveal === 'theme'
      ? readToken(rootStyles, '--tp-reveal', FALLBACK_REVEAL)
      : element.dataset.reveal;
  const duration = element.dataset.revealDur || readToken(rootStyles, '--tp-dur-slow', FALLBACK_DURATION);
  const easing = readToken(rootStyles, '--tp-ease', FALLBACK_EASE);
  const stagger = Number.parseFloat(rootStyles.getPropertyValue('--tp-stagger')) || FALLBACK_STAGGER;
  const index = Number(element.dataset.revealIndex || 0);
  const delay = Math.round(index * stagger);

  element.style.opacity = '';
  element.style.animation = `${keyframe} ${duration} ${easing} ${delay}ms both`;
}

/**
 * Observes every [data-reveal] element inside `scope` and animates it into place
 * the first time it enters the viewport.
 *
 * @param {Document|HTMLElement} scope
 * @returns {() => void} teardown that disconnects all observers
 */
export function initReveals(scope = document) {
  const elements = Array.from(scope.querySelectorAll('[data-reveal]'));
  if (elements.length === 0) return () => {};

  const rootStyles = getComputedStyle(document.documentElement);
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion || !('IntersectionObserver' in window)) {
    elements.forEach((element) => {
      element.style.opacity = '';
      element.style.animation = 'none';
    });
    return () => {};
  }

  const groups = new Map();

  elements.forEach((element) => {
    element.style.animation = 'none';
    element.style.opacity = '0';
    const scroller = element.closest('[data-reveal-root]') || null;
    if (!groups.has(scroller)) groups.set(scroller, []);
    groups.get(scroller).push(element);
  });

  const observers = [];

  groups.forEach((groupElements, scroller) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealElement(entry.target, rootStyles);
          observer.unobserve(entry.target);
        });
      },
      { root: scroller, threshold: VIEWPORT_THRESHOLD },
    );

    groupElements.forEach((element) => observer.observe(element));
    observers.push(observer);
  });

  return () => observers.forEach((observer) => observer.disconnect());
}

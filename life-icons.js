/**
 * Единна SVG иконография за Life проекта — Lucide-стил, currentColor.
 */

const SVG_ATTRS = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

function wrapIcon(paths, size, extraClass = '') {
  const cls = extraClass ? ` class="${extraClass}"` : '';
  return `<svg ${SVG_ATTRS} width="${size}" height="${size}"${cls} aria-hidden="true">${paths}</svg>`;
}

export function iconChevronDown(size = 14) {
  return wrapIcon('<path d="m6 9 6 6 6-6"/>', size);
}

export function iconCheck(size = 16) {
  return wrapIcon('<path d="M20 6 9 17l-5-5"/>', size);
}


/**
 * Реални frosted-glass икони (images/life-icons/*.png), генерирани от
 * брандирани снимки — тюркоазена течност в матирано стъкло. Използват се
 * във hex feature картите; останалите са налични за употреба по име.
 */
export const LIFE_ICON_IMAGES = {
  flask: 'images/life-icons/flask.png',
  dna: 'images/life-icons/dna.png',
  brain: 'images/life-icons/brain.png',
  molecule: 'images/life-icons/molecule.png',
  capsule: 'images/life-icons/capsule.png',
  hourglass: 'images/life-icons/hourglass.png',
  microscope: 'images/life-icons/microscope.png',
  longevity: 'images/life-icons/longevity.png',
  formula: 'images/life-icons/formula.png',
  data: 'images/life-icons/data.png',
  trophy: 'images/life-icons/trophy.png',
  cross: 'images/life-icons/cross.png',
  logo: 'images/life-icons/logo.png',
  star: 'images/life-icons/star.png',
  // Псевдоним за името, използвано в съществуващото съдържание (feature карти)
  mitochondria: 'images/life-icons/capsule.png'
};

/* Frosted икони за hero hex fallback кадрите: здраве, бранд, доказани резултати */
export const HERO_HEX_ICON_IMAGES = {
  vial: LIFE_ICON_IMAGES.cross,
  lab: LIFE_ICON_IMAGES.logo,
  face: LIFE_ICON_IMAGES.trophy
};

/** <img> за frosted икона по име; празен низ, ако няма такава (SVG fallback). */
export function getLifeIconImg(name, size = 48, alt = '', cls = 'life-icon-img') {
  const src = LIFE_ICON_IMAGES[name];
  if (!src) return '';
  const safeAlt = String(alt)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<img src="${src}" alt="${safeAlt}" class="${cls}" width="${size}" height="${size}" loading="lazy" decoding="async" style="object-fit:contain;">`;
}

/** Икони за hex feature cards (митохондрии, ДНК, мозък) */
export function getFeatureIconSVG(iconName, size = 32) {
  const icons = {
    mitochondria: '<ellipse cx="12" cy="12" rx="9" ry="5"/><path d="M5 12c2.5-1.5 4.5-1.5 7 0s4.5 1.5 7 0"/><path d="M6 10c2-1 3.5-1 6 0"/><path d="M6 14c2 1 3.5 1 6 0"/>',
    dna: '<path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22a1 1 0 0 1-1-1v-3a1 1 0 0 1 2 0v3a1 1 0 0 1-1 1z"/><path d="M15 2a1 1 0 0 1 1 1v3a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1z"/><path d="M2 9c6.667 6 13.333 0 20 6"/>',
    brain: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  };
  return wrapIcon(icons[iconName] || icons.brain, size);
}

/** Fallback икони за hero hex кадрите (флакон, лаборатория, лице) */
export function getHeroHexIconSVG(type, size = 52) {
  const icons = {
    vial: '<path d="M9 3h6"/><path d="M10 3v5.2a4 4 0 0 0-1.2 2.8L5.5 20.2a1 1 0 0 0 .9 1.5h10.2a1 1 0 0 0 .9-1.5L15.2 11a4 4 0 0 0-1.2-2.8V3"/><path d="M8 14h8"/>',
    lab: '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
    face: '<circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/>',
  };
  return wrapIcon(icons[type] || icons.vial, size);
}

/** Икони за hero статистики */
const STAT_PATHS = {
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  flask: '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
  dna: '<path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22a1 1 0 0 1-1-1v-3a1 1 0 0 1 2 0v3a1 1 0 0 1-1 1z"/><path d="M15 2a1 1 0 0 1 1 1v3a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1z"/><path d="M2 9c6.667 6 13.333 0 20 6"/>',
  sparkle: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
};

export function getStatIconSVG(iconName) {
  return STAT_PATHS[iconName] || STAT_PATHS.star;
}

export function getStatIconElement(iconName, size = 32) {
  return wrapIcon(getStatIconSVG(iconName), size, 'stat-icon');
}

export function getBenefitIconSVG(type, size = 20) {
  if (type === 'fire') {
    return wrapIcon('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>', size);
  }
  return wrapIcon('<path d="M20 6 9 17l-5-5"/>', size);
}

const GUARANTEE_ALIASES = {
  certificate: 'award',
  support: 'headphones',
  refresh: 'refresh',
};

export function getGuaranteeIconSVG(type, size = 48) {
  const key = GUARANTEE_ALIASES[type] || type;
  const icons = {
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H3z"/><path d="M21 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3z"/><path d="M3 10v4"/><path d="M21 10v4"/><path d="M7 10a5 5 0 0 1 10 0"/>',
  };
  return wrapIcon(icons[key] || icons.shield, size);
}

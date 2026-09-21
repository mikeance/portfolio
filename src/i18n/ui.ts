export const languages = { es: 'Español', en: 'English' } as const;
export type Lang = keyof typeof languages;

export const ui = {
  es: {
    'nav.photography': 'Fotografía',
    'nav.works': 'Works',
    'nav.contact': 'Contacto',
    'nav.soon': 'Coming soon',
    'cat.faces': 'Faces',
    'cat.editorial': 'Editorial',
    'cat.lifestyle': 'Life',
    'contact.email': 'Correo electrónico',
    'contact.instagram': 'Instagram',
    'site.description': 'Portfolio de fotografía de Miguel Antón.',
    'footer.rights': 'Todos los derechos reservados.',
    'lightbox.close': 'Cerrar',
  },
  en: {
    'nav.photography': 'Photography',
    'nav.works': 'Works',
    'nav.contact': 'Contact',
    'nav.soon': 'Coming soon',
    'cat.faces': 'Faces',
    'cat.editorial': 'Editorial',
    'cat.lifestyle': 'Life',
    'contact.email': 'Email',
    'contact.instagram': 'Instagram',
    'site.description': 'Photography portfolio by Miguel Antón.',
    'footer.rights': 'All rights reserved.',
    'lightbox.close': 'Close',
  },
} as const;

export type UiKey = keyof (typeof ui)['es'];

export function useTranslations(lang: Lang) {
  return (key: UiKey) => ui[lang][key];
}

/** Ruta localizada: es sin prefijo, en bajo /en */
export function localePath(lang: Lang, path = '/') {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (lang === 'es') return clean;
  return clean === '/' ? '/en' : `/en${clean}`;
}

export type Lang = 'en';

export const ui = {
  en: {
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

export type UiKey = keyof (typeof ui)['en'];

export function useTranslations(_lang: Lang = 'en') {
  return (key: UiKey) => ui.en[key];
}

/** Un solo idioma: la ruta no lleva prefijo. */
export function localePath(_lang: Lang, path = '/') {
  return path.startsWith('/') ? path : `/${path}`;
}

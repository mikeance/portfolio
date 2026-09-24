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
    'nav.about': 'About',
    // SEO: títulos y descripciones (no se ven en la página; salen en Google y al compartir)
    'seo.home.title': 'Miguel Antón · Film photographer · Fotógrafo analógico en Madrid',
    'seo.home.description': 'Fotógrafo analógico en Madrid: retrato, editorial y campañas en película (35mm y medio formato). Film photographer based in Madrid — portraits, editorial and brand campaigns shot on film.',
    'seo.home.h1': 'Miguel Antón — fotógrafo analógico en Madrid · film photographer',
    'seo.person': 'Fotógrafo y diseñador gráfico en Madrid, cofundador de Scrap World. Photographer and graphic designer based in Madrid: portraits, editorial and campaigns, mostly on film.',
    'seo.faces.title': 'Faces · Retratos en película',
    'seo.faces.description': 'Retratos analógicos de Miguel Antón, fotógrafo en Madrid, en película (35mm y medio formato). Film portraits shot in Madrid and on the road.',
    'seo.editorial.title': 'Editorial · Moda y lookbooks en película',
    'seo.editorial.description': 'Editoriales, lookbooks y moda fotografiados en película por Miguel Antón en Madrid. Fashion and editorial film photography.',
    'seo.lifestyle.title': 'Life · Viajes y día a día en película',
    'seo.lifestyle.description': 'Fotografía analógica de viajes y día a día: Madrid, Asturias, Lisboa, Porto, París, Nueva York… Travel and everyday film photography by Miguel Antón.',
    'seo.works.title': 'Works · Campañas y encargos',
    'seo.works.description': 'Campañas y encargos para Scrap World, Adidas, Real Madrid, Porsche, Zalando, Nike o Atlantic Records, fotografiados en película por Miguel Antón. Brand campaigns shot on film.',
    'seo.work.description': '{name}: fotografía analógica por Miguel Antón, fotógrafo en Madrid. Film photography for {name}.',
    'seo.about.title': 'About · Fotógrafo y diseñador gráfico en Madrid',
    'seo.about.description': 'Miguel Antón, fotógrafo y diseñador gráfico en Madrid, cofundador de Scrap World: retrato, editorial y campañas en película. Photographer and graphic designer based in Madrid.',
    'footer.rights': 'All rights reserved.',
    'footer.lab.before': 'All film photographs developed and enlarged/scanned by ',
    'footer.lab.after': ' in Madrid.',
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

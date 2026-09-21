// Sirve la web estática en mikeance.com y redirige cualquier otro dominio (miguelanton.me, www…) al principal.
const MAIN = 'mikeance.com';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const wrongHost = url.hostname !== MAIN && !url.hostname.endsWith('.workers.dev');
    const scheme = (request.headers.get('cf-visitor') || '').includes('"http"') ? 'http' : url.protocol.replace(':', '');
    if (url.pathname === '/en' || url.pathname.startsWith('/en/')) { url.pathname = url.pathname.slice(3) || '/'; url.protocol = 'https:'; url.hostname = MAIN; return Response.redirect(url.toString(), 301); }
    if (wrongHost || scheme === 'http') {
      if (wrongHost) url.hostname = MAIN;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};

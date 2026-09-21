// Sirve la web estática en mikeance.com y redirige cualquier otro dominio (miguelanton.me, www…) al principal.
const MAIN = 'mikeance.com';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const wrongHost = url.hostname !== MAIN && !url.hostname.endsWith('.workers.dev');
    if (wrongHost || url.protocol === 'http:') {
      if (wrongHost) url.hostname = MAIN;
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};

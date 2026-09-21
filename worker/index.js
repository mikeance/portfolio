// Sirve la web estática en mikeance.com y redirige cualquier otro dominio (miguelanton.me, www…) al principal.
const MAIN = 'mikeance.com';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname !== MAIN && !url.hostname.endsWith('.workers.dev')) {
      url.hostname = MAIN;
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};

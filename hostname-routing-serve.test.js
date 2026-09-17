import { serveMappedAsset } from './hostname-routing.js';

/**
 * @param {Record<string, string>} files pathname -> body
 */
function mockAssets(files) {
  return {
    fetch: async (req) => {
      const pathname = new URL(req.url).pathname;
      if (Object.prototype.hasOwnProperty.call(files, pathname)) {
        const body = files[pathname];
        return new Response(body, {
          status: body == null ? 404 : 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      return new Response('missing', { status: 404 });
    },
  };
}

function html(title) {
  return `<!doctype html><html><head><title>${title}</title></head><body></body></html>`;
}

describe('serveMappedAsset', () => {
  test('maps biocode checkout to portfolio-checkout.html', async () => {
    const env = {
      ASSETS: mockAssets({
        '/portfolio-checkout.html': html('Поръчка – BIOCODE Nutrition Science'),
        '/checkout.html': html('Поръчка - ДА ОТСЛАБНА'),
      }),
    };
    const req = new Request('https://biocode-bg.com/checkout.html');
    const res = await serveMappedAsset(req, env, new URL(req.url));
    expect(res?.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('BIOCODE');
    expect(text).not.toContain('ДА ОТСЛАБНА');
  });

  test('maps life homepage to life.html', async () => {
    const env = {
      ASSETS: mockAssets({
        '/life.html': html('Life Protocols - Протоколи за Здраве и Дълголетие'),
        '/index.html': html('ДА ОТСЛАБНА - Мисията възможна'),
      }),
    };
    const req = new Request('https://life-protocols.com/');
    const res = await serveMappedAsset(req, env, new URL(req.url));
    expect(await res?.text()).toContain('Life Protocols');
  });

  test('returns markdown when Accept: text/markdown', async () => {
    const env = {
      ASSETS: mockAssets({
        '/life.html': '<!doctype html><html><head><title>Life Protocols</title>'
          + '<meta name="description" content="Longevity">'
          + '</head><body><h1>Life Protocols</h1><p>Products.</p></body></html>',
      }),
    };
    const req = new Request('https://life-protocols.com/', {
      headers: { Accept: 'text/markdown' },
    });
    const res = await serveMappedAsset(req, env, new URL(req.url));
    expect(res?.status).toBe(200);
    expect(res?.headers.get('content-type')).toContain('text/markdown');
    expect(res?.headers.get('x-markdown-tokens')).toBeTruthy();
    const text = await res.text();
    expect(text).toContain('title: Life Protocols');
    expect(text).toContain('# Life Protocols');
  });

  test('maps life about-us alias to life-about.html', async () => {
    const env = {
      ASSETS: mockAssets({
        '/life-about.html': html('За нас - Life Protocols'),
        '/about-us.html': html('За нас - ДА ОТСЛАБНА'),
      }),
    };
    const req = new Request('https://life-protocols.com/about-us.html');
    const res = await serveMappedAsset(req, env, new URL(req.url));
    const text = await res.text();
    expect(text).toContain('Life Protocols');
    expect(text).not.toContain('ДА ОТСЛАБНА');
  });

  test('does not fall back to main checkout on portfolio when mapped file missing', async () => {
    const env = {
      ASSETS: mockAssets({
        '/checkout.html': html('Поръчка - ДА ОТСЛАБНА'),
      }),
    };
    const req = new Request('https://biocode-bg.com/category.html');
    const res = await serveMappedAsset(req, env, new URL(req.url));
    expect(res?.status).toBe(404);
  });

  test('main site may fall back to requested path when mapped alias missing', async () => {
    const env = {
      ASSETS: mockAssets({
        '/about-us.html': html('За нас - ДА ОТСЛАБНА'),
      }),
    };
    const req = new Request('https://daotslabna.com/about-us.html');
    const res = await serveMappedAsset(req, env, new URL(req.url));
    expect(res?.status).toBe(200);
    expect(await res.text()).toContain('ДА ОТСЛАБНА');
  });

  test('returns null when ASSETS binding missing', async () => {
    const req = new Request('https://daotslabna.com/');
    const res = await serveMappedAsset(req, {}, new URL(req.url));
    expect(res).toBeNull();
  });
});

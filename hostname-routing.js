import { maybeEnhanceProductHtmlResponse } from './product-og-serve.js';
import { handleSeoRequest, maybeEnhanceSeoHtml, maybeWwwRedirect } from './seo-serve.js';
import {
  getSiteForHost,
  isStaticAssetPath,
  isWorkerApiPath,
  mapAssetPath,
  SITE_BY_HOST,
} from './site-routing.js';

export {
  getSiteForHost,
  isStaticAssetPath,
  isWorkerApiPath,
  mapAssetPath,
  SITE_BY_HOST,
};

function assetFetchInit(request) {
  const init = {
    method: request.method,
    headers: request.headers,
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }
  return init;
}

export async function serveMappedAsset(request, env, url) {
  if (!env.ASSETS) return null;

  const wwwRedirect = maybeWwwRedirect(url);
  if (wwwRedirect) return wwwRedirect;

  const seoResponse = await handleSeoRequest(request, env, url);
  if (seoResponse) return seoResponse;

  const site = getSiteForHost(url.hostname);
  const pathname = url.pathname;
  const mappedPath = mapAssetPath(site, pathname);
  const fetchInit = assetFetchInit(request);

  const assetUrl = new URL(request.url);
  assetUrl.pathname = mappedPath;
  let response = await env.ASSETS.fetch(new Request(assetUrl.toString(), fetchInit));

  if (response.status === 404 && mappedPath !== pathname) {
    assetUrl.pathname = pathname;
    response = await env.ASSETS.fetch(new Request(assetUrl.toString(), fetchInit));
  }

  const ctx = { env, site, mappedPath, requestUrl: request.url };

  response = await maybeEnhanceSeoHtml(response, ctx);
  response = await maybeEnhanceProductHtmlResponse(response, ctx);

  return response;
}

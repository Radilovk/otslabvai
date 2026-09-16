/**
 * WebMCP browser tools for storefront homepages (Agent Readiness).
 * Registers read-only catalog discovery tools when modelContext is available.
 */
(function () {
  var mc = null;
  if (typeof document !== 'undefined' && document.modelContext) mc = document.modelContext;
  else if (typeof navigator !== 'undefined' && navigator.modelContext) mc = navigator.modelContext;
  if (!mc) return;

  function origin() {
    return window.location.origin;
  }

  var tools = [
    {
      name: 'get_llms_index',
      description: 'Fetch llms.txt — AI site map with product links and discovery URLs for this storefront.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {} },
      execute: function () {
        return fetch(origin() + '/llms.txt', { headers: { Accept: 'text/plain' } })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
          })
          .catch(function (err) {
            return 'ERROR fetching llms.txt: ' + (err && err.message ? err.message : String(err));
          });
      },
    },
    {
      name: 'get_api_catalog',
      description: 'Fetch RFC 9727 api-catalog linkset JSON listing public HTTP APIs.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {} },
      execute: function () {
        return fetch(origin() + '/.well-known/api-catalog', { headers: { Accept: 'application/linkset+json' } })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
          })
          .catch(function (err) {
            return 'ERROR fetching api-catalog: ' + (err && err.message ? err.message : String(err));
          });
      },
    },
    {
      name: 'search_llms_catalog',
      description: 'Search llms.txt for a keyword and return matching lines (product names, URLs).',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keyword to search in llms.txt', minLength: 1 },
        },
        required: ['query'],
      },
      execute: function (input) {
        var q = String((input && input.query) || '').toLowerCase();
        if (!q) return 'ERROR: query is required.';
        return fetch(origin() + '/llms.txt')
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
          })
          .then(function (txt) {
            var lines = txt.split('\n').filter(function (line) {
              return line.toLowerCase().indexOf(q) >= 0;
            });
            if (!lines.length) return 'No matches for "' + q + '" in llms.txt.';
            return lines.slice(0, 20).join('\n');
          })
          .catch(function (err) {
            return 'ERROR searching llms.txt: ' + (err && err.message ? err.message : String(err));
          });
      },
    },
    {
      name: 'open_faq',
      description: 'Navigate to the FAQ page for shipping, returns, and ordering questions.',
      annotations: { readOnlyHint: false },
      inputSchema: { type: 'object', properties: {} },
      execute: function () {
        window.location.assign('/faq.html');
        return 'Navigating to /faq.html';
      },
    },
  ];

  try {
    if (typeof mc.registerTool === 'function') {
      for (var i = 0; i < tools.length; i++) mc.registerTool(tools[i]);
    } else if (typeof mc.provideContext === 'function') {
      mc.provideContext({ tools: tools });
    }
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[webmcp-storefront] tool registration failed:', e);
    }
  }
})();

# Security Note: API Token Endpoint

## Important Security Consideration

The `/api-token` endpoint returns the GitHub Personal Access Token that is used for uploading images in the admin panel.

### Production Recommendation

**Use Cloudflare Workers Secrets (Environment Variables):**

```bash
wrangler secret put GITHUB_API_TOKEN
```

This is the recommended approach because:
- Secrets are encrypted and more secure
- Not accessible through public API endpoints without proper authentication
- Automatically injected into the worker environment

### If Using KV Storage

If you choose to store the token in KV storage (less secure):

1. **MUST** protect the admin panel and `/api-token` endpoint with authentication
2. Recommended: Use [Cloudflare Access](https://www.cloudflare.com/products/zero-trust/access/) to add authentication layer
3. Alternative: Use Cloudflare WAF rules to restrict access by IP or other criteria

### Current State

⚠️ **The `/api-token` endpoint currently has NO authentication**, following the same pattern as other admin endpoints in this codebase (e.g., `/page_content.json`, `/orders`).

This means:
- The entire admin panel should be protected externally (e.g., Cloudflare Access)
- OR use environment variables instead of KV storage for the token

### Authentication Implementation (Optional)

If you want to add authentication to the endpoint, you would need to:
1. Implement an authentication mechanism (e.g., API key, JWT)
2. Add authentication check in the `handleGetApiToken()` function
3. Update the admin.js to include authentication headers

Example:
```javascript
// In worker.js
async function handleGetApiToken(request, env) {
    // Check authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // ... rest of the code
}
```

## Recommended Production Setup

1. Set GitHub token as a secret:
   ```bash
   wrangler secret put GITHUB_API_TOKEN
   ```

2. Set up Cloudflare Access for `/admin.html` and all admin endpoints

3. Consider rotating the token periodically

4. Monitor GitHub audit logs for unexpected activity

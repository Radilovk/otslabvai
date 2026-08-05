/** Shared admin API helpers for E2E tests. */
export async function adminLogin(base, password = 'kakadu1234') {
  const res = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Admin login failed: HTTP ${res.status}`);
  return data.token;
}

export async function adminFetchOrders(base, token, project) {
  const qs = project ? `?project=${encodeURIComponent(project)}` : '';
  const res = await fetch(`${base}/portfolio/orders${qs}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`GET /portfolio/orders failed: HTTP ${res.status}`);
  return res.json();
}

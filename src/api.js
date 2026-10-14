export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const body = options.body;
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, {
    ...options,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

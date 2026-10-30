// Thin API client. Token lives in localStorage; all calls go through /api (proxied in dev).
const TOKEN_KEY = 'biomedaccess_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form; // FormData: browser sets the multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const downloadUrl = (resourceId) => `/api/resources/${resourceId}/download`;

// Authenticated download (keeps Authorization header), then saves the blob.
// Filename comes from Content-Disposition when the server sends one.
export async function downloadBlob(path, fallbackName) {
  const token = getToken();
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Download failed.');
  }
  const disp = res.headers.get('Content-Disposition') || '';
  const star = disp.match(/filename\*=UTF-8''([^;]+)/i);
  const plain = disp.match(/filename="([^"]+)"/i);
  const name = star ? decodeURIComponent(star[1]) : plain ? plain[1] : fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadResource(resourceId, filename) {
  return downloadBlob(`/resources/${resourceId}/download`, filename || 'resource');
}

// Per-subtopic / per-topic PDF generated on the server.
export const downloadSubtopicPdf = (subtopicId, fallbackName) => downloadBlob(`/subtopics/${subtopicId}/pdf`, fallbackName || 'subtopic.pdf');
export const downloadTopicPdf = (topicId, fallbackName) => downloadBlob(`/topics/${topicId}/pdf`, fallbackName || 'topic.pdf');

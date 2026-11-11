// File: frontend/src/services/api.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Plain messages for failures that have no message from the server.
export const NETWORK_ERROR_MESSAGE = 'ShopSmart could not be reached. Check that the server is running, then try again.';
export const TIMEOUT_MESSAGE = 'ShopSmart took too long to answer. Please try again.';
export const SERVER_ERROR_MESSAGE = 'The ShopSmart server had a problem. Please try again in a moment.';

// Order fields as the customer sees them on the checkout form.
const FIELD_LABELS = { customerName: 'full name', email: 'email address', address: 'delivery address', items: 'cart items' };

// Turns a failed response into an Error with a message a shopper can act on.
export function buildRequestError(status, data) {
  let message = data?.error?.message;
  if (!message) message = status >= 500 ? SERVER_ERROR_MESSAGE : `Request failed with status ${status}.`;

  // A rejected order says which fields were wrong, so name them.
  const fields = Object.keys(data?.error?.details?.fieldErrors ?? {}).map((field) => FIELD_LABELS[field] ?? field);
  if (fields.length > 0) message = `${message} Please check: ${fields.join(', ')}.`;

  const error = new Error(message);
  error.status = status;
  error.code = data?.error?.code;
  return error;
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  } catch (caught) {
    // fetch only throws when no response arrived at all: server down, no network, or our timeout.
    const timedOut = caught?.name === 'TimeoutError' || caught?.name === 'AbortError';
    const error = new Error(timedOut ? TIMEOUT_MESSAGE : NETWORK_ERROR_MESSAGE);
    error.status = 0;
    error.code = timedOut ? 'TIMEOUT' : 'NETWORK_ERROR';
    throw error;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) throw buildRequestError(response.status, data);
  return data;
}

export const api = {
  getProducts: (query = '') => request(`/products${query ? `?search=${encodeURIComponent(query)}` : ''}`),
  getProduct: (id) => request(`/products/${id}`),
  createOrder: (order) => request('/orders', { method: 'POST', body: JSON.stringify(order) }),
  askAssistant: (question) => request('/assistant/questions', {
    // The browser stops waiting after 20 seconds, so the page can never load forever.
    method: 'POST', body: JSON.stringify({ question }), signal: AbortSignal.timeout(20000)
  })
};

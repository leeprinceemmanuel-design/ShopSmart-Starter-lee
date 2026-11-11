// File: frontend/src/services/api.test.js
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, NETWORK_ERROR_MESSAGE, SERVER_ERROR_MESSAGE, TIMEOUT_MESSAGE } from './api.js';

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

afterEach(() => vi.unstubAllGlobals());

describe('api error messages', () => {
  it('server down (fetch throws) gives a readable message, not "Failed to fetch"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.getProducts()).rejects.toMatchObject({ message: NETWORK_ERROR_MESSAGE, status: 0, code: 'NETWORK_ERROR' });
  });

  it('a browser timeout gives the timeout message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('signal timed out', 'TimeoutError')));
    await expect(api.askAssistant('Which keyboard?')).rejects.toMatchObject({ message: TIMEOUT_MESSAGE, code: 'TIMEOUT' });
  });

  it('a 500 with no JSON body (for example a proxy error) gives the server message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new SyntaxError('no body'); } }));
    await expect(api.getProducts()).rejects.toMatchObject({ message: SERVER_ERROR_MESSAGE, status: 500 });
  });

  it('keeps the server message when there is one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(409, { error: { code: 'INSUFFICIENT_STOCK', message: 'Only 7 unit(s) of Compact Mechanical Keyboard are available.' } })));
    await expect(api.createOrder({})).rejects.toMatchObject({ status: 409, code: 'INSUFFICIENT_STOCK', message: 'Only 7 unit(s) of Compact Mechanical Keyboard are available.' });
  });

  it('a rejected order names the fields to fix', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(422, {
      error: { code: 'INVALID_ORDER', message: 'Check the customer and cart information.', details: { fieldErrors: { email: ['Invalid email address'] } } }
    })));
    await expect(api.createOrder({})).rejects.toMatchObject({ message: 'Check the customer and cart information. Please check: email address.' });
  });
});

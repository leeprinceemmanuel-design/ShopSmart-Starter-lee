// File: backend/src/middleware/errorHandler.js
// Turns any error into a safe JSON reply and a safe log line.
// Why this exists: when the JSON body cannot be read, Express's parser puts the
// whole raw body on the error object. For a checkout, that body holds the
// customer's name, email and address, so we must never log or return it.

const GENERIC_MESSAGE = 'The server could not complete the request.';

// Decides what the client is allowed to see. Returns { status, code, message }.
export function toSafeError(error) {
  // The body was not valid JSON. The parser's own message can quote part of the
  // body, so we replace it with our own fixed text.
  if (error?.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'The request body is not valid JSON.' };
  }
  if (error?.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' };
  }
  const status = Number(error?.status) || 500;
  // 4xx errors that our own code created (for example STOCK_CHANGED) carry a
  // message written for customers, so it is safe to pass on.
  if (status < 500) return { status, code: error.code || 'BAD_REQUEST', message: error.message };
  return { status, code: 'INTERNAL_ERROR', message: GENERIC_MESSAGE };
}

// Builds the log line. Only fixed fields are copied, never the error object
// itself, so a request body attached to the error can't reach the logs.
export function toLogLine(requestId, error, safe) {
  const base = `[${requestId}] ${safe.status} ${safe.code}`;
  // For server faults the stack trace is needed to debug. It holds file names
  // and line numbers, not the request body.
  return safe.status >= 500 ? `${base} ${error?.stack || error?.name || 'Error'}` : base;
}

export function errorHandler(error, request, response, _next) {
  const safe = toSafeError(error);
  console.error(toLogLine(request.id, error, safe));
  response.status(safe.status).json({ error: { code: safe.code, message: safe.message, traceId: request.id } });
}

import { adminState } from './state.js';

export function authHeaders(contentType) {
  const headers = { Authorization: `Bearer ${adminState.token}` };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
}

export function parseErrorResponse(response) {
  return response
    .json()
    .catch(() => ({}))
    .then((body) =>
      Promise.reject({
        status: response.status,
        message: body?.message ?? response.statusText ?? 'request failed',
        ...body,
      }),
    );
}

/* For ESLint: List any global identifiers used in this file below */
/* global  */

export default async function postData(url = '', payload = {}) {
  return fetch(url, {
    method: 'POST',
    cache: 'no-cache',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

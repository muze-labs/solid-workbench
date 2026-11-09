export function httpUrl(input, base) {
  const url = new URL(input, base);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'solid-app-data: Use an HTTP or HTTPS URL without credentials.'
    );
  }
  return url.href;
}
export function documentUrl(input) {
  const url = new URL(httpUrl(input));
  url.hash = '';
  return url.href;
}

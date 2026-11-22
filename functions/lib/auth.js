export async function authorized(request, secret) {
  if (!secret || secret.length < 32) return false;
  const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(request.headers.get('Authorization') || ''), digest(`Bearer ${secret}`)]);
  return a.reduce((difference, byte, index) => difference | (byte ^ b[index]), 0) === 0;
}

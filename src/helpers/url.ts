import type { Provider } from '../types/types';

/** Strips trailing slashes from a URL base. */
export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Strips leading slashes from an endpoint. */
export function stripLeadingSlash(endpoint: string): string {
  return endpoint.replace(/^\/+/, '');
}

/** Join a base URL and an endpoint into a full URL. */
export function joinUrl(base: string, endpoint: string): string {
  return `${stripTrailingSlash(base)}/${stripLeadingSlash(endpoint)}`;
}

/** Extract the protocol + host portion of a URL. */
export function getBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return stripTrailingSlash(url);
  }
}

/** Build the full chat API URL from a Provider. */
export function getFullChatUrl(provider: Provider): string {
  const base = stripTrailingSlash(provider.api_url);
  const endpoint = stripLeadingSlash(provider.endpoint || '/v1/chat/completions');
  return `${base}/${endpoint}`;
}

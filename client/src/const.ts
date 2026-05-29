export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// The Manus-hosted domain that is whitelisted for OAuth callbacks.
// When deploying to external hosts (e.g. Vercel), OAuth still goes through this domain,
// and the token is bridged back to the current origin via /api/oauth/bridge.
const MANUS_HOSTED_ORIGIN = import.meta.env.VITE_MANUS_HOSTED_ORIGIN || "";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const currentOrigin = window.location.origin;

  // If we have a Manus-hosted origin configured AND we're not already on it,
  // use the Manus domain for the OAuth callback (it's whitelisted), then bridge back.
  const usesBridge = MANUS_HOSTED_ORIGIN && currentOrigin !== MANUS_HOSTED_ORIGIN;
  const callbackOrigin = usesBridge ? MANUS_HOSTED_ORIGIN : currentOrigin;

  const redirectUri = `${callbackOrigin}/api/oauth/callback`;

  // New state format: base64-encoded JSON with redirectUri + optional returnOrigin
  const statePayload = usesBridge
    ? { redirectUri, returnOrigin: currentOrigin }
    : { redirectUri };
  const state = btoa(JSON.stringify(statePayload));

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

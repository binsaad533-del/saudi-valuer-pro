export const PRODUCTION_APP_URL = "https://jsaasvaluation.app";
export const RECOVERY_CALLBACK_PATH = "/auth/recovery";
export const RESET_PASSWORD_PATH = "/reset-password";
export const RECOVERY_CALLBACK_URL = `${PRODUCTION_APP_URL}${RECOVERY_CALLBACK_PATH}`;

const normalizeHashValue = (hash: string) => {
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
  return rawHash.startsWith("?") ? rawHash.slice(1) : rawHash;
};

const toRecord = (params: URLSearchParams): Record<string, string> =>
  Object.fromEntries(Array.from(params.entries()));

export interface RecoveryParams {
  accessToken?: string;
  refreshToken?: string;
  token?: string;
  tokenHash?: string;
  type?: string;
  code?: string;
  redirect?: string;
  email?: string;
  error?: string;
  errorCode?: string;
  errorDescription?: string;
  queryParams: Record<string, string>;
  hashParams: Record<string, string>;
}

export const readRecoveryParamsFromLocation = (
  locationLike: Pick<Location, "search" | "hash"> = window.location,
): RecoveryParams => {
  const searchParams = new URLSearchParams(locationLike.search);
  const hashParams = new URLSearchParams(normalizeHashValue(locationLike.hash));
  const getParam = (key: string) => searchParams.get(key) ?? hashParams.get(key) ?? undefined;

  return {
    accessToken: getParam("access_token"),
    refreshToken: getParam("refresh_token"),
    token: getParam("token"),
    tokenHash: getParam("token_hash"),
    type: getParam("type"),
    code: getParam("code"),
    redirect: getParam("redirect") ?? getParam("redirect_to") ?? getParam("redirectTo"),
    email: getParam("email"),
    error: getParam("error"),
    errorCode: getParam("error_code"),
    errorDescription: getParam("error_description"),
    queryParams: toRecord(searchParams),
    hashParams: toRecord(hashParams),
  };
};

export const hasRecoveryParams = (params: RecoveryParams) => Boolean(
  params.type === "recovery" ||
  params.accessToken ||
  params.refreshToken ||
  params.token ||
  params.tokenHash ||
  params.code,
);

export const getRecoveryDebugInfo = (params: RecoveryParams) => ({
  queryParams: params.queryParams,
  hashParams: params.hashParams,
  hasAccessToken: Boolean(params.accessToken),
  hasRefreshToken: Boolean(params.refreshToken),
  hasToken: Boolean(params.token),
  hasTokenHash: Boolean(params.tokenHash),
  hasCode: Boolean(params.code),
  hasEmail: Boolean(params.email),
  type: params.type ?? null,
  redirect: params.redirect ?? null,
  error: params.error ?? null,
  errorCode: params.errorCode ?? null,
  errorDescription: params.errorDescription ?? null,
});

export const buildRecoveryRedirectUrl = () => RECOVERY_CALLBACK_URL;
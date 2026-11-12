import { isAuthError } from "@supabase/supabase-js";

export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "userAlreadyExists"
  | "weakPassword"
  | "rateLimited"
  | "invalidEmail";

/** Traduz os códigos de erro do Supabase Auth para chaves de `auth.errors.*`. */
export function getAuthErrorKey(error: unknown): AuthErrorKey | null {
  if (!isAuthError(error)) return null;
  switch (error.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "user_already_exists":
    case "email_exists":
      return "userAlreadyExists";
    case "weak_password":
      return "weakPassword";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rateLimited";
    case "email_address_invalid":
      return "invalidEmail";
    default:
      return null;
  }
}

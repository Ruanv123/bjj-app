import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

import { unregisterPushAsync } from "@/features/notifications/push";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type OAuthProvider = "google" | "apple";

const redirectTo = Linking.createURL("auth/callback");

if (__DEV__) {
  // Este valor precisa estar liberado em Supabase → Authentication → URL Configuration → Redirect URLs.
  console.log(
    "[auth] redirectTo:",
    Platform.OS === "web" ? globalThis.location?.origin : redirectTo,
  );
}

/**
 * Log de diagnóstico (só em dev): mostra para onde o login voltou sem expor
 * o `code`/tokens — só os nomes dos parâmetros e mensagens de erro.
 */
export function logAuthReturn(label: string, url: string | null | undefined) {
  if (!__DEV__) return;
  if (!url) {
    console.log(`[auth] ${label}: (sem URL)`);
    return;
  }
  try {
    const parsed = new URL(url);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    const keys = [
      ...parsed.searchParams.keys(),
      ...[...hash.keys()].map((k) => `#${k}`),
    ];
    const error =
      parsed.searchParams.get("error_description") ??
      hash.get("error_description") ??
      parsed.searchParams.get("error") ??
      hash.get("error");
    console.log(
      `[auth] ${label}: ${parsed.protocol}//${parsed.host}${parsed.pathname}`,
      `| parâmetros: ${keys.join(", ") || "(nenhum)"}`,
      error ? `| ERRO: ${error}` : "",
    );
  } catch {
    console.log(`[auth] ${label}: URL inválida`);
  }
}

/** Troca o `code` (PKCE) ou os tokens recebidos no deep link por uma sessão. */
export async function createSessionFromUrl(url: string) {
  logAuthReturn("voltou para", url);
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const params = parsed.searchParams;

  const errorDescription =
    params.get("error_description") ?? hash.get("error_description");
  if (errorDescription) throw new Error(errorDescription);

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }
}

/** Login via navegador (Google em todas as plataformas, Apple no Android/web). */
export async function signInWithOAuth(provider: OAuthProvider) {
  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (__DEV__) console.log("[auth] navegador fechou com:", result.type);
  if (result.type === "success") {
    await createSessionFromUrl(result.url);
  }
}

/** Login nativo com Apple (somente iOS). */
export async function signInWithAppleNative() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("A Apple não retornou um identity token.");
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
    });
    if (error) throw error;

    // A Apple só envia o nome no primeiro login: salvamos no perfil.
    const { givenName, familyName } = credential.fullName ?? {};
    if (givenName || familyName) {
      await supabase.auth.updateUser({
        data: {
          full_name: [givenName, familyName].filter(Boolean).join(" "),
          given_name: givenName,
          family_name: familyName,
        },
      });
    }
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return;
    throw e;
  }
}

export async function signInWithEmail({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

/**
 * Cria a conta. Se o projeto exigir confirmação de e-mail, o Supabase não
 * devolve sessão: o link do e-mail abre `auth/callback`, que cria a sessão.
 */
export async function signUpWithEmail({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: name.trim() },
      emailRedirectTo:
        Platform.OS === "web" ? window.location.origin : redirectTo,
    },
  });
  if (error) throw error;
  return { needsEmailConfirmation: !data.session };
}

export async function signOut() {
  // Antes de encerrar a sessão: depois disso o app não tem mais permissão para remover o token.
  await unregisterPushAsync();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

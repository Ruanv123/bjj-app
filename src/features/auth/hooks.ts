import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

import {
  signInWithAppleNative,
  signInWithEmail,
  signInWithOAuth,
  signOut,
  signUpWithEmail,
} from "./api";
import { useAuth } from "./auth-provider";

export type AuthProvider = "google" | "apple";

/** O login nativo da Apple só existe no iOS (e nem todo dispositivo suporta). */
export function useNativeAppleAvailable() {
  const { data } = useQuery({
    queryKey: ["auth", "apple-native-available"],
    queryFn: () =>
      Platform.OS === "ios" ? AppleAuthentication.isAvailableAsync() : false,
    staleTime: Infinity,
  });
  return data ?? false;
}

export function useSignIn() {
  const nativeAppleAvailable = useNativeAppleAvailable();

  return useMutation({
    mutationFn: (provider: AuthProvider) =>
      provider === "apple" && nativeAppleAvailable
        ? signInWithAppleNative()
        : signInWithOAuth(provider),
  });
}

export function useEmailSignIn() {
  return useMutation({ mutationFn: signInWithEmail });
}

export function useEmailSignUp() {
  return useMutation({ mutationFn: signUpWithEmail });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const { isDevSkip, setDevSkip } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (isDevSkip) {
        setDevSkip(false);
        return;
      }
      await signOut();
    },
    // Dados do usuário anterior não podem vazar para a próxima sessão.
    onSuccess: () => queryClient.clear(),
  });
}

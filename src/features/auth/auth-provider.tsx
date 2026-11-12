import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { Sentry, setSentryUser } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  isLoading: boolean;
  /** Só em desenvolvimento: entrou pelo botão "Pular login", sem sessão real. */
  isDevSkip: boolean;
  /** Só em desenvolvimento. Em produção não faz nada. */
  setDevSkip: (skip: boolean) => void;
};

const AuthContext = createContext<AuthState>({
  session: null,
  isLoading: true,
  isDevSkip: false,
  setDevSkip: () => {},
});

/**
 * Única fonte da verdade da sessão. O useEffect aqui é legítimo: ele
 * sincroniza o React com um sistema externo (o cliente de auth do Supabase).
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState({ session: null as Session | null, isLoading: true });
  const [devSkip, setDevSkip] = useState(false);

  useEffect(() => {
    // INITIAL_SESSION é emitido assim que a sessão salva é carregada.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Rastro para investigar logouts inesperados (ex.: refresh token revogado).
      if (event === 'SIGNED_OUT') {
        Sentry.addBreadcrumb({ category: 'auth', message: 'SIGNED_OUT', level: 'warning' });
        if (__DEV__) console.warn('[auth] sessão encerrada (SIGNED_OUT)');
      }
      setState({ session, isLoading: false });
      setSentryUser(session ? { id: session.user.id } : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext
      value={{
        ...state,
        isDevSkip: __DEV__ && devSkip,
        setDevSkip: (skip) => {
          if (__DEV__) setDevSkip(skip);
        },
      }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  return use(AuthContext);
}

export function useUser() {
  return use(AuthContext).session?.user ?? null;
}

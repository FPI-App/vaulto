import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import * as Linking from 'expo-linking';
import { parseAuthCallback } from './parseAuthCallback';

interface AuthContextType {
  session: Session | null;
  initializing: boolean;
  authCallbackError: string | null;
  isRecoveringPassword: boolean;
  signInWithPassword: (e: string, p: string) => Promise<void>;
  signUpWithPassword: (e: string, p: string) => Promise<void>;
  resetPassword: (e: string) => Promise<void>;
  completePasswordRecovery: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authCallbackError, setAuthCallbackError] = useState<string | null>(null);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const processingAuthCallback = React.useRef(false);
  const handledAuthCallback = React.useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') setIsRecoveringPassword(true);
    });

    const processAuthUrl = (url: string) => {
      const callback = parseAuthCallback(url);
      if (!callback || processingAuthCallback.current || handledAuthCallback.current) return Promise.resolve();

      processingAuthCallback.current = true;
      return (async () => {
        try {
          if (callback.type === 'error') {
            setAuthCallbackError('El enlace venció o ya fue utilizado. Solicita uno nuevo e inténtalo otra vez.');
            return;
          }

          if (callback.type === 'code') {
            const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
            if (error) throw error;
            if (callback.isRecovery) setIsRecoveringPassword(true);
            setAuthCallbackError(null);
            handledAuthCallback.current = true;
            return;
          }

          if (callback.type === 'otp') {
            const { error } = await supabase.auth.verifyOtp({
              token_hash: callback.tokenHash,
              type: callback.otpType,
            });
            if (error) throw error;
            if (callback.otpType === 'recovery') setIsRecoveringPassword(true);
            setAuthCallbackError(null);
            handledAuthCallback.current = true;
            return;
          }

          const { error } = await supabase.auth.setSession({
            access_token: callback.accessToken,
            refresh_token: callback.refreshToken,
          });
          if (error) throw error;
          if (callback.isRecovery) setIsRecoveringPassword(true);
          setAuthCallbackError(null);
          handledAuthCallback.current = true;
        } catch {
          setAuthCallbackError('No pudimos confirmar el correo. Solicita un enlace nuevo e inténtalo otra vez.');
        } finally {
          processingAuthCallback.current = false;
        }
      })();
    };

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void processAuthUrl(url);
    });

    const initialize = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await processAuthUrl(initialUrl);

        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch {
        setSession(null);
      } finally {
        setInitializing(false);
      }
    };

    void initialize();

    return () => {
      subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  const value: AuthContextType = {
    session,
    initializing,
    authCallbackError,
    isRecoveringPassword,
    signInWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signUpWithPassword: async (email, password) => {
      handledAuthCallback.current = false;
      setAuthCallbackError(null);
      setIsRecoveringPassword(false);
      const redirectUrl = Linking.createURL('auth/callback');
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        }
      });
      if (error) throw error;
    },
    resetPassword: async (email) => {
      handledAuthCallback.current = false;
      setAuthCallbackError(null);
      setIsRecoveringPassword(false);
      const redirectUrl = Linking.createURL('auth/callback');
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
      if (error) throw error;
    },
    completePasswordRecovery: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setIsRecoveringPassword(false);
      setAuthCallbackError(null);
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setIsRecoveringPassword(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

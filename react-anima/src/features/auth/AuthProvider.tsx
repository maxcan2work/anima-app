import { createContext, useContext, type ReactNode } from 'react';
import { connectShikimori, loginWithDiscord, type CurrentUser, type ServerWatchEntry } from '../../api';
import type { AnimeTitle } from '../../data';
import { useAuthSession } from '../../hooks/useAuthSession';
import type { WatchState } from '../../shared/storage';

type AuthStatus = 'loading' | 'guest' | 'ready';

type AuthContextValue = {
  user: CurrentUser | null;
  authStatus: AuthStatus;
  diaryEntries: ServerWatchEntry[];
  setDiaryEntries: (updater: (entries: ServerWatchEntry[]) => ServerWatchEntry[]) => void;
  login: () => void;
  logout: () => Promise<void>;
  connectShikimori: () => void;
  disconnectShikimori: () => Promise<void>;
  importShikimoriList: () => Promise<{
    imported: number;
    updated: number;
    skipped: number;
    total: number;
    errors?: Array<{ shikimoriId: number | null; reason: string }>;
  }>;
};

type AuthProviderProps = {
  children: ReactNode;
  setWatchState: (value: Record<string, WatchState> | ((current: Record<string, WatchState>) => Record<string, WatchState>)) => void;
  setLibrary: (value: AnimeTitle[] | ((current: AnimeTitle[]) => AnimeTitle[])) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, setWatchState, setLibrary }: AuthProviderProps) {
  const {
    user,
    authStatus,
    diaryEntries,
    setDiaryEntries,
    handleLogout,
    handleDisconnectShikimori,
    handleImportShikimoriList,
  } = useAuthSession({
    setWatchState,
    setLibrary,
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        authStatus,
        diaryEntries,
        setDiaryEntries,
        login: loginWithDiscord,
        logout: handleLogout,
        connectShikimori,
        disconnectShikimori: handleDisconnectShikimori,
        importShikimoriList: handleImportShikimoriList,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

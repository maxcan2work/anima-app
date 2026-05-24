import { createContext, useContext, type ReactNode } from 'react';
import { connectShikimori, loginWithDiscord, type CurrentUser, type ServerWatchEntry } from '../../api';
import { useAuthSession } from '../../hooks/useAuthSession';

type AuthStatus = 'loading' | 'guest' | 'ready';

type AuthContextValue = {
  user: CurrentUser | null;
  authStatus: AuthStatus;
  diaryEntries: ServerWatchEntry[];
  libraryRefreshKey: number;
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

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user,
    authStatus,
    diaryEntries,
    libraryRefreshKey,
    setDiaryEntries,
    handleLogout,
    handleDisconnectShikimori,
    handleImportShikimoriList,
  } = useAuthSession();

  return (
    <AuthContext.Provider
      value={{
        user,
        authStatus,
        diaryEntries,
        libraryRefreshKey,
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

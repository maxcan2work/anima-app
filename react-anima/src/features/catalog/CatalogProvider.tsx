import { createContext, useContext, type ReactNode } from 'react';
import { type CatalogSearchResult } from '../../api';
import { useCatalogBrowse } from '../../hooks/useCatalogBrowse';

type CatalogContextValue = {
  browseResults: CatalogSearchResult[];
  browsePage: number;
  browseHasNext: boolean;
  browseLoading: boolean;
  browseStatus: string;
  searchQuery: string;
  searchResults: CatalogSearchResult[];
  searchLoading: boolean;
  searchStatus: string;
  setBrowsePage: (page: number) => void;
  setSearchQuery: (query: string) => void;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const {
    browseResults,
    browsePage,
    browseHasNext,
    browseLoading,
    browseStatus,
    catalogSearchQuery,
    catalogSearchResults,
    catalogSearchLoading,
    catalogSearchStatus,
    setBrowsePage,
    setCatalogSearchQuery,
  } = useCatalogBrowse();

  return (
    <CatalogContext.Provider
      value={{
        browseResults,
        browsePage,
        browseHasNext,
        browseLoading,
        browseStatus,
        searchQuery: catalogSearchQuery,
        searchResults: catalogSearchResults,
        searchLoading: catalogSearchLoading,
        searchStatus: catalogSearchStatus,
        setBrowsePage,
        setSearchQuery: setCatalogSearchQuery,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used inside CatalogProvider');
  }
  return context;
}

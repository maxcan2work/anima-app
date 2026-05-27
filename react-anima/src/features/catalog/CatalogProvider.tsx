import { createContext, useContext, type ReactNode } from 'react';
import { type CatalogSearchResult } from '@/api';
import { type CatalogBrowseFilters, type CatalogBrowseOrder, useCatalogBrowse } from '@hooks/useCatalogBrowse';

type CatalogContextValue = {
  browseResults: CatalogSearchResult[];
  browseOrder: CatalogBrowseOrder;
  browseFilters: CatalogBrowseFilters;
  browsePage: number;
  browseHasNext: boolean;
  browseLoading: boolean;
  browseStatus: string;
  searchQuery: string;
  searchResults: CatalogSearchResult[];
  searchLoading: boolean;
  searchStatus: string;
  setBrowsePage: (page: number) => void;
  setBrowseOrder: (order: CatalogBrowseOrder) => void;
  setBrowseFilters: (filters: CatalogBrowseFilters) => void;
  setSearchQuery: (query: string) => void;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const {
    browseResults,
    browseOrder,
    browseFilters,
    browsePage,
    browseHasNext,
    browseLoading,
    browseStatus,
    catalogSearchQuery,
    catalogSearchResults,
    catalogSearchLoading,
    catalogSearchStatus,
    setBrowsePage,
    setBrowseOrder,
    setBrowseFilters,
    setCatalogSearchQuery,
  } = useCatalogBrowse();

  return (
    <CatalogContext.Provider
      value={{
        browseResults,
        browseOrder,
        browseFilters,
        browsePage,
        browseHasNext,
        browseLoading,
        browseStatus,
        searchQuery: catalogSearchQuery,
        searchResults: catalogSearchResults,
        searchLoading: catalogSearchLoading,
        searchStatus: catalogSearchStatus,
        setBrowsePage,
        setBrowseOrder,
        setBrowseFilters,
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

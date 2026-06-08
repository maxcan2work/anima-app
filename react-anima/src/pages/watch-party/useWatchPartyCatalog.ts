import { useCatalogBrowse } from '@hooks/useCatalogBrowse';
import { importCatalogAnime, type CatalogSearchResult, type ServerAnime } from '@/api';

type UseWatchPartyCatalogOptions = {
  code: string;
  enabled: boolean;
  selectedAnime: unknown;
  onSelectAnime: (anime: ServerAnime) => void;
};

export function useWatchPartyCatalog({
  code,
  enabled,
  selectedAnime,
  onSelectAnime,
}: UseWatchPartyCatalogOptions) {
  const catalog = useCatalogBrowse({
    enabled: Boolean(code && enabled && !selectedAnime),
    requestOptions: { playableProvider: 'anilibria' },
  });

  async function handleSelectAnime(result: CatalogSearchResult) {
    if (!enabled) return;

    try {
      const response = await importCatalogAnime(result.provider, result.providerId);
      onSelectAnime(response.anime);
      catalog.setCatalogSearchQuery('');
    } catch {
      // CatalogBrowser keeps the selection screen visible so the host can retry.
    }
  }

  return {
    ...catalog,
    handleSelectAnime,
  };
}

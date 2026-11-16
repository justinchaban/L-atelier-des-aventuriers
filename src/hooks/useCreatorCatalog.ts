import { useEffect, useState, useSyncExternalStore } from 'react';
import { createCreatorCatalogLoader } from '../services/creatorCatalogLoader';
import type { CreatorCatalogReaderFactory } from '../services/creatorCatalogLoader';

/** Une instance par créateur monté ; aucun accès au personnage ni à sa sauvegarde. */
export function useCreatorCatalog(factory?: CreatorCatalogReaderFactory) {
  const [loader] = useState(() => createCreatorCatalogLoader(factory));
  const state = useSyncExternalStore(loader.subscribe, loader.getSnapshot, loader.getSnapshot);
  useEffect(() => {
    loader.start();
    return () => loader.stop();
  }, [loader]);
  return { ...state, refresh: loader.refresh };
}

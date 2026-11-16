import type { ComponentProps } from 'react';
import CharacterBuilder from './CharacterBuilder';
import ImportedCreatorCatalog from './ImportedCreatorCatalog';
import type { CreatorCatalogReaderFactory } from '../../services/creatorCatalogLoader';
import { useCreatorCatalog } from '../../hooks/useCreatorCatalog';

/** Frontière App/créateur : la consultation asynchrone ne reçoit aucun onChange. */
export default function CharacterBuilderWorkspace({ catalogReaderFactory, ...props }: ComponentProps<typeof CharacterBuilder> & { catalogReaderFactory?: CreatorCatalogReaderFactory }) {
  const catalog = useCreatorCatalog(catalogReaderFactory);
  return <>
    <CharacterBuilder {...props} />
    <ImportedCreatorCatalog state={catalog} allowedBooks={props.campaign?.allowedBooks ?? ['XSRD']} onRefresh={catalog.refresh} />
  </>;
}

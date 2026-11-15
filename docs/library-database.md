# Socle IndexedDB de bibliothèque (P1.2)

`LibraryDatabase`, dans `src/services/libraryDatabase.ts`, utilise IndexedDB natif.
La base `atelier-aventuriers:library` est en version 1. Les personnages restent
entièrement dans leur service localStorage existant.

## Magasins

| Magasin | Clé primaire unique | Index non uniques |
| --- | --- | --- |
| imports | id | importedAt |
| contents | identity.id | bookId, category, bookCategory, normalizedName, status |
| revisions | [contentId, revisionHash] | contentId |
| dependencies | [ownerId, targetId, relation] | ownerId, targetId, relation |

Les index bookId/category/normalizedName pointent vers les propriétés de `identity`.
La relation appartient à la clé d'une dépendance : deux contenus peuvent avoir
plusieurs relations distinctes sans collision. Aucune modification des modèles P1.1.
Les révisions ne possèdent pas de champ `importIds` : aucun index multiEntry fictif
n'est créé sur les objets imbriqués `origins`. Une recherche inverse par document
nécessitera une projection ou une association à concevoir ultérieurement.

## API

```ts
const library = new LibraryDatabase();
await library.open(); // facultatif : les autres méthodes ouvrent si nécessaire
const document = await library.get('imports', importId);
const classes = await library.getAll('contents', 'bookCategory', ['XPHB', 'class']);
await library.write([
  { store: 'imports', operation: 'add', value: preparedDocument },
  { store: 'contents', operation: 'put', value: preparedContent }
]);
library.close();
await library.open();
```

`add` refuse une clé déjà présente ; `put` remplace explicitement l'enregistrement.
`delete` retire la clé demandée, sans suppression en cascade. Les conflits métier,
les références et les générations restent à traiter dans P1.3. Les empreintes ne
sont pas recalculées dans ce socle ; préparer et vérifier le plan avant l'écriture.

Pour une lecture suivie d'une écriture dans la même transaction :

```ts
await library.runTransaction(['contents'], 'readwrite', context => {
  const store = context.store('contents');
  context.request(store.get(contentId), current => {
    // Comparer ici l'état attendu avant d'enregistrer la mise à jour.
    if (!current) { context.abort(); return; }
    context.request(store.put(preparedReplacement));
  });
});
```

Les callbacks doivent être synchrones. Ne pas lancer de fetch, calcul d'empreinte,
timer ou attente externe dans une transaction. Un callback renvoyant une promesse
est refusé et la transaction est annulée. `context.request` protège aussi les
exceptions dans les callbacks de succès. Ne pas remplacer ces handlers par des
handlers manuels : une exception JavaScript non capturée n'annule pas nécessairement
une transaction native. `write` valide le format des enregistrements ; l'API basse
niveau `store` expose les opérations natives pour les futurs contrôles de P1.3.

La promesse de transaction résout seulement après `complete`. Une exception,
une erreur de requête, un doublon ou `context.abort()` entraîne un rejet après
`abort`, avec rollback des opérations de tous les magasins de la transaction.

## Ouverture, versions et erreurs

- `open` mutualise les tentatives simultanées d'une même instance.
- `close` ferme la connexion et invalide toute ouverture en cours. Les transactions
  déjà lancées peuvent terminer ; les données ne sont pas effacées.
- `versionchange` ferme immédiatement la connexion avant d'avertir l'observateur.
- `blocked` rejette l'ouverture et appelle `onBlocked`. La demande native ne pouvant
  pas être annulée directement, son éventuelle migration tardive est annulée et sa
  connexion tardive fermée. Fermer les autres connexions puis réessayer explicitement.
- Les migrations passent exclusivement par `onupgradeneeded`. Une version future
  ou un schéma incohérent est refusé, sans recréation de la base.

`LibraryDatabaseError.code` distingue `quota`, `open`, `version`, `blocked`,
`transaction`, `invalid-data` et `constraint`. La cause originale est conservée.
Aucun code du service n'appelle `deleteDatabase`.

Les tests utilisent une instance isolée de `IDBFactory` de fake-indexeddb et des
objets fictifs. Ils vérifient la logique transactionnelle en mémoire ; quotas réels,
persistance sur disque et coordination de vrais onglets demandent une validation
navigateur lors du branchement de l'interface. Aucune interface n'est branchée ici.

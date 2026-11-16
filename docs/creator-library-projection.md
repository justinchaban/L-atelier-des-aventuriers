# P2.3 — Projection de bibliothèque pour consultation

Statut : validée par l’utilisateur après 186 tests automatisés, sept vérifications manuelles initiales et cinq vérifications manuelles finales réussies. P2.4 non commencée.

## Fichiers

Créés :
- `src/services/libraryCreatorCatalog.ts` : validation, projection, fusion, autorisation séparée et service asynchrone.
- `tests/library-creator-catalog.test.cjs` : 24 tests (15 initiaux et neuf de durcissement) utilisant uniquement des données fictives, dont la fixture fictive existante.
- `docs/creator-library-projection.md` : architecture et protocole.

Adaptés :
- `src/models/CreatorCatalog.ts` (fichier P2.2 déjà présent, non suivi au début de cette étape) : branche `CreatorLibraryCandidate` et union avec les entrées mécaniques existantes.
- `src/engine/libraryBackup.ts` : export d’un validateur de structure de conversion réutilisant le contrôle existant des payloads.
- `src/services/libraryDatabase.ts` : option `existingOnly`, refusant création et migration lors d’une consultation stricte. Comportement des autres services inchangé.

Les modifications préexistantes de CharacterBuilder, ClassSelector, StartingEquipmentSelector et tsbuildinfo n’ont pas été retouchées.

## Architecture et contrats

`LibraryCreatorCatalogService.inspect()` lit les quatre magasins dans une même transaction readonly via `readLibrarySnapshot`, puis appelle `projectLibraryCreatorCatalog`. `load()` fusionne cette projection avec le catalogue natif via `mergeLibraryCreatorCatalog`. Les erreurs de lecture sont propagées ; elles ne produisent pas un catalogue vide trompeur. `close()` ferme la connexion.

La projection accepte `unknown`, détache chaque enregistrement JSON avant tout await et utilise `validateLibraryRecord`. Les entrées inexploitables sont isolées dans les diagnostics du résultat, sans identité artificielle. L’absence d’un magasin ou des clés persistantes dupliquées provoquent une erreur explicite, car aucune résolution arbitraire ne serait fiable.

Les caches sont contrôlés avec `validateLibraryConversion` avant toute inspection. Ils ne sont jamais exposés comme définitions mécaniques. La validation de provenance par contenu réutilise `validateLibraryBackupData` : documents, empreintes SHA-256, pointeurs, catégories et identité originale canonique. Cette validation locale retire seulement les caches et liens de sa copie de travail ; les liens sont inspectés séparément et les données de l’appelant restent intactes. `diagnoseLibrarySnapshot` ajoute le contrôle du graphe actif, des anciennes révisions et des cycles. Aucun convertisseur n’est exécuté.

Les trois identités restent distinctes : `domainId` facultatif provenant du cache validé, `catalogKey` contextuelle dérivée de l’identité persistante, et `reference.contentId` + `revisionHash` désignant précisément la révision active. La clé reste stable lors d’un changement de révision. Aucune édition, preuve de validation, empreinte d’artefact ou version d’adaptateur n’est inventée.

Le contrat P2.2 ne pouvait pas représenter un import sans conversion : il exigeait domaine, édition et référence de conversion certifiée. L’adaptation ajoute une branche de consultation sans toucher à la branche mécanique, qui conserve ses obligations de validation. Cette branche interdit `ready`, `definition`, `validation` et `rulesProfile` par son type.

La fusion préserve les entrées natives, leur ordre et leurs références. Elle ne déduplique jamais par nom. Les collisions d’identifiants métier signalent les candidats importés en conflit ; les entrées natives conservent exactement leur comportement. L’autorisation `evaluateCreatorCandidateAccess` est indépendante et utilise `isBookAllowed`. Même autorisé, un import reste non sélectionnable.

La lecture par défaut refuse toute création ou migration IndexedDB (`existingOnly`). Une base absente provoque une erreur explicite sans création persistée. Une base vide existante donne zéro candidat. Toute base injectée est désormais contrôlée par `assertExistingOnly` avant ouverture : une instance standard est refusée, même si elle est déjà ouverte. Les services P1 gardent leur droit de création. Toutes les transactions de lecture du service restent readonly.

## Disponibilité, priorité décroissante

| État | Critère |
| --- | --- |
| `invalid` | Provenance/empreintes incohérentes, cache ou liens malformés, erreurs relationnelles bloquantes, cycle de copie diagnostiqué. |
| `conflict` | Plusieurs caches convertis concurrents ou collision de domaine détectée à la fusion. Une invalidité reste prioritaire. |
| `archived` | Contenu archivé, même si son cache est périmé ou une référence manque. |
| `missing` | Révision active, cible, révision épinglée ou propriétaire actif absent ; dépendance sans révision résolue. |
| `stale` | Cache périmé selon `isLibraryConversionCurrent`, dépendance archivée ou révision utilisée différente de la révision active. |
| `preview-only` | Contenu consultable, y compris sans conversion, avec conversion partielle, unsupported/failed/unresolved ou conversion structurée mais non certifiée. |
| `ready` | Réservé aux entrées mécaniques validées ; impossible pour un candidat P2.3. |

Les problèmes restent tous dans les diagnostics même lorsqu’un autre état est prioritaire. Les détails de conversion sont conservés. `conversionState` distingue absent, converted-unverified, partial, stale et invalid. Une conversion partielle n’est jamais une définition utilisable.

`coherent` indique désormais l’absence d’erreur globale ou locale ; les erreurs locales restent également accessibles dans les candidats. Le rapport d’intégrité complet peut ajouter une erreur globale même si certains candidats restent consultables. Aucun résultat partiellement invalide n’est présenté comme une certification mécanique.

## Couverture et limites

Catégories projetées : class, subclass, classFeature, subclassFeature, species, background, feat, equipment. Les sorts, absents du contrat créateur P2.2, restent hors catalogue avec diagnostic explicite. Les classes propriétaires sont résolues dans le même fournisseur et espace de noms avec nom et source canoniques. Les capacités de sous-classe conservent aussi le contexte de classe et les liens propriétaire ; un nom court sans résolution fiable produit un diagnostic.

Les anciennes révisions sont conservées dans `historicalRevisions` et analysées, sans devenir des candidats supplémentaires. La révision active est utilisée même si elle est plus ancienne que la dernière importée. Les conversions historiques malformées rendent le candidat invalide par prudence. Les diagnostics des cycles `_copy` exposent désormais leurs membres dans `contentIds` : seuls ces membres reçoivent le diagnostic invalidant de cycle, les copies indépendantes restent consultables. Aucun héritage n’est recalculé.

Le domaine reste absent sans cache converti validé ; le JSON original n’est pas interprété comme modèle mécanique. L’édition reste absente, même pour un livre connu. Les sources inconnues restent des sources non référencées, sans compatibilité supposée. Les alias réutilisent la normalisation existante : srd-5.2.1 → XSRD, FRHoF → FRHOF ; PHB, XPHB et XSRD distincts.

Aucun hook, affichage ou accès bibliothèque n’a été ajouté au créateur. Aucune écriture localStorage, modification de personnage, campagne, révision active ou reconversion automatique. Le commit regroupant P2.2 et P2.3 est autorisé par l’utilisateur ; aucun push.

## Vérifications exécutées

- Suite complète : 186 tests réussis (162 existants + 15 P2.3 + 9 de durcissement).
- TypeScript application : `tsc -p tsconfig.app.json --noEmit --incremental false`.
- Build : `vite build --outDir /tmp/atelier-books-vite-check`.
- `git diff --check` et vérification des espaces des nouveaux fichiers.

Les tests P2.3 couvrent bibliothèque vide, conversions présentes/absentes/partielles/périmées/invalides, choix d’une ancienne révision active, archive, références et propriétaires manquants, alias et sources inconnues, collisions natives/importées et entre imports, copies cycliques, isolation des données malformées, restrictions, toutes les catégories projetées et exclusion des sorts, absence de sélection, absence de mutation, transactions readonly, absence de localStorage et absence de création persistée d’une base. Les tests existants vérifient aussi les contrats TypeScript et la parité du catalogue natif et des sélecteurs.

## Protocole de validation utilisateur

1. Relancer la suite complète et les vérifications TypeScript, Vite et diff ; résultat attendu : tous verts.
2. Dans l’interface bibliothèque existante, importer uniquement `tests/fixtures/fictive-classes.json`. Noter les contenus et la révision active ; ne réaliser aucune action de gestion pendant la consultation.
3. Ouvrir puis fermer le créateur plusieurs fois : seules les classes natives restent proposées, avec les mêmes restrictions, progressions et équipements.
4. Comparer les magasins IndexedDB avant/après ces consultations : aucun enregistrement, révision active ou statut modifié. Comparer aussi le stockage des personnages et des campagnes sans enregistrer de modification volontaire.
5. Pour vérifier l’API hors interface, exécuter `tests/library-creator-catalog.test.cjs` : les assertions contrôlent le contenu projeté et les transactions, notamment les cas impossibles à observer dans l’interface P2.3.
6. Refaire la consultation avec bibliothèque vide et avec un contenu fictif archivé par les outils existants : aucune sélection importée ne doit apparaître. L’archivage volontaire appartient à la préparation du scénario, pas à la projection.
7. Valider les règles et limites documentées avant toute demande de P2.4. Les sept vérifications manuelles initiales ont été réalisées et validées par l’utilisateur.


## Durcissement des diagnostics et des frontières de sécurité

Les API conservent leur structure existante. `load()` retourne un `LibraryCreatorCatalog extends CreatorCatalog` avec `diagnostics` globaux/non rattachés et `coherent`. Les diagnostics des candidats restent dans leurs entrées. `inspect()` garde sa structure. Les erreurs globales de forme/ambiguïté rejettent avec `LibraryCreatorProjectionError` (`coherent: false`, diagnostics explicites) ; les erreurs de stockage restent propagées avec leur code. `load()` ne masque plus les erreurs d’une projection partielle.

`CreatorDiagnostic` accepte des champs optionnels `contentId`, `revisionHash`, `path`. Les causes de rejet des caches et des dépendances sont conservées avec ces coordonnées, avant assainissement de la copie de travail. Les diagnostics portant un contenu absent ou une catégorie hors projection restent globaux. Les archives ont un diagnostic explicite. Aucune sévérité d’erreur d’intégrité n’est abaissée. Le choix de l’état conserve la priorité documentée.

`evaluateCreatorCandidateAccess` accepte `unknown` et refuse explicitement la sélection de toute origine library. Une origine absente, illisible ou une copie se déclarant native est également refusée. Seules les entrées originales du manifeste natif partagé sont sélectionnables en P2.3 ; une entrée native reconstruite ou clonée n’est pas une preuve de confiance. Cette restriction ne concerne pas les sélecteurs existants, qui conservent leur fonctionnement P2.2.

La fusion détache les candidats, vérifie leur identité/origine, rejette les candidats non fiables dans les diagnostics globaux et retire les champs mécaniques interdits. Un candidat library forgé avec ready devient invalid. Les objets, références et identifiants natifs restent intacts. Le premier argument de fusion est un catalogue natif contrôlé par l’application, pas une entrée JSON externe.

La consultation refuse une injection standard via `LibraryDatabase.assertExistingOnly()` avant toute ouverture. Aucun changement du droit de création des repositories, sauvegardes ou autres services P1. Le contrôle des dépendances existant conserve exactement ses conditions d’acceptation, avec des messages distinguant désormais ownerId, targetId, relation et revisionHash.

### Tests de durcissement

Neuf nouveaux tests couvrent les quatorze points demandés : propagation inspect/load (diagnostics globaux et locaux, coherent, erreur bloquante), causes précises des caches/liens, orphelins, archive et anomalies cumulées, autorisation publique sur ready forgé/origines absentes/fausses origines natives, neutralisation par fusion, injection standard refusée sans création avec maintien du droit de création P1, isolation des cycles et instantané concurrent.

Le test concurrent déclenche une transaction d’écriture depuis le premier retour de lecture des quatre magasins. L’écriture archive un contenu et supprime sa révision atomiquement ; la lecture doit conserver intégralement l’état précédent. Le scénario est déterministe avec fake-indexeddb et ne dépend d’aucun délai. Les tests existants contrôlent toujours les transactions readonly, l’absence de localStorage, l’export, la restauration atomique et les révisions P1. Aucun test n’écrit dans la bibliothèque réelle.

Limites résiduelles : les tests IndexedDB utilisent un simulateur ; la vérification dans un vrai navigateur reste nécessaire. La validation profonde des payloads reste celle de P1 et ne certifie pas l’exhaustivité mécanique. Le validateur profond peut décrire la première erreur d’un payload, tandis que les anomalies d’enregistrements et de liens distincts sont accumulées. Aucun accès public n’est destiné à résister à une réécriture des fonctions JavaScript de l’application par son appelant.

### Applicabilité des protocoles antérieurs

Aucun composant, flux de création, règle, campagne, stockage de personnage ou révision active n’est modifié par ce correctif. Les vérifications manuelles antérieures restent applicables sans changement fonctionnel. Le document P2.2 distingue désormais les deux vérifications auparavant réunies au point 8 : équipement et absence de sélection importée. Il contient ainsi neuf points, en accord avec les neuf validations confirmées par l’utilisateur. Les sept étapes P2.3 restent applicables. Les neuf vérifications P2.2, sept initiales P2.3 et cinq finales P2.3 ont été confirmées réussies par l’utilisateur ; aucune nouvelle exécution navigateur n’est revendiquée lors de la préparation du commit.

### Protocole manuel ciblé complémentaire

1. Dans un environnement de test avec des données exclusivement fictives, appeler inspect puis load sur une connexion `existingOnly: true` ; vérifier que coherent, diagnostics globaux et diagnostics par candidat sont présents. Sur base saine, coherent doit être true ; une erreur locale/globale doit le rendre false.
2. Sur une copie de test uniquement, préparer une conversion invalide, un lien invalide, une révision orpheline et une archive. Vérifier les messages et coordonnées des causes, le diagnostic d’archive et le maintien simultané des diagnostics, même lorsque invalid est prioritaire. Ne pas préparer ces corruptions dans une bibliothèque de travail.
3. Appeler l’autorisation publique sur un candidat library avec ready, puis sans origine et avec une fausse origine native : selectable doit toujours rester false. Faire passer ces objets par la fusion : aucun champ definition utilisable ne doit apparaître, les entrées natives doivent rester identiques.
4. Sur un profil sans bibliothèque, injecter une LibraryDatabase standard : load doit rejeter avant ouverture, sans création de base. Avec existingOnly sur une base absente, la tentative doit également échouer sans schéma persistant. Sur une base existante, comparer tous les magasins et localStorage avant/après consultation : aucune modification.
5. Rejouer les parcours de création natifs, les restrictions de livres et une sauvegarde/restauration fictive P1. Une source inconnue exige toujours une autorisation explicite ; aucun import ne devient sélectionnable. Les préparations volontaires des scénarios sont distinctes des consultations à contrôler.

P2.2 et P2.3 sont validées par l’utilisateur. Le commit commun est autorisé ; aucun push et aucune P2.4.

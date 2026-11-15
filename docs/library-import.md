# Enregistrement transactionnel des imports (P1.3)

## API sans interface

```ts
const repository = new LibraryRepository();
const plan = await repository.prepareImport({
  text: originalJsonText,
  filename: 'contenus.json', // nom seul, sans chemin local
  provider: '5etools'
});
// Présenter plan.decisions et plan.issues avant confirmation.
const result = await repository.commitImport(plan, {
  acceptedUpdates: explicitlyApprovedContentIds
});
```

Aucune campagne n'est modifiée. Importé ne signifie ni converti, ni disponible,
ni autorisé. Les catégories sans convertisseur sont conservées comme données brutes.
Les identifiants métier des résultats de `classImporter` restent inchangés.

`prepareImport` lit un snapshot cohérent des quatre magasins, puis prépare un plan
immuable en mémoire. Les empreintes et conversions se font hors transaction.
L'entrée moteur `prepareLibraryImport(input, snapshot)` permet les usages sans
repository ; pour confirmer, employer un plan émis par `repository.prepareImport`.
Un plan cloné, désérialisé ou préparé par une autre instance est refusé : recalculer
le plan après une fermeture de page, sans réutiliser les anciens accords.

## Décisions

- `create` : identité nouvelle ; création lors de la confirmation du lot.
- `unchanged` : même identité et même empreinte d'entrée ; aucune nouvelle révision.
- `update` : empreinte différente ; accord explicite obligatoire pour cette identité.
- `conflict` : plusieurs définitions différentes pour la même identité dans le fichier ;
  refus du lot entier, y compris du document original. Corriger le fichier et recalculer.
- `unidentified` : absence de contexte suffisant ou entrée non objet ; diagnostic et
  conservation dans le fichier original, sans création d'identité de remplacement.

Le réimport d'un texte identique conserve un seul document. Un autre nom de fichier
complète sa liste de noms. Un fichier réorganisé crée un document distinct (original
exact différent), mais conserve les mêmes identités et révisions pour les mêmes
entrées. Les origines de ces révisions pointent vers chacun des documents.
Les indices des pointeurs correspondent aux tableaux originaux, y compris en présence
d'éléments non objets : aucun décalage dû au filtrage de l'analyseur.

## Confirmation et concurrence

`commitImport` ne déduit jamais un accord : toutes les décisions `update` doivent
figurer dans `acceptedUpdates`, et les accords étrangers au plan sont refusés.
Les conflits bloquent tout le lot ; les entrées non identifiées sont explicitement
signalées mais n'empêchent pas la conservation du fichier original.

Une transaction `readwrite` couvre les quatre magasins. Elle relit et compare tout
l'état avec le snapshot attendu, puis revérifie les révisions et générations des
contenus concernés avant les écritures. Une modification même non liée invalide
le plan : résultat `concurrent-change`, recalcul et nouveaux accords nécessaires.
Le contrôle global est volontairement conservateur pour cette première version.

Le document, les nouvelles révisions, les origines additionnelles, les conversions
et les dépendances sont enregistrés ensemble. Les anciennes révisions ne sont pas
supprimées. Une réactivation d'une ancienne révision nécessite aussi un accord et
incrémente la génération. Un contenu archivé n'est jamais réactivé implicitement.
Tout échec annule le lot ; `storageCode` conserve le code de `LibraryDatabaseError`.
Le succès n'est renvoyé qu'après `complete` de la transaction.

## Originaux, dépendances et conversions

Deux champs optionnels de `LibraryRevision` sont ajoutés, sans changement de version
IndexedDB : `dependencies` et `conversions`. Les anciennes révisions restent lisibles.
Les entrées originales ne sont pas recopiées dans les révisions : `origins` contient
les pointeurs vers les documents exacts. Le cache de conversion contient uniquement
le résultat dérivé, avec identifiant et version de convertisseur.

Le magasin `dependencies` représente les relations actives `owner`, `feature` et
`copy`. Les anciennes révisions conservent leur propre liste de dépendances.
Les conversions épinglent les révisions utilisées, y compris transitivement, car
une classe convertie incorpore des sous-classes et capacités.

Les entrées actives déjà stockées sont reconstituées à partir des originaux et
combinées aux nouvelles entrées pour l'analyse/conversion existante. Cela permet
la résolution entre fichiers sans modifier les importateurs. Une référence absente
reste enregistrée sans révision cible et la classe n'est pas déclarée convertie
avec succès. Les variantes `_copy` restent limitées aux possibilités de l'importateur.

`isLibraryConversionCurrent` vérifie la version attendue du convertisseur, la
révision active et la disponibilité des dépendances. Un changement de dépendance
invalide le cache ; l'ajout d'une nouvelle sous-classe connue invalide aussi le
cache de sa classe. Cela ne change pas la révision brute de la classe. Repréparer le
fichier de classe peut reconstruire ce cache, même si ses entrées sont inchangées.
Une nouvelle version de convertisseur s'ajoute aux conversions existantes. Le
cache d'une même version peut être recalculé ; ce n'est pas une modification de
l'entrée originale. Aucune reconversion automatique en arrière-plan n'est branchée.

## Limites

Le contrôle global relit et sérialise l'ensemble de la bibliothèque. Il est adapté
au premier socle mais devra évoluer avant de très grandes bibliothèques. Cette
représentation supplémentaire est transitoire, jamais une copie persistante des
fichiers. La comparaison et les conversions se font actuellement sur le fil appelant.
Il n'existe pas encore de suppression, d'export de bibliothèque ou d'interface de
confirmation dans ce repository. Les tests sont entièrement fictifs et utilisent
fake-indexeddb ; une validation navigateur reste à prévoir lors du branchement.

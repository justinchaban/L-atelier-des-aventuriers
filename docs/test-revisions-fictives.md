# Validation manuelle du changement de révision active

## Fichiers fournis

- `tests/fixtures/manual-revisions/contenu-v1.json`
- `tests/fixtures/manual-revisions/contenu-v2.json`

Tout est fictif et original. Les deux fichiers décrivent le même contenu :

- nom : **Sceau des lucioles de papier** ;
- source : **TESTREV** ;
- catégorie : **Dons** (`feat`).

Seule la description change : sceau **bleu / VERSION 1**, puis **doré / VERSION 2**.
Ne pas changer le nom ou la source entre les versions, sinon ce serait un nouveau
contenu, et non une révision du même contenu.

La source TESTREV n'appartient pas au catalogue des livres : son avertissement est
normal. L'état « Non exploitable par le créateur » est également normal, car les
dons importés ne possèdent pas encore de convertisseur autonome. Ces deux points
n'empêchent ni l'import confirmé, ni l'historique, ni l'activation d'une révision.

Utiliser de préférence un profil navigateur de test où ce nom et cette source
n'ont pas encore été importés. Ne supprimer aucune donnée existante pour ce test.
Si le contenu existe déjà, conserver ces fichiers et utiliser un autre profil pour
retrouver exactement les compteurs de premier import ci-dessous.

## 1. Importer la première version

1. Ouvrir l'application puis l'espace **Bibliothèque**.
2. Dans **Analyser des données JSON**, cliquer **Choisir un fichier JSON**.
   Ne pas utiliser **Restaurer une sauvegarde** : ces fichiers sont des imports,
   pas des sauvegardes complètes de bibliothèque.
3. Choisir `contenu-v1.json`.
4. Attendre le plan : **1 nouveau, 0 identique, 0 modifié, 0 conflit**.
5. Cliquer **Enregistrer dans la bibliothèque**, puis attendre le bilan de réussite.
6. Dans **Bibliothèque enregistrée**, rechercher `Sceau des lucioles de papier`.
   Au besoin choisir catégorie **Dons**, livre **TESTREV**, statut **Actifs** et
   tous les états de conversion.
7. Cliquer sur le contenu. Sa description doit commencer par **VERSION 1** et
   mentionner un sceau **bleu**. L'historique contient une seule révision active.

## 2. Réimporter la deuxième version

Le fichier V2 fourni est la copie déjà modifiée de V1 : il n'est pas nécessaire
de l'éditer à la main.

1. Dans le panneau d'analyse, choisir `contenu-v2.json`.
2. Attendre le plan : **0 nouveau, 0 identique, 1 modifié, 0 conflit**.
3. Vérifier que le bouton d'enregistrement est désactivé avant l'accord.
4. Cocher **J'autorise la mise à jour de Sceau des lucioles de papier (TESTREV)**.
5. Cliquer **Enregistrer dans la bibliothèque** et attendre le bilan.
6. Revenir à la fiche dans la bibliothèque enregistrée : la description active
   indique maintenant **VERSION 2**, sceau **doré**.

## 3. Identifier les deux révisions

Dans **Historique des révisions**, deux lignes doivent être présentes :

| Version | Début de l'empreinte | Description attendue |
| --- | --- | --- |
| V1 | `sha256:v1:2565cd4b` | VERSION 1, sceau bleu |
| V2 | `sha256:v1:0a3f16d1` | VERSION 2, sceau doré |

Cliquer sur chaque ligne pour lire ses détails. V2 doit être marquée **Révision
active**, V1 **Révision historique**. Se fier aux descriptions et empreintes plutôt
qu'à la position dans la liste : les dates peuvent être très proches.

## 4. Activer V1 avec confirmation

1. Cliquer sur la ligne de V1 (empreinte commençant par `2565cd4b`).
2. Dans ses détails, cliquer **Activer cette révision**.
3. Examiner la confirmation et les avertissements. Ce contenu n'a pas de
   dépendances déclarées et aucun autre contenu de ce test n'en dépend.
4. Avant de cocher, vérifier que **Confirmer l'opération** est désactivé : V2 doit
   rester active tant que l'opération n'est pas confirmée.
5. Cocher **Je confirme cette opération et ses effets potentiels sur les dépendances**.
6. Cliquer **Confirmer l'opération**, puis attendre le message :
   **Révision active modifiée. Toutes les révisions sont conservées.**

## 5. Vérifier le changement sans perte

- La **Description originale** principale de la fiche indique **VERSION 1**, bleu.
- Dans l'historique, V1 est **active** et V2 reste présente comme **historique**.
- Cliquer sur V2 : sa description dorée reste consultable.
- Dans **Révision active et données enregistrées**, l'empreinte active est celle de V1.
- La génération a augmenté ; le contenu est toujours Actif et non archivé.

## 6. Vérifier la persistance

1. Actualiser la page.
2. Retourner dans Bibliothèque puis rechercher le contenu.
3. Vérifier à nouveau la description VERSION 1 et les deux révisions, V1 active.
4. Facultatif : fermer puis rouvrir le navigateur avec le même profil, la même
   adresse et le même port, puis refaire la vérification.

## 7. Exporter avec V1 active

1. Cliquer **Exporter ma bibliothèque** et attendre le téléchargement.
2. Renommer localement le téléchargement en `bibliotheque-test-active-v1.json`
   pour le distinguer du second export, sans modifier son contenu.
3. Ouvrir le fichier en lecture dans un éditeur. La sauvegarde contient toute la
   bibliothèque ; ses compteurs peuvent être supérieurs à ceux de ce seul test.
4. Dans `data.contents`, repérer l'identité dont `normalizedName` vaut
   `sceau des lucioles de papier` et `bookId` vaut `TESTREV`.
5. Noter son `identity.id`. Son champ `activeRevision` doit être :

   ```text
   sha256:v1:2565cd4b2b22c260f6e1198fcffacbd1dc3547bb58c74a9ba56f827ca675c786
   ```

6. Dans `data.revisions`, retrouver les deux objets dont `contentId` correspond
   à cet `identity.id`. Les deux `revisionHash` doivent être ceux de V1 et V2.
7. Dans `data.imports`, retrouver les deux fichiers originaux, avec leurs textes
   exacts, via `filenames` : `contenu-v1.json` et `contenu-v2.json`.

Le marqueur actif n'est pas un booléen dans chaque révision : c'est le champ
`activeRevision` du contenu qui désigne la révision active.

## 8. Réactiver V2 et vérifier un second export

1. Dans l'interface, ouvrir l'historique et choisir V2 (`0a3f16d1`).
2. Cliquer **Activer cette révision**, cocher la confirmation puis confirmer.
3. Vérifier VERSION 2 / doré dans la fiche, V2 active et V1 encore consultable.
4. Actualiser la page puis vérifier que V2 reste active.
5. Exporter à nouveau et renommer le fichier `bibliotheque-test-active-v2.json`.
6. Pour le même contenu dans `data.contents`, `activeRevision` doit maintenant être :

   ```text
   sha256:v1:0a3f16d120e9dfb745f6912d60e3bb3ff125d0280c3a232d6866543587ce0c8f
   ```

7. Les deux objets de `data.revisions` et les deux originaux doivent toujours
   exister. Les dates d'export et les empreintes globales des sauvegardes changent,
   ce qui est normal.

## Vérification facultative par restauration, entièrement depuis l'interface

Dans un second profil de test avec bibliothèque vide, restaurer
`bibliotheque-test-active-v1.json` via **Restaurer une sauvegarde**, examiner la
prévisualisation, cocher puis confirmer. Retrouver V1 active et V2 historique.

Pour tester la sauvegarde V2, utiliser un autre profil vide : la restauration dans
une bibliothèque remplie reste volontairement interdite. Ne pas effacer ses données
pour contourner cette protection.

## Vérifications déjà effectuées

Les fichiers fournis ont été exercés avec les services existants et fake-indexeddb :
premier import, mise à jour acceptée, historique de deux révisions, activation de V1,
fermeture/réouverture, export avec V1 active, restauration de cet export, réactivation
de V2 et second export. Les deux révisions et les originaux exacts sont conservés.
Cela valide les fichiers et le parcours de services ; les manipulations navigateur
restent à effectuer manuellement. Aucun code applicatif n'a été modifié.

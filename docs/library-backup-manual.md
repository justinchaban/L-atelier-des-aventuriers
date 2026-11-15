# P1.5a — Export et restauration de bibliothèque

## Format et garanties

La sauvegarde JSON porte le format `atelier-aventuriers:library-backup`, version 1.
Elle contient la date d'export, les versions de schéma/enregistrements/identités,
les quatre magasins et une empreinte SHA-256. Le condensat porte sur la sérialisation
canonique de tout le corps (métadonnées comprises), hors du champ `integrity` lui-même.
Il détecte une altération accidentelle ; ce n'est pas une signature d'authenticité.

Les collections des magasins sont triées pour que leur ordre de lecture IndexedDB
n'influence pas l'export. Les tableaux internes sont conservés, ainsi que les textes
exacts des fichiers originaux. À date d'export identique, le fichier et son empreinte
sont déterministes. Deux exports effectués à des dates différentes ont naturellement
des métadonnées et empreintes différentes.

Avant restauration : contrôle de format et versions, schéma des enregistrements,
unicité des clés, empreinte globale, empreintes des originaux et de toutes les
révisions, provenance et JSON Pointers, correspondance des identités, révisions
actives, dépendances et structure des conversions. Les métadonnées supplémentaires
JSON sont conservées. Les anciennes versions de convertisseurs restent sauvegardées ;
elles peuvent nécessiter une reconversion selon l'état affiché par la consultation.
Les références non résolues sans empreinte cible sont légitimes et conservées.

Le service ne restaure que dans une destination où les quatre magasins sont vides.
Ce contrôle est répété dans la transaction readwrite, après confirmation. Aucun
clear/deleteDatabase ni remplacement en cascade. La fusion et le remplacement sont
explicitement désactivés. Toute erreur annule le lot ; les données existantes restent
inchangées. Les personnages et campagnes ne font pas partie de cette sauvegarde.

Le format n'ajoute aucun magasin ni changement de version à IndexedDB. Les validations
de format P1.2 et le constructeur d'identité depuis l'original P1.3 sont simplement
exportés pour être réutilisés par le validateur de sauvegarde.

## Protocole navigateur

Utiliser deux profils de test réellement distincts, A et B, ou deux navigateurs.
Deux onglets d'un même profil partagent la base ; plusieurs fenêtres privées peuvent
aussi partager le même stockage. Ne supprimer aucune donnée personnelle pour ce test.
Utiliser la même URL Vite dans les deux profils et conserver le port.

### 1. Bibliothèque vide

1. Dans le profil B vierge, ouvrir Bibliothèque.
2. Cliquer **Exporter ma bibliothèque**. Attendre le message puis vérifier le fichier
   téléchargé `atelier-bibliotheque-sauvegarde.json`.
3. Il doit contenir les quatre tableaux vides, les versions, la date et l'intégrité.
4. Sélectionner ce fichier avec **Restaurer une sauvegarde**. Vérifier la prévisualisation
   vide. Aucune restauration n'est effectuée à la sélection.
5. La confirmation reste désactivée tant que la case n'est pas cochée. Cocher puis
   confirmer : bilan de zéro enregistrement, aucune erreur. La bibliothèque reste vide.

### 2. Export complet de données fictives

1. Dans A, importer depuis l'interface `tests/fixtures/fictive-classes.json` puis confirmer.
2. Facultatif : créer une modification fictive via le protocole P1.4b pour disposer de
   plusieurs révisions d'un contenu.
3. Cliquer **Exporter ma bibliothèque**. Aucun contenu ni état de campagne ne doit changer.
4. Vérifier que le téléchargement a été autorisé par le navigateur. Le message signifie
   que le téléchargement a été demandé, pas qu'un fichier a été confirmé sur le disque.

### 3. Restauration dans l'autre profil

1. Dans B, choisir la sauvegarde exportée depuis A.
2. Vérifier date, versions, SHA-256 vérifié, compteurs, livres et liste des contenus.
3. La fusion et le remplacement doivent être désactivés et expliqués.
4. Sans cocher la case, vérifier que le bouton de confirmation reste désactivé et que
   la consultation est toujours vide.
5. Cocher puis confirmer. Les commandes doivent être bloquées pendant l'écriture et
   le bilan ne doit apparaître qu'à la fin de la transaction.
6. La consultation s'actualise automatiquement et retrouve les contenus de A.
7. Vérifier notamment la source originale FRHoF, le livre canonique FRHOF, les descriptions,
   les révisions actives et les données de dépendances dans les détails.
8. Actualiser puis fermer/rouvrir B : les données restent présentes.
9. Exporter à nouveau depuis B. Les dates d'export diffèrent, mais les quatre magasins
   doivent être identiques à ceux de A (à l'ordre de leurs collections près).

### 4. Destination non vide

1. Dans B maintenant rempli, sélectionner encore la sauvegarde.
2. La prévisualisation doit signaler la destination non vide. La case et la confirmation
   sont désactivées. Fusion et remplacement restent indisponibles.
3. Vérifier que les données de B ne changent pas. Aucun effacement n'est proposé.

### 5. Fichier altéré ou incompatible

Faire les manipulations sur des copies de la sauvegarde, hors du dépôt :

- Modifier un nom dans `data.contents` sans modifier l'intégrité : la vérification
  SHA-256 doit échouer avant toute écriture.
- Changer `formatVersion` à 999 : erreur de compatibilité explicite.
- Sélectionner un JSON ordinaire d'import D&D : il doit être refusé comme sauvegarde.
- Couper le fichier JSON : erreur de lecture/format, aucune donnée ajoutée.

Dans tous les cas, la base existante doit rester intacte et une nouvelle sélection
valide doit rester possible.

### 6. Concurrence entre onglets

Dans un troisième profil de test vide C :

1. Ouvrir deux onglets. Dans le premier, prévisualiser la sauvegarde et cocher la case.
2. Dans le second, enregistrer un contenu fictif via le panneau d'import.
3. Revenir au premier et confirmer la restauration.
4. Le contrôle transactionnel doit refuser la restauration car la destination n'est
   plus vide. Le contenu du second onglet doit rester seul présent.

Les erreurs tardives, quotas simulés et rollback des quatre magasins sont couverts
par fake-indexeddb. Ne pas remplir le disque pour reproduire un quota réel.

## Limites et résultats à relever

Noter profils/navigateurs, versions, URL, compteurs avant/après et erreurs console.
Ce protocole n'a pas été exécuté par les tests Node. Le navigateur doit encore
valider les téléchargements, les interactions React et la persistance réelle.
L'export et la validation chargent toute la bibliothèque en mémoire ; les très gros
volumes devront être profilés avant d'ajouter streaming ou workers. Aucun envoi
réseau, purge, fusion ni remplacement automatique n'est effectué.

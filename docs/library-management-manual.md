# P1.5b — Archivage, restauration et révisions

## Garanties du service

`LibraryManagementService.prepare` est en lecture seule. Il vérifie l'intégrité de
la bibliothèque et prépare un plan immuable, avec état attendu et impacts possibles.
`confirm(plan, { confirmed: true })` relit les quatre magasins dans une transaction
readwrite. Toute modification depuis la préparation, même non liée, refuse le plan.
Le succès est renvoyé uniquement après complete. Une erreur entraîne le rollback.

Archivage/restauration changent uniquement statut, génération monotone et updatedAt.
Le changement de révision active change aussi activeRevision et remplace la projection
des dépendances actives de ce contenu par le snapshot conservé dans la révision choisie.
Les originaux, toutes les révisions et leurs conversions/dépendances historiques ne
sont jamais réécrits. Les autres contenus ne sont ni modifiés ni reconvertis.

Les impacts signalent les liens directs/transitifs du graphe et des caches actifs.
Ce sont des avertissements conservateurs : un lien ne signifie pas nécessairement
qu'une description devient inutilisable. Les dépendances manquantes, archivées,
non résolues ou sur une autre révision sont distinguées.

Les révisions anciennes sans champ dependencies restent consultables. Leur activation
est refusée pour ne pas inventer un graphe historique. Les contenus archivés peuvent
changer de révision sans être restaurés implicitement. Une réactivation d'un contenu
ne répare pas les caches et ne change pas les autorisations des campagnes.

Aucun nouveau magasin, changement de schéma ou dépendance npm. Le helper de lecture
transactionnelle P1.3 est exposé pour éviter de dupliquer les quatre lectures.
La consultation filtre les contenus actifs par défaut ; Actifs, Archivés et Tous les
statuts restent disponibles. L'historique indique quelle révision est réellement active.

## Préparation du test navigateur

Utiliser un profil navigateur de test et le serveur Vite habituel (`npm run dev`).
Importer puis confirmer `tests/fixtures/fictive-classes.json`, entièrement fictif.
Exporter une sauvegarde de départ si le profil contient déjà des données utiles.
Ne pas effacer une base réelle pour ces tests.

## 1. Archiver et retrouver un contenu

1. Dans Bibliothèque, filtrer catégorie Classes et livre PHB, puis sélectionner
   Veilleur de papier. Le statut par défaut doit être Actifs.
2. Cliquer Archiver : une confirmation s'affiche, avec avertissements, contenus
   dépendants et état des dépendances. Aucun changement avant confirmation.
3. Cliquer Annuler : la fiche et la base doivent rester inchangées.
4. Préparer à nouveau, cocher l'accord puis confirmer. Attendre le bilan de succès.
5. Le contenu disparaît de la liste active. Sa fiche sélectionnée peut rester
   visible et indiquer Archivé ; l'action Restaurer remplace Archiver.
6. Choisir le filtre Archivés puis Tous les statuts : le contenu est retrouvable.
7. Dans les outils IndexedDB, vérifier que imports et revisions sont inchangés,
   que le contenu n'a pas été supprimé et que sa génération a augmenté de 1.

## 2. Restaurer le contenu

1. Dans sa fiche archivée, cliquer Restaurer, examiner les impacts, cocher puis confirmer.
2. Le statut redevient Actif. Revenir au filtre Actifs pour le retrouver dans la liste.
3. Vérifier que la génération augmente encore, mais que les originaux, révisions,
   conversions et dépendances n'ont pas été supprimés ou recalculés.
4. Actualiser puis fermer/rouvrir le navigateur : le statut et l'historique persistent.

## 3. Dépendances affectées

1. Filtrer Capacités de classe et livre PHB ; sélectionner Pli inaugural.
2. Préparer Archiver : les contenus dépendants doivent être nommés avec leur livre.
3. Confirmer. La classe PHB peut apparaître À reconvertir car sa dépendance est archivée.
4. Vérifier qu'aucune révision ni génération des contenus dépendants n'a été modifiée.
5. Restaurer la capacité : la validité d'un cache existant peut être retrouvée sans
   reconversion automatique si toutes ses dépendances correspondent encore.

Les dépendances absentes sont aussi couvertes automatiquement avec une fixture
contenant seulement les classes et leurs références non résolues.

## 4. Historique et activation d'une ancienne révision

1. Copier le fichier fictif vers un fichier de test hors dépôt, par exemple dans
   Téléchargements. Dans la première classe (source PHB), remplacer uniquement
   classFeatures par un tableau vide. Conserver le reste du JSON.
2. Importer cette variante : une modification et six contenus identiques doivent
   être proposés. Accepter explicitement la modification puis enregistrer.
3. Revenir à Classes / PHB / Veilleur de papier. L'historique doit contenir deux
   révisions, dont une clairement active.
4. Sélectionner chacune : vérifier la description, la provenance et les JSON de
   sa révision, ainsi que les conversions et dépendances historiques.
5. Sur la révision ancienne, cliquer Activer cette révision. Vérifier l'empreinte
   choisie et les avertissements. Annuler une première fois : aucun changement.
6. Préparer à nouveau, cocher puis confirmer. L'ancienne révision devient active,
   sans supprimer la plus récente. La génération augmente.
7. Vérifier que la projection dependencies correspond à la révision réactivée,
   tandis que chaque snapshot de révision et chaque original restent inchangés.
8. Répéter sur un contenu archivé : le changement de révision ne doit pas changer
   son statut Archivé.

## 5. Deux onglets et plan obsolète

1. Dans l'onglet A, préparer une action puis cocher l'accord, sans confirmer.
2. Dans B, archiver/restaurer un autre contenu ou confirmer un import fictif.
3. Revenir dans A et confirmer l'ancien plan.
4. Attendu : refus explicite, aucun changement partiel, accord effacé. Le bouton
   Préparer à nouveau l'opération permet de recalculer les impacts.
5. Repréparer puis renouveler l'accord pour agir sur l'état récent.
6. Tester aussi deux archivages simultanés du même contenu : un seul doit réussir.

Le panneau conserve la confirmation pendant un rafraîchissement de consultation,
mais bloque ses commandes durant la lecture. Le service reste l'autorité pour refuser
un plan devenu obsolète, même si les données affichées ont été actualisées.

## 6. Compatibilité avec les sauvegardes

1. Après archivage et activation historique, exporter la bibliothèque.
2. Restaurer dans un autre profil de test vide, selon le protocole P1.5a.
3. Retrouver les statuts, la révision active choisie, toutes les révisions et les
   originaux exacts. Le filtre Actifs masque les archives par défaut dans ce profil.

## 7. Erreurs et absence de suppression

Les tests fake-indexeddb injectent une erreur après la mise à jour du contenu et
pendant la projection des dépendances : tout revient à l'état précédent.
Ne pas remplir volontairement le disque pour simuler un quota réel. Aucun bouton
de suppression définitive ni réinitialisation de base ne doit apparaître.
Une erreur doit conserver l'analyse/historique consultable et proposer de préparer
ou consulter à nouveau, sans réparer automatiquement les données.

## Limites et compte rendu

Noter navigateur/version, origine, résultats et erreurs console. Ce protocole est
fourni mais n'est pas exécuté par les tests Node. Ils vérifient le service et le rendu
initial React, pas les interactions complètes d'un navigateur.
Les contrôles relisent et valident toute la bibliothèque et les avertissements
peuvent inclure des dépendants indirects. Une optimisation pour gros volumes reste
à prévoir. Le créateur, les campagnes et les personnages ne sont pas modifiés.

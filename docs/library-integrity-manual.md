# P1.5c — Diagnostics et suppression définitive sécurisée

## Périmètre et garanties

Les diagnostics sont en lecture seule. Ils vérifient structures, originaux, empreintes,
révisions actives et épinglées, graphe actif et dépendances historiques/conversions.
Les erreurs d'intégrité bloquent la suppression. Une cible non résolue sans empreinte
épinglée est un avertissement ; un propriétaire ou une révision épinglée manquants
sont des erreurs. Les cycles propriétaire/capacité cohérents sont informatifs.
Un cycle actif d'héritage `_copy` est une erreur ; un cycle dans l'union des anciennes
révisions est un avertissement car ces versions ne sont pas forcément actives ensemble.

La preuve de suppression est volontairement limitée : les formats originaux simples
et connus, ainsi que les résultats du convertisseur classImporter v1, sont analysés.
Un champ, tag de référence, métadonnée ou convertisseur non compris fait refuser
l'opération. Une simple mention du nom dans un original peut aussi bloquer par prudence.
Les révisions et conversions historiques, les contenus archivés et les entrées
originales sans identité indexée font partie de cette analyse.

Une suppression autorisée retire uniquement le contenu, toutes ses révisions (avec
leurs conversions intégrées) et les lignes du graphe actif dont il est propriétaire.
Aucun import original n'est supprimé, même lorsqu'il ne reste plus de contenu indexé
pour ce fichier. Aucun contenu dépendant n'est modifié. Un réimport explicite d'un
original pourra recréer un contenu supprimé ; aucun mécanisme ne le recrée automatiquement.
Ce n'est donc pas une purge de toutes les occurrences textuelles dans les originaux.

La confirmation nécessite le nom EXACT, casse et espaces compris, et l'accord sur
l'irréversibilité. L'export d'une sauvegarde est proposé sans être imposé. La preuve
est liée à tout le snapshot : la transaction readwrite relit les quatre magasins,
refuse tout état obsolète et réanalyse les références sous verrou avant de supprimer.
Les empreintes vérifiées hors transaction restent valables grâce à cette comparaison
exacte du snapshot ; aucune attente asynchrone externe n'est introduite dans IndexedDB.
Une erreur annule toutes les écritures.

## Préparation navigateur

Utiliser des profils de test, sans données personnelles, avec le serveur Vite habituel.
Conserver la même adresse et le même port. Les JSON fournis sont entièrement fictifs.
Leur source inconnue et l'absence de convertisseur autonome des dons sont normales.
Les sélectionner dans Analyser des données JSON puis confirmer l'enregistrement.

Ne pas importer la fixture de cycle dans le profil réservé au test de suppression
autorisée : son erreur d'intégrité bloque volontairement les suppressions du profil.

## 1. Diagnostic valide

1. Aller dans Bibliothèque et cliquer Lancer les diagnostics.
2. Dans une base vierge : zéro erreur. Les diagnostics ne doivent ajouter aucun contenu.
3. Importer `tests/fixtures/fictive-classes.json` dans un profil de test sain.
4. Relancer : zéro erreur, et des informations sur les cycles structurels
   propriétaire/capacité. Ce ne sont pas des cycles d'héritage `_copy` erronés.
5. Tester les filtres Erreurs bloquantes, Avertissements et Informations.
6. Vérifier dans IndexedDB qu'aucun statut, génération ou révision n'a été modifié.

## 2. Suppression autorisée avec original partagé

Dans un profil sain, importer `tests/fixtures/manual-integrity/contenus-independants.json`.

1. Rechercher Jeton Azur de démonstration (livre TESTDELETE), ouvrir ses détails.
2. Archiver et Supprimer définitivement doivent être des actions distinctes.
3. Cliquer Supprimer définitivement : cela prépare seulement le rapport.
4. Attendu : aucune référence bloquante, liste des révisions/conversions propres
   qui seraient retirées, et conservation de tous les fichiers originaux.
5. Cliquer Exporter une sauvegarde avant suppression et vérifier le téléchargement.
6. Saisir un nom erroné ou changer sa casse : Confirmer la suppression définitive
   doit rester désactivé. Le nom correct est `Jeton Azur de démonstration`.
7. Même avec le nom correct, la case d'irréversibilité doit être cochée pour confirmer.
8. Confirmer, puis attendre le succès de fin de transaction. Le contenu doit disparaître.
9. Jeton Ambre de démonstration reste consultable avec sa description et sa révision.
10. Dans IndexedDB, vérifier que le fichier original contenant les DEUX entrées reste
    intact, tandis que seules les révisions du Jeton Azur ont été retirées.
11. Actualiser puis rouvrir le navigateur : la suppression reste effective.
12. Relancer les diagnostics : pas d'erreur causée par la définition originale
    conservée sans contenu indexé. Si les diagnostics étaient ouverts, ils sont
    également actualisés après l'opération.

On peut créer une deuxième révision du Jeton Azur AVANT sa suppression, en modifiant
uniquement sa description dans une copie locale puis en acceptant la mise à jour.
Le rapport doit alors annoncer deux révisions propres, toutes deux retirées après
confirmation, sans perdre celles du Jeton Ambre.

## 3. Référence dans un original : suppression bloquée

Importer `tests/fixtures/manual-integrity/reference-originale.json` dans un profil sain.

1. Ouvrir Sceau Cible de démonstration, puis préparer sa suppression.
2. Le rapport doit signaler la mention dans l'original de Sceau Lecteur de démonstration.
3. Le bouton de confirmation de suppression ne doit pas être proposé.
4. Annuler puis vérifier que les deux contenus et leurs révisions sont inchangés.

Une mention de description n'est pas forcément une dépendance de règle ; cette
version refuse néanmoins la suppression plutôt que de supposer qu'elle est inoffensive.
Les références présentes uniquement dans une ancienne révision/conversion sont
également couvertes par les tests automatiques et restent bloquantes.

## 4. Format incertain : refus prudent

Dans un autre profil de test, importer
`tests/fixtures/manual-integrity/structure-incertaine.json`.
Préparer la suppression de Sceau Isolé de démonstration. Le champ customMechanics
étranger est volontairement inconnu : la suppression doit être refusée avec une
explication de structure non analysable, même sans dépendance déclarée.
Le diagnostic de structure peut rester sans erreur : c'est la PREUVE DE SUPPRESSION
qui est insuffisante. Aucune réparation automatique ni suppression partielle.

## 5. Cycle d'héritage incohérent

Dans un profil jetable distinct, importer `tests/fixtures/manual-integrity/cycle-copie.json`.
Ces copies de dons sont uniquement des données de test, sans effet de jeu converti.
Lancer les diagnostics : cycle actif `_copy` classé en erreur, distinct des cycles
structurels informatifs. La suppression est bloquée car la bibliothèque n'offre pas
une preuve d'intégrité suffisante. Ne pas supprimer manuellement des lignes de base
pour contourner cette protection. Le service ne réinitialise jamais la base.

Les scénarios de révision active absente, original absent, révision épinglée manquante
et corruption de projection sont vérifiés automatiquement avec fake-indexeddb.

## 6. Concurrence

1. Dans un profil sain, préparer dans l'onglet A la suppression autorisée d'un jeton.
2. Dans B, enregistrer un autre contenu fictif ou archiver/restaurer un contenu.
3. Revenir dans A et confirmer avec l'ancien rapport.
4. Attendu : refus explicite pour état obsolète ; aucune suppression. Relancer
   l'analyse puis saisir et confirmer à nouveau le nom exact si l'opération reste sûre.
5. Avec deux suppressions préparées du même contenu, un seul onglet peut réussir.

## 7. Compatibilité sauvegarde et révisions

1. Après une suppression autorisée, exporter la bibliothèque P1.5a.
2. Restaurer dans un autre profil vide.
3. Le contenu supprimé reste absent des contenus indexés ; les autres contenus,
   leurs révisions et les originaux partagés restent présents.
4. Sur le contenu restant, tester Archiver, Restaurer et l'historique des révisions.
5. Une sauvegarde exportée AVANT suppression peut restaurer le contenu dans un
   profil vide ; elle ne remplace jamais silencieusement une bibliothèque remplie.

## Résultats et limites

Noter navigateur/version, URL, noms utilisés, compteurs et erreurs console.
Ce protocole est fourni mais n'a pas été exécuté par les tests Node. Les tests
valident les services, le rendu initial React, le rollback, la concurrence et
l'export/restauration après suppression, pas les clics réels du navigateur.
Les analyses relisent toute la bibliothèque ; les gros volumes restent à profiler.
La détection de mentions est conservatrice et peut refuser des suppressions qui
seraient inoffensives. Les formats non compris restent bloqués, sans option de forçage.
Aucun modèle de personnage, campagne, règle de jeu ni stockage localStorage n'est modifié.

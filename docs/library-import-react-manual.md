# P1.4b — Confirmation d'import dans un navigateur

À exécuter sur le serveur Vite (`npm run dev`), dans un profil navigateur de test.
Conserver la même adresse et le même port. Aucun contenu externe n'est nécessaire.
Les tests automatiques couvrent le contrôleur de parcours et le rendu React côté
serveur ; ce protocole complète la vérification avec de vrais clics et IndexedDB.

## 1. Premier import et prévisualisation

1. Aller dans Bibliothèque. Le catalogue de livres, la consultation persistante
   et le panneau d'analyse doivent être présents.
2. Choisir le fichier fictif du dépôt `tests/fixtures/fictive-classes.json`.
3. Attendre l'analyse puis le plan : dans une base de test vide, il doit proposer
   **7 nouveaux**, 0 identique, 0 modifié, 0 conflit.
4. Avant toute confirmation, la bibliothèque enregistrée doit rester vide.
   Dans les outils du navigateur, `imports` et `contents` doivent être vides.
5. Utiliser les filtres des relations entre capacités, changer la source de classe
   et cliquer sur Prévisualiser les classes. Vérifier les descriptions et les
   sous-classes comme avant l'ajout de l'enregistrement.
6. Cliquer sur **Enregistrer dans la bibliothèque**. Pendant la transaction, les
   boutons de sélection, réanalyse et enregistrement sont désactivés. Un double
   clic ne doit pas doubler l'opération.
7. Attendre le bilan de succès. La consultation au-dessus doit afficher les
   contenus automatiquement, sans clic sur Actualiser.
8. Actualiser la page, puis fermer et rouvrir le navigateur : les 7 contenus et
   leurs sources originales doivent rester présents. Le plan de confirmation,
   lui, est temporaire et disparaît à la fermeture de la page.

## 2. Réimport identique

Sélectionner à nouveau exactement le même fichier. Attendu : **7 identiques**,
message « Ce fichier a déjà été importé », aucun nouvel enregistrement automatique.
Confirmer puis vérifier qu'il reste un seul document dans imports et 7 contenus.
La confirmation reste utile pour reconstruire un cache de conversion si nécessaire.

## 3. Mise à jour explicitement acceptée ou refusée

Créer deux fichiers JSON de test hors du dépôt, par exemple dans Téléchargements.

`pli-initial.json` :

```json
{
  "feat": [{ "name": "Pli de démonstration", "source": "FICTIF", "entries": ["Description initiale fictive."] }]
}
```

`pli-modifie.json` :

```json
{
  "feat": [{ "name": "Pli de démonstration", "source": "FICTIF", "entries": ["Description modifiée fictive."] }]
}
```

1. Importer et confirmer pli-initial.json : un nouveau contenu doit apparaître.
2. Sélectionner pli-modifie.json : une modification doit être proposée et le
   bouton Enregistrer doit être désactivé tant que sa case n'est pas cochée.
3. Laisser la case décochée : rien ne doit changer en base. Cocher puis décocher
   doit à nouveau bloquer l'enregistrement.
4. Cocher la case et confirmer : attendre le bilan, puis consulter la nouvelle
   description. Les deux révisions doivent exister dans IndexedDB.
5. Vérifier que FICTIF est consultable sans être ajouté aux livres autorisés de
   la campagne et que le créateur ne reçoit pas ce don automatiquement.

## 4. Conflit bloquant

Créer un fichier contenant deux définitions fictives contradictoires :

```json
{
  "feat": [
    { "name": "Pli contradictoire", "source": "FICTIF", "entries": ["A"] },
    { "name": "Pli contradictoire", "source": "FICTIF", "entries": ["B"] }
  ]
}
```

Sélectionner le fichier : un conflit doit être affiché et l'enregistrement doit
rester désactivé. Ni le fichier ni ses contenus ne doivent être ajoutés. L'analyse
et la prévisualisation restent consultables. Corriger le fichier puis le sélectionner
à nouveau ; aucune définition n'est choisie arbitrairement.

## 5. Plan obsolète entre deux onglets

1. Dans l'onglet A, préparer une modification sans l'enregistrer. Cocher son accord.
2. Dans l'onglet B, enregistrer un autre contenu fictif (nom différent).
3. Revenir dans A et cliquer sur Enregistrer avec l'ancien plan.
4. Attendu : aucun succès ; message demandant de réanalyser, bouton d'enregistrement
   désactivé et accords effacés. L'analyse initiale reste visible.
5. Cliquer sur **Réanalyser le fichier** : le texte conservé en mémoire est réanalysé
   sans resélection. Les accords doivent rester décochés. Les renouveler pour confirmer.

## 6. Erreur de stockage

Les quotas réels sont difficiles à reproduire de manière portable. Les tests
fake-indexeddb couvrent les échecs et rollback ; ne pas remplir volontairement son
disque pour ce test. Pour vérifier un échec réel sans données personnelles, dans
un profil de test jetable uniquement :

1. Préparer un plan dans le panneau.
2. Dans la console du même onglet, passer volontairement la base de test en v2 :

   ```js
   {
     const request = indexedDB.open('atelier-aventuriers:library', 2);
     request.onsuccess = () => request.result.close();
     request.onerror = () => console.error(request.error);
   }
   ```

3. Essayer d'enregistrer : une erreur de version doit être affichée, avec analyse
   et prévisualisation conservées. Aucun bilan de succès ni nouvel enregistrement.
4. La base v2 de ce profil est désormais incompatible avec l'application v1 ;
   le service ne doit pas la supprimer ou la réinitialiser automatiquement.

## Résultats à relever

Noter navigateur/version, origine utilisée, étapes réussies, compteurs affichés et
éventuelles erreurs console. Vérifier aussi l'utilisation au clavier des cases de
mise à jour et la lisibilité sur une petite fenêtre.

Le protocole de consultation P1.4a reste utile pour les filtres et les détails ;
son injection par console n'est plus nécessaire pour le premier import, désormais
réalisable dans le panneau React.

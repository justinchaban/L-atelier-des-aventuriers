# P2.2 — Catalogue natif commun

## Contrat et périmètre

`CreatorCatalog.ts` distingue catégorie, clé de catalogue, identifiant métier,
référence, provenance et disponibilité. Seule une entrée `ready` expose une
définition mécanique. Les références de bibliothèque prévoient révision,
convertisseur, version d'adaptation, empreinte du résultat et dépendances ; elles
ne sont ni produites ni consommées dans le créateur à cette étape.

L'adaptateur natif couvre uniquement les classes, sous-classes et leurs capacités.
Les autres catégories sont prévues dans les types, sans changer leurs accès.
`native-reviewed` garantit l'utilisation des définitions natives existantes, pas
une implémentation complète de toutes les règles D&D. L'adaptateur n'est pas un
validateur de JSON importé.

Les clés natives versionnées encodent catégorie et identifiants de propriétaires.
Elles sont indépendantes des noms et de l'ordre des tableaux. Une collision dans
un même contexte est refusée. Les identifiants métier restent inchangés et ne
sont jamais remplacés par ces clés dans les personnages.

Les enveloppes et tableaux du catalogue sont figés. Les définitions conservent
leurs références originales pour préserver la parité : elles doivent être
traitées en lecture seule, sans copie ni gel profond des données natives.
La normalisation des livres porte sur la provenance du catalogue, sans réécrire
les définitions. Les permissions restent calculées par `isBookAllowed`.

## Accès migrés et conservés

- `CharacterBuilder` résout les classes via le catalogue pour les transitions de
  niveau, de classe et de sous-classe ; le nettoyage existant reste inchangé.
- `ClassSelector` obtient les classes autorisées via le catalogue. Les
  sous-classes et capacités imbriquées sont transmises aux composants existants.
- `StartingEquipmentSelector` résout le nom de classe via le même catalogue.
- `SubclassSelector`, `ClassProgression`, `classProgression` et `characterChoices`
  reçoivent déjà une définition de classe : leurs signatures et règles restent
  inchangées. Aucun moteur n'importait directement le tableau des classes.
- `src/data/startingEquipment.ts` conserve son import de `./classes` pour
  construire son registre natif. Faire dépendre ce fichier de données du
  catalogue n'est pas nécessaire à cette étape.
- Restent directs : espèces (`SpeciesSelector`, `SpeciesTraits`), historiques
  (`BackgroundSelector`, `BackgroundAbilitySelector`, `backgroundAbilities`,
  `feats`), dons (`BackgroundSelector`, `feats`), armes (`WeaponMasterySelector`,
  `weaponMastery`), équipements (`StartingEquipmentSelector`,
  `CharacterInventoryPreview`) et équipement initial (`StartingEquipmentSelector`,
  moteur `startingEquipment`). Styles et autres tables de règles restent natifs.

Il n'existe aucun rafraîchissement asynchrone, effet React, accès IndexedDB ou
écriture de personnage dans cette couche. Une nouvelle consultation n'appelle
aucun gestionnaire de changement. Le modèle Character, schemaVersion 1 et la clé
`atelier-aventuriers:characters:v1` restent identiques.

## Vérification manuelle dans un navigateur

Validation utilisateur : les neuf vérifications ci-dessous ont été réalisées
et réussies pour P2.2. L’ancien point 8 regroupait équipement et absence de
sélection importée ; ils sont désormais numérotés séparément, sans nouveau scénario.

Utiliser un profil de test ; conserver un export préalable des personnages.

1. Ouvrir un personnage existant et noter classe, sous-classe, caractéristiques,
   choix, niveau et équipement. Le rouvrir, puis actualiser : tout doit rester
   identique. Vérifier dans le stockage local que `schemaVersion` vaut toujours
   1 et que les identifiants métier sont conservés.
2. Créer un brouillon, choisir Guerrier, conserver des caractéristiques
   incomplètes, actualiser. Vérifier la conservation du brouillon et l'absence
   de champ de catalogue ajouté au personnage.
3. Avec XSRD autorisé, vérifier les classes natives. Au niveau 2, les sous-classes
   du Guerrier ne sont pas sélectionnables ; au niveau 3, Champion et Maître de
   bataille sont disponibles.
4. Avec Champion, vérifier un style au niveau 6, puis deux au niveau 7. Vérifier
   les limites de maîtrises d'armes : trois au niveau 1, quatre au niveau 4,
   cinq au niveau 10.
5. Avec Maître de bataille, vérifier les manœuvres aux niveaux 3, 7 et 15
   (respectivement 3, 5 et 7). Vérifier les dés aux seuils existants : d8 avant
   le niveau 10, d10 à partir de 10, d12 à partir de 18. Revenir à Champion :
   le nettoyage des choix doit rester celui du créateur précédent.
6. Afficher la progression et les vingt niveaux ; consulter plusieurs classes
   sans les sélectionner, changer d'étape, puis revenir. Ces consultations ne
   doivent modifier aucun choix enregistré.
7. Dans une campagne de test sans XSRD, vérifier l'absence de classes autorisées.
   Réautoriser XSRD : retrouver les options natives. Les codes de campagne
   historiques utilisant `srd-5.2.1` doivent donner le même résultat.
8. Vérifier les deux options d'équipement du Guerrier et l'inventaire obtenu.
9. Importer une fixture fictive par l'interface Bibliothèque :
   elle doit rester consultable sans apparaître dans les classes du créateur.

Les tests automatisés couvrent les définitions, les permissions, les règles,
le rendu statique React et les sauvegardes. Ils ne remplacent pas ces interactions
dans un navigateur réel.

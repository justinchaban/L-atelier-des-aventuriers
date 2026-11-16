# P2.5b — Contrats, validation et capture mécanique en mémoire

Statut : P2.5b validée par l’utilisateur. Commit dédié autorisé, sans push. Aucune P2.5c ni P2.5d.

## Périmètre et fichiers

Créés :

- `src/models/FrozenMechanics.ts` : format typé et versionné, identités, provenance native/importée, dépendances locales, sélections, tables et rapport de validation.
- `src/engine/nativeMechanicalBaseline.ts` : référentiel natif identifié, copie indépendante des tables existantes, construction des liens et tables 1–20, contrôle d’empreinte de revue.
- `src/engine/frozenMechanics.ts` : `captureNativeMechanics`, `validateFrozenMechanics`, `measureFrozenMechanics`.
- `tests/frozen-mechanics.test.cjs` : dix-neuf tests et mesures reproductibles sur personnages fictifs.
- `tests/types/frozen-mechanics.ts` : vérifications de typage et d’immuabilité.
- `docs/frozen-mechanics-capture.md` : ce document.

Aucun fichier applicatif préexistant modifié. Le module n’est importé par aucun composant ni service de stockage. `Character`, schemaVersion 1, clés localStorage, campagnes, révisions actives et moteurs existants restent inchangés. La modification locale préexistante de tsconfig.app.tsbuildinfo n’est pas liée à ce travail.

## Contrat final

La source de vérité du contrat est `src/models/FrozenMechanics.ts`.

`FrozenMechanicsDocument` contient :

- `formatVersion: 1` ;
- `baseline: { id, hash }` ;
- `state: complete | partial` ;
- `selections` : classe, sous-classe, espèce, historique et tableaux de dons d’origine, styles, armes de maîtrise, options d’équipement ;
- `nodes` : union discriminée par catégorie, avec définition typée ;
- `tables` : version d’évaluateur, progressions et tables générales ;
- `bundleHash`.

Quatre identités distinctes : `domainId` conserve l’identifiant métier ; `catalogKey` désigne le contenu natif dans son contexte ; `snapshotId` désigne le nœud local ; `source` conserve la provenance versionnée. L’ID local est un encodage contextuel déterministe de la clé, indépendant de l’empreinte de définition. Les capacités et options conservent leur propriétaire local. Les clés des catégories déjà couvertes par P2.2 sont identiques aux clés natives existantes.

Les catégories sont class, subclass, classFeature, subclassFeature, species, background, feat, equipment, weapon, fightingStyle et equipmentOption. Weapon et equipment sont volontairement séparés : un même identifiant métier peut désigner à la fois une fiche d’arme et une fiche de coût/poids, sans fusion ni ambiguïté.

Les classes et sous-classes référencent leurs capacités/sous-classes par IDs locaux. Les autres références métier des modèles existants (ex. originFeatId, itemId) sont conservées avec un lien local explicite de catégorie et de chemin dans `dependencies`. Elles n’autorisent aucune résolution globale implicite. Le futur résolveur devra utiliser ces liens.

Une sélection est `unselected`, `resolved` avec une cible locale typée, ou `unresolved` avec l’identifiant fourni et sa raison. Une dépendance est résolue localement ou explicitement non résolue. `partial` signifie qu’une sélection principale manque, qu’une identité sélectionnée est inconnue, ou qu’une dépendance manque ; `complete` ne signifie pas qu’un personnage est terminé ou que ses choix sont légaux à son niveau. L’absence de sous-classe ne reçoit pas de choix inventé.

`MechanicalSource` prévoit une origine native (référentiel, empreinte de révision native et adaptateur) ou importée (contentId, révision originale, convertisseur, adaptateur et artefact). Cette seconde branche n’autorise aucune capture ou compatibilité importée : le validateur de cette version la rejette explicitement. Les sources/livres natifs restent dans les définitions ; les capacités sans livre explicite héritent du contexte de leur propriétaire conservé localement. Aucun livre ni édition supplémentaire n’est inventé.

Aucune expression exécutable ni `unknown[]` dans le contrat mécanique. Les champs `structuredEntries`, `importMetadata`, `_copy` et `_mod` sont interdits dans le référentiel ; leur apparition provoque un rejet, pas une suppression silencieuse. Les descriptions existantes sont exclusivement des chaînes, jamais interprétées comme des règles. Aucun contenu HTML ou document original importé n’est lu.

## Capture et fermeture des dépendances

`captureNativeMechanics(character)` valide une entrée Character v1, vérifie les conventions des champs de choix reconnus, puis en détache une copie avant le premier await. Une convention malformée (ex. subclassId sous forme de tableau) est refusée avec un message explicite ; elle n’est pas convertie en absence de sélection. Les autres clés personnalisées ne sont ni supprimées ni interprétées.

La fonction ne retourne pas un personnage modifié et ne migre rien. Elle ne nettoie, ne trie ou ne déduplique aucun choix du personnage d’origine. Les tableaux de sélection reconnus conservent leur ordre et leurs doublons ; la validation des choix de jeu et des limites à un niveau donné appartient à une étape ultérieure. La capture garantit la définition des limites, pas la légalité de toutes les décisions du joueur.

Seuls les champs effectivement reconnus par le créateur actuel sont interprétés : `subclassId`, `backgroundOriginFeatId`, `fightingStyles`, `weaponMasteries`, `classEquipmentOptionId`, `backgroundEquipmentOptionId`. Les compétences et choix de capacités sont déjà décrits par les options figées des définitions ; leurs valeurs restent dans le Character d’origine. Aucun don arbitraire n’est inféré en parcourant toutes les chaînes de choices. Le composant FeatSelector n’étant pas monté aujourd’hui, un futur système de dons généraux exigera des acquisitions explicitement typées.

La fermeture est calculée en mémoire depuis les racines sélectionnées, en ajoutant parents et dépendances. Une classe entraîne toutes ses capacités, toutes ses sous-classes et leurs capacités sur les vingt niveaux, ainsi que toutes ses options d’équipement. Le Guerrier entraîne aussi toutes les options de styles et toutes les fiches d’armes actuellement proposées pour Weapon Mastery. Les options d’équipement entraînent leurs fiches d’objets et les fiches d’armes correspondantes. L’historique entraîne son don d’origine et les dons leurs prérequis de dons, s’ils existent.

Le référentiel comporte 102 nœuds, aucune dépendance non résolue et 14 combinaisons classe/sous-classe. Les cycles structurels parent/enfant sont parcourus avec un ensemble de visites ; ils ne déclenchent aucune récursion mécanique infinie. Aucun héritage `_copy` n’est interprété.

Les tables capturent : bonus de maîtrise, limites de styles, limites de Weapon Mastery, Battle Master et limites des choix de capacités aux niveaux 1–20 ; descriptions des huit propriétés de maîtrise ; tableau standard, coûts/budget d’achat de points, politique 4d6 gardant trois dés et six séries ; politique des bonus d’historique ; modificateurs de caractéristiques de 0 à 32 (scores v1 0–30 et bonus d’historique jusqu’à +2 du moteur actuel). Aucun dé n’est lancé. Les bornes ne prétendent pas couvrir des effets encore non implémentés.

Ces tables utilisent les fonctions et données natives existantes sans les modifier. Elles figent le comportement actuellement implémenté, sans prétendre ajouter ou certifier toutes les règles D&D.

## Versions et empreintes

- Format : 1.
- Référentiel : `atelier-native-migration-v1`.
- Empreinte de revue : `sha256:v1:87de71fd93ca7b07efe820a36a0b4147c70dc3cd98aac64d0b8bfaea726b0f00`.
- Adaptateur : `native-mechanical-capture`, version 1.
- Évaluateur déclaré : `atelier-native-tables`, version 1. Aucun nouveau moteur d’exécution n’est branché ni développé en P2.5b.

Les empreintes réutilisent `serializeLibraryJson` et `fingerprintLibraryJson` : sérialisation JSON stricte, clés d’objets triées, tableaux conservés, SHA-256 Web Crypto. Les nœuds capturés sont ordonnés par comparaison déterministe des IDs, sans dépendance à la locale. Aucun UUID, horodatage ou hasard.

L’empreinte de révision native est celle du seed (identité, définition, propriétaire et dépendances). `definitionHash` couvre l’enveloppe du nœud avec sa provenance, hors definitionHash lui-même. `bundleHash` couvre le document complet, hors bundleHash lui-même. Les champs optionnels absents sont omis, jamais sérialisés comme undefined.

Le référentiel est reconstruit depuis les données natives et fonctions actuelles, puis copié et figé. Son empreinte attendue est une constante de revue distincte : modifier les données, leur ordre significatif ou une table modifie cette empreinte et bloque la capture/validation tant qu’une nouvelle version n’a pas été explicitement revue. Une version future devra conserver/archiver ce référentiel et ses règles de construction, ou en embarquer une copie approuvée, avant de faire évoluer les tables natives. Le module actuel ne garantit pas de reconstruire une ancienne version après remplacement de ses sources ; il échoue explicitement au lieu de substituer les nouvelles règles. Cette politique doit être arrêtée avant migration persistante.

Il s’agit d’une capture du référentiel validé, jamais d’une reconstitution des règles historiques d’un personnage v1.

## Validation à l’exécution et immutabilité

`validateFrozenMechanics(unknown)` détache d’abord du JSON strict. Les valeurs non JSON, fonctions, accesseurs, références circulaires et nombres non finis sont refusés.

Le validateur contrôle les champs exacts du document et des enveloppes, les versions, les IDs locaux uniques, les catégories, les sélections, les propriétaires, la fermeture des liens et leurs catégories, le rattachement classe/sous-classe, les empreintes de chaque nœud et du document, l’état complet/partiel et l’intégralité des tables attendues.

La compatibilité native ne repose pas seulement sur une structure ou un hash : chaque nœud doit correspondre exactement à un nœud du référentiel approuvé, provenance et versions incluses. Les tables doivent également correspondre exactement à celles du référentiel pour les classes présentes. Cela interdit notamment des limites modifiées, une capacité remplacée, une catégorie forgée ou une empreinte recalculée sur une nouvelle mécanique. C’est volontairement un validateur d’un domaine natif fini, pas un validateur universel de conversions importées.

Le rapport retourne `valid`, `compatible`, `issues` avec code/chemin/message et une copie `snapshot` seulement si valid. Une capture partielle peut être valide mais compatible reste false : aucune compatibilité complète n’est affirmée lorsqu’il manque des sélections ou des dépendances. Une capture invalide n’est jamais réparée automatiquement. Des anomalies distinctes sont accumulées lorsque la structure permet de poursuivre ; une structure inexploitable peut arrêter les contrôles suivants avec un diagnostic explicite.

Les snapshots valides et le référentiel sont profondément gelés sur des copies JSON indépendantes. Le contrat de sortie est DeepReadonly. Les tableaux, définitions, choix et tables imbriqués sont protégés ; les tables natives originales ne sont jamais gelées ni mutées. En mode strict une tentative de modification échoue ; en mode non strict une affectation peut être ignorée. Cette protection évite les mutations accidentelles, pas une substitution du programme, une falsification du code de validation ou une écriture extérieure. Après désérialisation, il faut revalider et regeler. Le helper de gel est réservé à des arbres JSON sans cycle.

## Taille mesurée

Mesures reproductibles émises par le test de taille, pour les seules captures (pas encore un futur personnage v2 ni une sauvegarde complète) :

| Personnage fictif | Nœuds | Unités UTF-16 | Octets UTF-8 | Estimation octets UTF-16 |
| --- | ---: | ---: | ---: | ---: |
| Simple : Barbare, première espèce et premier historique natifs | 4 | 10 160 | 10 229 | 20 320 |
| Guerrier avec Champion | 70 | 96 051 | 96 457 | 192 102 |
| Guerrier niveau 20 avec Maître de bataille | 70 | 96 056 | 96 462 | 192 112 |
| Guerrier niveau 20, nombreux choix et équipement initial | 70 | 96 912 | 97 318 | 193 824 |

Le niveau élevé ajoute peu de volume car toutes les progressions et sous-classes sont déjà capturées au niveau 1. Les nombreuses valeurs de choices restent dans le personnage d’origine ; seules leurs références mécaniques reconnues sont ajoutées dans les sélections. Les options de progression ne sont pas réduites pour améliorer ces chiffres.

Pour le scénario le plus volumineux : dix captures représentent environ 1 938 240 octets UTF-16, vingt 3 876 480 et cinquante 9 691 200. Ajouter les autres champs des personnages, l’enveloppe de sauvegarde, les clés, la source v1 et les copies de récupération. Une duplication intégrale de la liste double au moins cette partie du volume. Le comptage de quota dépend du navigateur ; ces nombres ne garantissent aucune capacité localStorage disponible.

Avant P2.5c, comparer sur navigateur les alternatives : garder les captures autonomes par personnage avec contrôle de quota ; compression réversible et versionnée ; dictionnaire de nœuds partagé à l’intérieur d’une même sauvegarde locale, avec expansion obligatoire lors d’un export de personnage autonome. Un simple déplacement des définitions indispensables dans la bibliothèque IndexedDB réintroduirait la dépendance précisément évitée. Aucune de ces alternatives n’est implémentée ici.

## Vérifications et décisions avant P2.5c

Dix-neuf tests nouveaux couvrent déterminisme, référentiel identifié, typage, empreintes, falsification après recalcul des hashes, absences et identifiants inconnus, brouillons, fermeture, ambiguïtés, catégories, propriétaires, références croisées, niveaux/limites/options, versions, JSON brut/exécutable, absence de mutation, absence d’accès aux deux stockages, gel profond et tailles. Les tests P1/P2.2/P2.3/P2.4 doivent rester tous verts.

Vérifications finales exécutées : 217 tests réussis (198 antérieurs + 19 nouveaux) ; TypeScript application validé (`tsc -p tsconfig.app.json --noEmit --incremental false`) ; build Vite validé (`vite build --outDir /tmp/atelier-books-vite-check`) ; `git diff --check` et contrôle des espaces des fichiers nouveaux réussis. Le build conserve les mêmes 100 modules et le même artefact JavaScript applicatif que P2.4, les nouveaux modules n’étant pas branchés. Les vérifications navigateur de P2.4 restent applicables car aucun branchement applicatif n’a été modifié ; aucun nouveau résultat manuel n’est revendiqué ici.

Décisions avant P2.5c :

1. Accepter le volume mesuré ou choisir un format de stockage/export autonome moins redondant.
2. Arrêter la conservation des anciennes versions du référentiel et des évaluateurs avant toute évolution native.
3. Valider les états partiels, les conventions de choix malformées et leur parcours de récupération, sans nettoyage silencieux.
4. Définir les acquisitions de dons généraux explicitement, sans déduction depuis les valeurs arbitraires de choices.
5. Valider le futur protocole de migration/persistance, les copies de secours, le quota et les conflits multi-onglets.
6. Garder les imports non certifiés hors des mécaniques utilisables. Aucun passage à ready ou sélection importée n’est ajouté.

Aucun modèle Character v2 actif, aucune clé créée, aucune migration persistante, aucune révision modifiée, aucun changement des règles natives. Commit dédié autorisé par l’utilisateur ; aucun push.

# P2.5c.1 — Préparation sécurisée de migration v1 vers v2

Statut : P2.5c.1 validée par l’utilisateur. Commit dédié autorisé ; aucun push. Aucune P2.5c.2 ni P2.5d.

## Périmètre et fichiers

Créés :

- `src/models/CharacterV2.ts` : contrat v2 séparé du modèle actif.
- `src/engine/characterMigration.ts` : validation v2, préparation individuelle et de liste, rapports récupérables.
- `src/engine/characterMigrationSimulation.ts` : préparation depuis une chaîne fournie et simulation pure du protocole de sauvegarde.
- `tests/character-migration.test.cjs` : 23 tests fictifs, simulations et mesures de taille.
- `tests/types/character-v2.ts` : tests de séparation v1/v2 et d’immuabilité mécanique.
- `docs/character-migration-preparation.md` : ce document.

Aucun fichier applicatif existant, moteur, modèle Character, service de stockage, composant ou campagne modifié. Les modules ne sont pas importés par l’application. La modification locale préexistante de tsconfig.app.tsbuildinfo reste indépendante. Aucun accès réel à IndexedDB ou localStorage. Commit dédié autorisé par l’utilisateur ; aucun push.

Les personnages locaux restent des brouillons conservés jusqu’à suppression manuelle. Aucune purge, expiration, réduction de liste ou suppression pour libérer du quota n’est introduite. Ce travail prépare une représentation autonome nécessaire aux futurs exports Foundry VTT/PDF ; il ne prétend ni implémenter ces exports, ni compléter les règles D&D absentes du prototype.

## Contrat CharacterV2

```ts
export type CharacterV2 = Omit<Character, 'schemaVersion'> & {
  schemaVersion: 2;
  mechanics: FrozenMechanicsSnapshot;
};
```

`Character` reste strictement v1 dans `src/models/Character.ts`. Le typage empêche d’utiliser implicitement une v2 à sa place. Le contrat v2 ne crée aucun champ technique dans choices. Les propriétés additionnelles JSON, y compris objets imbriqués, inventaire additionnel ou état de jeu étendu, sont conservées par copie structurelle à l’exécution. Elles ne sont pas interprétées pour deviner des mécaniques.

Les candidats retournés sont des copies détachées profondément gelées, mécaniques comprises. Pour une future édition, il faudra produire une nouvelle valeur, pas muter ce résultat. Aucune valeur n’est affectée au personnage actif par ces fonctions.

## API pure et rapports

### Validation et préparation individuelle

- `validateCharacterV2(value: unknown)` retourne `{ valid, diagnostics, character? }`.
- `prepareCharacterMigration(value: unknown, options?)` retourne un `CharacterMigrationReport`.

Le rapport individuel comprend status (`ready`, `partial`, `rejected`), action (`migrate`, `unchanged`, `none`), original, originalByReference, diagnostics et character uniquement en cas d’acceptation.

Pour v1 : validation structurelle existante, contrôle des conventions de choix reconnues par P2.5b, refus d’une collision avec mechanics, copie indépendante avant le premier await, capture native P2.5b, validation mécanique et contrôle de correspondance entre sélections figées et champs métier.

Pour v2 : validation des champs métier avec les mêmes contraintes v1, validation du snapshot P2.5b et des correspondances, puis restitution sans recapture. Une v2 valide conserve ses valeurs et son snapshot ; une v2 corrompue n’est jamais recapturée pour masquer l’anomalie.

Les correspondances vérifient classe, espèce, historique, sous-classe, don d’origine, listes ordonnées de styles et armes de maîtrise et les deux options d’équipement. Une option résolue doit appartenir au bon propriétaire. La validation conserve les identifiants inconnus sous forme non résolue plutôt que de choisir une définition ressemblante.

Les choices, niveaux, scores, quantités additionnelles, états de jeu, clés personnalisées et propriétés supplémentaires sont copiés sans nettoyage, déduplication ou normalisation. Les sélections non résolues et dépendances non résolues disposent de diagnostics avec chemins et raisons. Les brouillons inachevés ont des avertissements de complétude, qui ne bloquent pas leur conservation.

`ready` signifie uniquement « résultat de préparation accepté avec capture complète », pas personnage D&D complet, choix de jeu légaux, disponibilité ready du catalogue ou autorisation de jouer. Un brouillon à scores zéro peut être accepted/ready si ses définitions sélectionnées sont complètes. `partial` signifie capture partielle P2.5b, également sauvegardable dans un futur protocole explicitement autorisé ; aucune mécanique manquante n’est inventée ou rendue exécutable.

L’option capture sert uniquement aux tests d’échec et de falsification. Son résultat est toujours validé ; une capture avec hashes recalculés sur une définition incompatible, ou correspondant à un autre personnage, reste rejetée. L’entrée fournie au lecteur de capture est elle-même une copie, afin de protéger l’original.

### Liste et données originales

`prepareCharacterListMigration(value: unknown, options?)` retourne :

- une entrée de rapport par position d’origine ;
- diagnostics globaux et racine rejetée récupérable lorsqu’une liste n’est pas fournie ;
- compteurs total, accepted, complete, partial, rejected, unchanged, duplicateEntries, duplicateGroups ;
- canPreparePersistence, vrai seulement s’il n’y a aucun rejet et aucune erreur de racine.

complete + partial = accepted, accepted + rejected = total ; unchanged est un sous-ensemble des acceptés. Les doublons sont comparés par ID exact, sans normalisation ni déduplication par nom. Toutes leurs occurrences sont rejetées et conservées, même si les corps sont identiques. Aucune occurrence ne gagne arbitrairement. Toutes les entrées copiables sont détachées avant les await, y compris celles qui seront traitées après une première capture lente.

Une racine tableau creuse, porteuse de propriétés supplémentaires/symboles ou d’accesseurs est rejetée et conservée avant tout parcours ; aucun accesseur n’est exécuté. Les compteurs restent à zéro pour cette racine non exploitable. Une entrée invalide dans une liste exploitable n’empêche pas la préparation et l’inspection de ses voisines. En revanche, un seul rejet empêche la préparation d’une sauvegarde cible de la liste entière : on n’enregistre jamais seulement le sous-ensemble accepté en faisant disparaître les autres.

### Conservation sans perte et limites JSON

La conservation exacte des valeurs signifie conservation des valeurs JSON interprétables et des tableaux ordonnés, pas conservation de l’ordre des clés ou de la mise en forme dans le nouveau document. La chaîne source fournie est conservée séparément, à l’identique, espaces et échappements compris.

Aucune réparation implicite n’est appliquée : contrairement au chargeur v1 actuel, cette préparation ne remplit pas les champs structurels absents. Ils restent des rejets avec originaux récupérables. Une collision du champ racine mechanics, une version future ou un choix connu de forme incompatible sont également bloquants.

Les fonctions, accesseurs, cycles, nombres non finis, entiers non sûrs et -0 sont refusés plutôt que silencieusement convertis. Pour des appels directs avec un objet JavaScript non copiable sans perte, le rapport garde explicitement la référence d’entrée (`originalByReference: true`) ; il ne prétend pas créer une copie JSON exacte. Le code ne gèle ni ne modifie cet original. L’appelant peut encore le modifier ultérieurement : il ne s’agit donc pas d’une sauvegarde durable. Pour une chaîne de sauvegarde fournie, le texte brut reste toujours disponible dans originalData, y compris en cas d’échec de parsing ou de représentation numérique.

La préparation n’est donc pas une promesse de migration automatique de tout contenu existant. Les anomalies incompatibles doivent être récupérées ou résolues explicitement avant toute persistance globale. Les validations ne sont pas contournées.

## Préparation de sauvegarde et simulation

`prepareStoredCharacterMigration(originalData: string | null)` ne lit aucun stockage : elle analyse seulement la chaîne fournie. Une absence null prépare une liste vide, tandis que la chaîne JSON `null` est une racine invalide. Le plan comprend originalData, le rapport complet, les diagnostics, une empreinte de source, une clé/contenu de récupération déterministes, les tailles et targetData uniquement si tous les personnages sont acceptés.

Clés uniquement PROPOSÉES, non utilisées par l’application :

- source : `atelier-aventuriers:characters:v1` ;
- destination : `atelier-aventuriers:characters:v2` ;
- récupération : `atelier-aventuriers:characters:v2:recovery:v1:` suivi de l’empreinte de la chaîne source (absence distinguée de texte).

Le document cible préparatoire possède storageVersion 2, generation 1, sourceV1Hash, characters et envelopeHash. generation 1 concerne uniquement la première migration : ce module n’implémente pas l’édition ultérieure ni ses générations. La copie de récupération a son propre formatVersion, sourceKey, originalData et sourceHash ; originalData permet de récupérer la chaîne v1 exacte. Aucun horodatage ni identifiant aléatoire.

`validatePreparedCharacterStoreV2(raw)` vérifie le format de cette enveloppe initiale, son empreinte, chaque personnage et l’unicité des IDs. Il ne remplace aucun lecteur actif de l’application.

`simulateCharacterMigration(plan, initialState, options?)` travaille sur un dictionnaire de chaînes copié en mémoire. Il retourne status, state, trace et message. Il ne reçoit pas d’adaptateur de stockage réel et n’utilise aucune API de navigateur.

Trace du protocole simulé :

1. Vérifier que la source v1 correspond exactement à celle du plan.
2. Écrire la copie de récupération, sans écraser une copie différente.
3. Relire et vérifier cette copie.
4. Vérifier de nouveau source, absence de cible et récupération.
5. Écrire le document v2 complet en une opération simulée.
6. Relire et vérifier la cible.

Le simulateur contrôle la cohérence du plan et refait une préparation déterministe de sa source avant de l’accepter. Un plan falsifié qui omet des personnages, même avec une enveloppe et des hashes recalculés, ne peut pas simuler une migration réussie.

Options de défaut : quotaCodeUnits (clés + valeurs), interruptAfter 0–6, échec de relecture recovery/target et modification concurrente avant le dernier contrôle. Tous les résultats conservent la source v1, sauf une modification explicitement injectée comme action concurrente extérieure ; le protocole ne l’écrase jamais.

### Échecs et reprise

| Situation | Politique préparée/simulée |
| --- | --- |
| Un personnage rejeté | Plan bloqué, targetData absent, toutes les entrées et la source restent accessibles. |
| Quota à la récupération | Aucune cible écrite ; source intacte. |
| Récupération non vérifiée | Écriture cible interdite. |
| Quota à la cible | Source et copie vérifiée conservées ; aucun brouillon effacé pour faire de la place. |
| Interruption avant cible | Reprise du même plan possible après contrôle de la source et de la récupération. |
| Interruption après écriture cible | Cible présente mais opération non confirmée ; reprise vérifiée du même plan. |
| Cible identique et copie exacte présentes | already-committed, après validation ; aucune nouvelle écriture nécessaire. |
| Source, cible ou récupération concurrente différente | conflict, sans écrasement. |
| v2 existant illisible, incompatible ou corrompu | corrupt-v2 ; conservation du contenu, aucun retour automatique vers un ancien v1. |
| Échec de vérification cible | Conserver source, récupération et cible ; signaler l’opération non confirmée. |

Aucun marqueur d’activation n’est écrit et l’application continue de lire v1. Les états committed/already-committed désignent exclusivement le résultat de la simulation, pas une migration réelle ou une activation dans l’application.

## Protocole réel à autoriser ultérieurement

P2.5c.2 devra proposer un bilan explicite, vérifier les données sortantes et la copie exacte, assurer les écritures/relectures et ne faire passer l’interface sur v2 qu’après confirmation du résultat. La v1 et sa récupération restent conservées. Une tentative incomplète doit être reconnaissable et reprenable après rechargement, avant toute modification de personnage.

La v2 existante ne doit jamais être remplacée automatiquement par une migration recalculée. Le lecteur futur devra distinguer absence, corruption, version inconnue et conflit. Une version future non reconnue sera conservée en lecture/récupération, pas assimilée à une bibliothèque vide ou une invitation à repartir de zéro.

localStorage ne fournit pas de comparaison-et-échange sur plusieurs clés. La dernière relecture ne rend pas l’écriture atomique vis-à-vis d’autres onglets. Le simulateur vérifie des interleavings définis ; il ne démontre pas la sûreté de tous les ordonnancements réels. Avant toute activation, choisir une coordination des rédacteurs coopérants (par exemple un verrou d’origine lorsque disponible), une politique de génération, des notifications de conflit et une gestion des onglets anciens qui n’obéissent pas au protocole. Si cette coordination ne peut être garantie, ne pas autoriser une écriture concurrente silencieuse ; imposer un arrêt explicite et une résolution du conflit. Un autre onglet v1 peut continuer à modifier l’ancienne clé : détecter cette divergence et préserver les deux ensembles, sans fusion arbitraire.

Le plan ne nécessite aucune écriture IndexedDB : les mécaniques sont embarquées. Aucun engagement atomique entre IndexedDB et localStorage n’est supposé. Une fois un document v2 préparé, les mutations de bibliothèque ne doivent pas provoquer une recapture ou modifier ses règles. L’archivage des référentiels natifs antérieurs reste à décider avant leur évolution.

Politique de retour arrière : avant activation, rester sur v1 sans supprimer les artefacts récupérables. Après activation future et modifications v2, le v1 d’origine est une sauvegarde historique, pas une version à restaurer automatiquement. Le retour arrière doit exporter/préserver la v2 courante et demander un choix explicite ; une rétroconversion complète v2 vers v1 n’est pas implémentée et ne doit pas être présentée comme sans perte.

## Mesures de taille

Mesures exactes sur plans fictifs en mémoire. Le cumul UTF-16 estimé comprend source v1, récupération, cible v2 et leurs trois clés, pas les autres données du domaine, copies historiques ou rapports en mémoire.

| Scénario | v1 unités UTF-16 | Récupération unités | Cible v2 unités | Cible UTF-8 octets | Cumul UTF-16 estimé octets |
| --- | ---: | ---: | ---: | ---: | ---: |
| Brouillon aux sélections absentes | 537 | 800 | 4 208 | 4 264 | 11 462 |
| Natif simple | 550 | 809 | 10 956 | 11 027 | 25 002 |
| Natif riche | 932 | 1 231 | 97 850 | 98 259 | 200 398 |
| Liste de dix natifs riches | 9 331 | 10 746 | 976 414 | 980 504 | 1 993 354 |

Les captures ne sont pas réduites pour améliorer le volume. Les quotas réels et leur mode de comptage dépendent du navigateur. Avant P2.5c.2, vérifier le volume avec les données représentatives de l’utilisateur et toutes les autres clés ; mesurer aussi le pic mémoire des copies, rapports et empreintes. Un dictionnaire partagé ou une compression exigeraient une décision explicite et des exports autonomes, pas un changement caché dans cette étape.

## Tests, limites et autorisation de P2.5c.2

23 tests nouveaux : natif complet, brouillon, identifiants inconnus, choix et propriétés additionnelles, déterminisme, idempotence sans capture, champs réservés, versions futures, absence de réparations, conventions de choix malformées, capture falsifiée ou indisponible, incohérence v2/métier, listes mixtes et compteurs, doublons, originaux non mutés, données non JSON récupérables, source brute exacte, faux plans, quotas aux deux écritures, interruptions 0–6 et reprise, conflits sur les trois clés, v2 corrompu, échecs de relecture, absence d’accès localStorage/IndexedDB, typage séparé et tailles de listes complètes.

Vérifications finales exécutées : 240 tests réussis (217 antérieurs + 23 nouveaux), TypeScript application validé (`tsc -p tsconfig.app.json --noEmit --incremental false`), build Vite validé (`vite build --outDir /tmp/atelier-books-vite-check`), `git diff --check` et contrôle des espaces des nouveaux fichiers réussis. Le build conserve les mêmes 100 modules et le même artefact JavaScript applicatif, aucun nouveau module n’étant branché. Les tests P1 à P2.5b restent inclus. Les services et interfaces de P2.2/P2.3/P2.4 restent inchangés.

Conditions nécessaires avant autorisation de P2.5c.2 :

1. Valider le contrat v2, les captures partielles et la distinction préparation/complétude D&D.
2. Traiter explicitement les rejets, collisions de champ et doublons d’une sauvegarde réelle : aucune sauvegarde partielle de la liste acceptée sans préserver et résoudre les autres entrées.
3. Choisir et tester sur navigateur réel le protocole de coordination multi-onglets, génération, interruption et relecture.
4. Valider le quota disponible et le comportement sur échec sans purge automatique des brouillons.
5. Définir l’interface de bilan, récupération, reprise et retour arrière avec conservation des exports v1/v2.
6. Préserver les versions de référentiels/évaluateurs avant toute évolution native et spécifier les mécanismes d’export autonome nécessaires aux futures sorties Foundry/PDF.
7. Autoriser séparément l’adaptateur réel de stockage, le choix de lecture v2 et son branchement React. Aucun de ces travaux n’est commencé ici.

Les migrations ambiguës ou impossibles sans perte restent bloquées ; leurs originaux sont conservés. Aucun contournement des validations, aucun import sélectionnable, aucun changement des règles D&D, aucune migration automatique.

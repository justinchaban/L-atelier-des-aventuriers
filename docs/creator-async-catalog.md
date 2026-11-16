# P2.4 — Intégration asynchrone du catalogue au créateur

Statut : P2.4 validée par l’utilisateur après 198 tests automatisés et neuf vérifications manuelles réussies. Commit dédié autorisé ; aucun push, aucune P2.5.

## Fichiers et architecture

Créés :

- `src/services/creatorCatalogLoader.ts` : contrôleur de chargement, états et protection des réponses.
- `src/hooks/useCreatorCatalog.ts` : abonnement React et cycle de vie.
- `src/components/character/CharacterBuilderWorkspace.tsx` : frontière entre App et le créateur.
- `src/components/character/ImportedCreatorCatalog.tsx` : panneau de consultation sans sélection.
- `tests/creator-catalog-react.test.cjs` : douze tests P2.4 avec données fictives.
- `docs/creator-async-catalog.md` : ce document.

Modifiés :

- `src/app/App.tsx` : montage du workspace à la place du créateur seul.
- `src/styles/global.css` : styles du panneau et des détails consultables au clavier.
- `package.json`, `package-lock.json` : dépendance de développement `react-test-renderer` 19.3.1, alignée sur React installé, pour tester montage, effets, StrictMode et démontage. Aucune dépendance applicative ajoutée.

Les contrats, la projection et le service P2.3 restent inchangés. Le workspace monte le créateur existant avec ses props inchangées et un panneau séparé. Ce panneau ne reçoit ni personnage ni `onChange`. Les sélecteurs et moteurs mécaniques continuent à utiliser exclusivement le manifeste natif P2.2 ; le catalogue enrichi ne leur est jamais transmis.

## Chargement et états

`useCreatorCatalog` possède une instance du contrôleur par workspace. Le manifeste natif est disponible synchroniquement dès le premier rendu, sans créer de service ou ouvrir IndexedDB pendant le rendu. `useSyncExternalStore` propage les snapshots stables du contrôleur. L’effet démarre la lecture ; son nettoyage invalide la génération et ferme le lecteur. Le cycle nettoyage/redémarrage de StrictMode est pris en charge. La factory optionnelle est fixée pour la durée du montage et sert à l’injection de lecteurs dans les tests.

Chaque lecture utilise une nouvelle instance de `LibraryCreatorCatalogService`, avec sa base `existingOnly: true`. `load()` fournit le catalogue enrichi et les diagnostics P2.3. À la frontière de chargement, le résultat est contrôlé à l’exécution : contrat, tableaux, cohérence et diagnostics. Seules les entrées natives originales sont reconnues comme natives ; les autres entrées passent par la fusion défensive P2.3. Une fausse origine native est rejetée, et un import forgé avec ready/definition est neutralisé. Le manifeste natif contrôlé est toujours réinstallé comme source des entrées natives.

| État | Affichage et signification |
| --- | --- |
| `loading` | Lecture en cours, catalogue natif immédiat, `coherent: null` tant que le résultat est inconnu. |
| `ready` | Lecture cohérente avec au moins un import projeté ; cela ne rend aucun import sélectionnable. |
| `empty` | Lecture cohérente sans candidat importé projetable. Les diagnostics informatifs restent visibles, notamment pour les catégories hors contrat. |
| `error` | Erreur de stockage, résultat illisible, erreur globale bloquante ou `coherent: false`. Une projection partielle reste consultable avec ses diagnostics ; le natif reste disponible. |

`coherent`, les diagnostics globaux et les diagnostics de chaque candidat sont conservés. Les diagnostics des erreurs bloquantes sont repris avec le message d’échec. Une incohérence ne peut pas être affichée comme une lecture saine, même lorsque des candidats consultables sont présents.

Le bouton « Rafraîchir les imports » reste utilisable pendant un chargement. Chaque demande incrémente un numéro, ferme le lecteur précédent et remet uniquement la consultation importée à l’état loading. Seule la demande courante, sur un contrôleur encore actif, peut publier un succès ou une erreur. Une ancienne réponse, y compris un ancien rejet, est ignorée. Les imports précédents sont retirés pendant le rafraîchissement pour éviter de les présenter comme actuels. Les opérations de lecture déjà engagées peuvent se terminer après fermeture ; leur résultat est alors sans effet.

Aucun intervalle, écoute globale des imports ou changement automatique de révision n’est ajouté. Ouvrir à nouveau un créateur monte une nouvelle consultation. Changer de campagne ne relance pas le chargement : l’autorisation est recalculée au rendu depuis les livres de la campagne courante, sans capturer une ancienne campagne dans la promesse.

## Consultation et descriptions

Le panneau est affiché après le créateur et accessible à toutes ses étapes. Chaque contenu se consulte dans un élément details/summary : nom, catégorie, livre canonique, source originale, révision active, disponibilité, autorisation de campagne et diagnostics. Les champs absents sont indiqués comme non renseignés. Les diagnostics non rattachés sont visibles au niveau général.

La permission utilise `evaluateCreatorCandidateAccess` et les restrictions existantes. « Livre autorisé » signifie uniquement que le livre est autorisé par la campagne : chaque import reste explicitement non sélectionnable. Sans campagne, le même défaut XSRD que le créateur existant est appliqué. Une source inconnue exige toujours une autorisation explicite.

Aucun bouton de choix, callback de sélection, radio, checkbox ou identifiant mécanique importé n’est relié au personnage. Les origines malformées ne deviennent jamais natives par défaut.

La projection P2.3 ne fournit pas de description certifiée pour cet affichage. Chaque détail affiche donc le diagnostic « Description indisponible : son interprétation n’a pas été validée pour cette consultation. » Aucun cache mécanique ni original JSON n’est relu pour fabriquer une description. `EntryRenderer` n’est pas invoqué en l’absence d’un champ validé adapté ; sa réutilisation reste réservée à un futur contrat explicite. Aucun HTML d’import n’est rendu : les textes et diagnostics sont échappés par React. Des champs de métadonnées de diagnostic inattendus sont ramenés à un texte de remplacement.

## Stockage et préservation

Toutes les lectures passent par les transactions readonly P2.3. La création et les migrations sont refusées. Une base absente affiche donc une erreur explicite, sans schéma persisté ; elle n’est pas assimilée à une bibliothèque vide existante. Les outils existants de la Bibliothèque restent responsables de sa création lors d’une action volontaire.

Le contrôleur, le hook et le panneau n’accèdent pas à localStorage. Ils n’écrivent aucun magasin, ne lancent aucune conversion et ne changent ni révision active, ni personnage, ni campagne. Un chargement, un rafraîchissement ou un démontage ne déclenche aucun nettoyage de sélection. Le modèle Character et le format de sauvegarde restent inchangés. Le créateur reste à la même place dans le workspace pendant ses mises à jour : le changement d’état importé ne le remonte pas.

## Tests et limites

Douze nouveaux tests couvrent :

1. Natif immédiat, lecture lente, bibliothèque vide puis chargée.
2. Rafraîchissements concurrents : ancien succès et ancien rejet ignorés.
3. Incohérence et diagnostics globaux/locaux visibles avec maintien du natif.
4. Erreur IndexedDB puis reprise volontaire.
5. Candidats ready forgés, fausses origines natives et résultat de service illisible.
6. Textes de type HTML échappés, description non validée diagnostiquée, absence de mécanisme de choix importé.
7. Hook et workspace montés : changement de campagne pendant la lecture, rafraîchissement et brouillon incomplet strictement préservé, aucun onChange.
8. Démontage réel du hook : fermeture et réponse tardive sans nouveau rendu.
9. StrictMode : nettoyage/redémarrage et rejet de la réponse de l’ancien montage.
10. Chargement via le vrai service P2.3 sur fake-indexeddb : transactions readonly, magasins identiques et localStorage interdit, y compris au rafraîchissement.
11. Base absente : erreur et absence de création de schéma.
12. Créateur monté à l’étape Classe : mêmes boutons natifs pendant loading, error, ready et empty, sans modification des choix.

Les tests P1, P2.2 et P2.3 restent exécutés, notamment restauration atomique, personnages existants, stockage des brouillons, restrictions et instantané transactionnel cohérent pendant écriture concurrente.

Vérifications finales exécutées : 198 tests réussis (186 précédents + 12 P2.4), TypeScript application validé (`tsc -p tsconfig.app.json --noEmit --incremental false`), build Vite validé (`vite build --outDir /tmp/atelier-books-vite-check`), `git diff --check` et contrôle des espaces des nouveaux fichiers réussis. Le build est écrit hors du dépôt ; aucun artefact généré n’est ajouté.

Les montages React utilisent react-test-renderer, qui émet un avis de dépréciation ; les tests s’exécutent néanmoins sur la version React installée. Ils ne vérifient pas le DOM réel, le focus, la disposition ou le stockage d’un navigateur. fake-indexeddb simule les transactions ; le protocole navigateur reste nécessaire. Les annulations sont logiques, sans API d’abandon supplémentaire dans P2.3. Les listes sont affichées sans pagination et ne sont pas optimisées pour une bibliothèque très volumineuse. Les descriptions restent indisponibles tant qu’aucun contrat de consultation validé ne les expose.

## Protocole manuel navigateur

Utiliser un profil de test et uniquement des fixtures fictives. Conserver un export de ses données avant toute préparation volontaire des scénarios.

1. Sans base bibliothèque, ouvrir un personnage existant puis l’étape Classe : l’erreur importée doit être explicite, les classes natives accessibles, aucune base créée. Noter les choix et la valeur localStorage du personnage avant/après, sans enregistrer de modification volontaire.
2. Préparer une bibliothèque vide avec les outils existants, puis rouvrir le créateur : le panneau doit annoncer zéro contenu projetable. Importer `tests/fixtures/fictive-classes.json` depuis la Bibliothèque et revenir au créateur : les contenus fictifs doivent être consultables uniquement dans le panneau importé.
3. Déplier plusieurs contenus : vérifier nom, catégorie, livre canonique, source originale, révision, disponibilité, diagnostics et message de description indisponible. Aucun bouton de sélection importée ne doit exister.
4. Préparer deux campagnes de test aux livres autorisés différents. Changer de campagne puis consulter/rafraîchir : les permissions affichées doivent suivre la campagne courante, sans modifier le personnage ni ses sélections. Un livre inconnu non explicitement autorisé reste refusé.
5. Avec un lecteur lent dans un environnement de développement, lancer plusieurs rafraîchissements et résoudre la dernière lecture avant les anciennes. Seul le dernier résultat doit apparaître ; les classes natives restent consultables pendant l’attente. Les tests à promesses contrôlées reproduisent ce scénario sans délai arbitraire.
6. Sur une copie de test, préparer une archive et des incohérences avec les outils de diagnostic/scénarios fictifs existants. Vérifier l’état error, le signal de cohérence et les diagnostics généraux et locaux ; les entrées restantes et les classes natives doivent rester consultables.
7. En cours de chargement, quitter le créateur puis le rouvrir : aucun résultat de l’ancienne consultation ne doit apparaître. Vérifier l’absence d’erreur de mise à jour après démontage et la fermeture des connexions.
8. Avec un brouillon aux caractéristiques incomplètes et des choix personnalisés, naviguer entre étapes et rafraîchir plusieurs fois. Comparer personnage, choix et révisions actives avant/après : aucune modification. Vérifier également les parcours manuels P2.2 (styles, maîtrises, manœuvres, équipements) et les restrictions natives.
9. Après les préparations volontaires, comparer les quatre magasins IndexedDB et localStorage avant/après chargement et rafraîchissement : aucune écriture. Le bouton de rafraîchissement doit être utilisable au clavier, les détails dépliables et les erreurs visibles.

Les neuf vérifications manuelles ci-dessus ont été confirmées réussies par l’utilisateur. Aucune nouvelle exécution navigateur n’est revendiquée par l’agent lors de la préparation du commit.

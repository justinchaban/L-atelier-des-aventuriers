# P1.4a — Protocole de consultation dans un navigateur

Ce protocole est à exécuter sur le serveur Vite de développement, avec un profil
navigateur de test distinct de celui des personnages réels. Il ne demande aucun
fichier externe et n'ajoute aucun bouton d'import persistant.

## 1. Base vide et ouverture

1. Lancer `npm run dev` depuis le terminal habituel du projet.
2. Ouvrir l'adresse affichée par Vite. Conserver la même origine et le même port
   pendant tout le test.
3. Aller dans **Bibliothèque**. Le catalogue des livres et le panneau d'analyse
   JSON doivent toujours être présents.
4. Le nouveau panneau **Bibliothèque enregistrée** doit afficher brièvement son
   chargement, puis « Aucun contenu enregistré » dans un profil vierge.
5. Dans les outils développeur, onglet Application/Stockage, vérifier la base
   `atelier-aventuriers:library`, version 1, et les magasins imports, contents,
   revisions et dependencies. Cliquer sur l'actualisation des outils si nécessaire.

Attendu : aucun contenu embarqué n'a été ajouté à cette base. Les personnages
restent dans localStorage. La consultation ne lance aucune conversion ni écriture
métier (seule la première ouverture crée le schéma IndexedDB).

## 2. Préparer des contenus fictifs, sans nouvelle interface d'import

Dans la console de la page Vite, exécuter ce bloc. Il utilise uniquement la fixture
fictive déjà présente dans le dépôt, via le repository validé en P1.3.
Les chemins de modules et de fixtures ci-dessous sont réservés au serveur Vite de
développement. Ils sont résolus depuis la page pour respecter le sous-chemin Vite
`/L-atelier-des-aventuriers/` ; ce n'est pas une procédure pour le site publié.

```js
{
  const base = new URL('./', document.baseURI);
  const { LibraryRepository } = await import(new URL('src/services/libraryRepository.ts', base).href);
  const repository = new LibraryRepository();
  try {
    const response = await fetch(new URL('tests/fixtures/fictive-classes.json', base));
    if (!response.ok) throw new Error('Fixture fictive indisponible');
    const plan = await repository.prepareImport({
      text: await response.text(),
      filename: 'fictive-classes.json'
    });
    console.table(plan.decisions.map(d => ({
      action: d.kind, nom: 'identity' in d ? d.identity.normalizedName : '(sans identité)'
    })));
    if (plan.decisions.some(d => d.kind === 'update' || d.kind === 'conflict')) {
      throw new Error('État inattendu dans le profil de test : examiner le plan sans le confirmer');
    }
    console.log(await repository.commitImport(plan));
  } finally {
    repository.database.close();
  }
}
```

Revenir dans la page et cliquer sur **Actualiser la bibliothèque**.
Attendu : 7 contenus, dont 2 classes converties. Les autres catégories restent
conservées sans convertisseur autonome utilisable. Aucun import n'est proposé
automatiquement au créateur et aucun livre n'est autorisé dans une campagne.

## 3. Recherche, filtres et détails

- Rechercher « VEILLEUR » : retrouver les classes sans sensibilité à la casse.
- Filtrer par catégorie Classes et livre XPHB : une classe doit rester affichée.
- Filtrer par source FRHOF, sélectionner Plieur des brumes : afficher la source
  originale **FRHoF** et le livre canonique **FRHOF**.
- Consulter le nom du fichier, la description, le convertisseur et sa version.
- Déplier **Révision active et données enregistrées** : vérifier la révision,
  les dépendances et l'entrée JSON originale.
- Tester une recherche sans résultat puis remettre les filtres à « Tous ».
- Filtrer les statuts Archivés : aucun résultat dans cette fixture. Aucun bouton
  de suppression, archivage ou restauration ne doit apparaître.
- Vérifier l'usage au clavier des filtres, boutons et détails, ainsi que sur une
  fenêtre étroite : les JSON longs ne doivent pas élargir toute la page.

## 4. Persistance et retour dans la bibliothèque

1. Actualiser la page et retourner dans Bibliothèque : retrouver les 7 contenus.
2. Passer dans Espace Joueur puis revenir : les données sont relues.
3. Fermer puis rouvrir le navigateur avec le même profil et la même adresse :
   retrouver les contenus (hors effacement volontaire des données du site).

## 5. Plusieurs onglets

1. Ouvrir un second onglet sur exactement la même adresse et aller dans Bibliothèque.
2. Dans sa console, utiliser le même bloc que ci-dessus mais remplacer la lecture
   de fixture par une entrée originale fictive :

   ```js
   const plan = await repository.prepareImport({
     text: JSON.stringify({ feat: [{ name: 'Pli du second onglet', source: 'FICTIF' }] }),
     filename: 'second-onglet.json'
   });
   ```

   Conserver les contrôles et la confirmation du bloc précédent.
3. Revenir au premier onglet : le contenu doit apparaître après la reprise de focus.
4. Si le navigateur ne déclenche pas ce focus, cliquer sur Actualiser. La synchronisation
   n'est pas une diffusion temps réel ; les données sont relues à la consultation.
5. Vérifier la présence du livre inconnu FICTIF dans le filtre. Il ne doit pas être
   ajouté aux autorisations d'une campagne.

## 6. Conversion périmée

Dans la console, importer une modification fictive de la capacité PHB, avec accord
explicite sur le plan préparé :

```js
{
  const base = new URL('./', document.baseURI);
  const { LibraryRepository } = await import(new URL('src/services/libraryRepository.ts', base).href);
  const repository = new LibraryRepository();
  try {
    const response = await fetch(new URL('tests/fixtures/fictive-classes.json', base));
    const data = await response.json();
    const feature = data.classFeature.find(entry => entry.source === 'PHB');
    feature.entries = ['Description fictive modifiée pour le test de consultation.'];
    const plan = await repository.prepareImport({
      text: JSON.stringify({ classFeature: [feature] }), filename: 'capacite-modifiee.json'
    });
    console.table(plan.decisions);
    const acceptedUpdates = plan.decisions.filter(d => d.kind === 'update').map(d => d.identity.id);
    // Ce bloc constitue l'accord explicite sur cette modification fictive uniquement.
    console.log(await repository.commitImport(plan, { acceptedUpdates }));
  } finally { repository.database.close(); }
}
```

Actualiser la consultation : la classe PHB doit être **À reconvertir**, et sa révision
brute doit être restée inchangée. Aucun bouton de reconversion n'est encore présent.

## 7. Erreur de lecture / changement de version (profil jetable uniquement)

Pour vérifier versionchange dans de vrais onglets, uniquement dans le profil de test :

```js
{
  const request = indexedDB.open('atelier-aventuriers:library', 2);
  request.onblocked = () => console.log('Une autre connexion doit être fermée');
  request.onsuccess = () => { request.result.close(); console.log('Version de test passée à 2'); };
  request.onerror = () => console.error(request.error);
}
```

Les connexions du service doivent se fermer sur versionchange. Au retour sur la
page ou après Actualiser, la consultation doit afficher une erreur explicite,
sans liste vide trompeuse ni suppression des données.
Ce test rend volontairement la base du profil de test incompatible avec l'application
v1 : ne pas l'exécuter sur ses données réelles. Le service ne la réinitialise pas.
Les ouvertures bloquées et quotas simulés sont également couverts automatiquement ;
leur reproduction réelle dépend du navigateur et des autres connexions ouvertes.

## Résultats à relever

Noter navigateur/version, adresse, résultat de chaque section et éventuelles erreurs
console. Ce protocole est fourni pour validation manuelle ; il n'a pas été exécuté
par les tests Node/fake-indexeddb.

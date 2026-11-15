
import { useEffect, useState } from 'react';

import CharacterBuilder from '../components/character/CharacterBuilder';
import JoinCampaign from '../components/campaign/JoinCampaign';
import DMSettings from '../components/library/DMSettings';
import ContentImportPanel from '../components/content/ContentImportPanel';
import LibraryContentPanel from '../components/library/LibraryContentPanel';

import {
  books,
  normalizeBookIds
} from '../data/books';

import type { Character } from '../models/Character';

import {
  createCampaign,
  type Campaign
} from '../models/Campaign';

import {
  loadCharacters,
  saveCharacters
} from '../services/storage';

// ==========================================
// TYPES
// ==========================================

type AppSpace = 'player' | 'dm' | 'library';

// ==========================================
// CRÉATION D'UN PERSONNAGE
// ==========================================

function newCharacter(): Character {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: 'Nouvel aventurier',
    level: 1,
    speciesId: '',
    classId: '',
    backgroundId: '',

    abilities: {
      str: 8,
      dex: 8,
      con: 8,
      int: 8,
      wis: 8,
      cha: 8
    },

    choices: {},

    gameState: {
      currentHP: 1,
      temporaryHP: 0,
      usedHitDice: 0,
      usedSpellSlots: {},
      conditions: []
    }
  };
}

// ==========================================
// VALIDATION D'UNE CAMPAGNE
// ==========================================

function isValidCampaign(
  value: unknown
): value is Campaign {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.id === 'string' &&
    typeof data.name === 'string' &&
    typeof data.createdAt === 'string' &&
    Array.isArray(data.allowedBooks) &&
    data.allowedBooks.every(
      (id: unknown) => typeof id === 'string'
    )
  );
}

// ==========================================
// MIGRATION DES LIVRES D'UNE CAMPAGNE
// ==========================================

function migrateCampaignBooks(
  campaign: Campaign
): Campaign {
  const allowedBooks = normalizeBookIds(campaign.allowedBooks);

  return {
    ...campaign,
    allowedBooks
  };
}

// ==========================================
// CHARGEMENT D'UNE CAMPAGNE
// ==========================================

function loadCampaign(
  key: string
): Campaign | null {
  try {
    const saved = localStorage.getItem(key);

    if (!saved) {
      return null;
    }

    const parsed: unknown = JSON.parse(saved);

    if (!isValidCampaign(parsed)) {
      return null;
    }

    return migrateCampaignBooks(parsed);
  } catch {
    // Stockage indisponible ou données invalides.
  }

  return null;
}

// ==========================================
// APPLICATION
// ==========================================

export default function App() {
  // ----------------------------------------
  // PERSONNAGES
  // ----------------------------------------

  const [loadReport] = useState(loadCharacters);
  const [characters, setCharacters] = useState<Character[]>(loadReport.characters);
  const [saveError, setSaveError] = useState('');
  const [recoverySnapshots, setRecoverySnapshots] = useState<string[]>(
    () => [...new Set([
      ...loadReport.recoveryCopies,
      ...(loadReport.status === 'anomaly' && loadReport.originalData !== null ? [loadReport.originalData] : [])
    ])]
  );

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [message, setMessage] = useState('');

  // ----------------------------------------
  // NAVIGATION
  // ----------------------------------------

  const [libraryRefreshToken, setLibraryRefreshToken] = useState(0);

  const [activeSpace, setActiveSpace] =
    useState<AppSpace>('player');

  // ----------------------------------------
  // CAMPAGNE JOUEUR
  // ----------------------------------------

  const [joinedCampaign, setJoinedCampaign] =
    useState<Campaign | null>(
      () => loadCampaign('atelier-joined-campaign')
    );

  // ----------------------------------------
  // CAMPAGNE MJ
  // ----------------------------------------

  const [campaign, setCampaign] =
    useState<Campaign>(
      () =>
        loadCampaign('atelier-campaign') ??
        createCampaign()
    );

  // ========================================
  // SAUVEGARDE CAMPAGNE JOUEUR
  // ========================================

  useEffect(() => {
    try {
      if (joinedCampaign) {
        localStorage.setItem(
          'atelier-joined-campaign',
          JSON.stringify(joinedCampaign)
        );
      } else {
        localStorage.removeItem(
          'atelier-joined-campaign'
        );
      }
    } catch {
      setMessage(
        'Impossible de sauvegarder la campagne rejointe.'
      );
    }
  }, [joinedCampaign]);

  // ========================================
  // SAUVEGARDE CAMPAGNE MJ
  // ========================================

  useEffect(() => {
    try {
      localStorage.setItem(
        'atelier-campaign',
        JSON.stringify(campaign)
      );
    } catch {
      setMessage(
        'Impossible de sauvegarder la configuration MJ.'
      );
    }
  }, [campaign]);

  // ========================================
  // PERSONNAGE SÉLECTIONNÉ
  // ========================================

  const current = characters.find(
    character => character.id === selectedId
  );

  // ========================================
  // SAUVEGARDE PERSONNAGES
  // ========================================

  function update(next: Character[]) {
    setCharacters(next);

    const result = saveCharacters(next);
    if (result.originalData !== undefined) {
      const original = result.originalData;
      setRecoverySnapshots(previous => previous.includes(original) ? previous : [...previous, original]);
    }
    setSaveError(result.success ? '' : result.error ?? 'Sauvegarde impossible.');
  }

  // ========================================
  // MODIFICATION D'UN PERSONNAGE
  // ========================================

  function patch(
    partial: Partial<Character>
  ) {
    if (!current) {
      return;
    }

    update(
      characters.map(character =>
        character.id === current.id
          ? {
              ...character,
              ...partial
            }
          : character
      )
    );
  }

  // ========================================
  // CRÉATION D'UN PERSONNAGE
  // ========================================

  function create() {
    const character = newCharacter();

    update([
      ...characters,
      character
    ]);

    setSelectedId(character.id);
  }

  // ========================================
  // EXPORT DES PERSONNAGES
  // ========================================

  function exportOriginalData(raw: string, index: number) {
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `personnages-recuperation-${index + 1}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          characters,
          null,
          2
        )
      ],
      {
        type: 'application/json'
      }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download = 'mes-personnages.json';

    link.click();

    URL.revokeObjectURL(url);
  }

  // ========================================
  // NAVIGATION
  // ========================================

  function navigate(
    space: AppSpace
  ) {
    setActiveSpace(space);
    setSelectedId(null);
    setMessage('');
  }

  // ========================================
  // AFFICHAGE
  // ========================================

  return (
    <div className="shell">
      {/* EN-TÊTE */}
      <header className="top">
        <span className="crest">✦</span>

        <div>
          <small>
            DONJONS & DRAGONS · 2024 + COMPATIBILITÉ 2014
          </small>

          <h1>
            L'Atelier des Aventuriers
          </h1>
        </div>
      </header>

      {/* NAVIGATION */}
      <nav>
        <button
          type="button"
          className={
            activeSpace === 'player'
              ? 'active'
              : ''
          }
          onClick={() =>
            navigate('player')
          }
        >
          Espace Joueur
        </button>

        <button
          type="button"
          className={
            activeSpace === 'dm'
              ? 'active'
              : ''
          }
          onClick={() =>
            navigate('dm')
          }
        >
          Espace MJ
        </button>

        <button
          type="button"
          className={
            activeSpace === 'library'
              ? 'active'
              : ''
          }
          onClick={() =>
            navigate('library')
          }
        >
          Bibliothèque
        </button>
      </nav>

      <main>
        {/* Les alertes de persistance restent visibles pendant la navigation. */}
        {saveError && <p role="alert" className="warning">{saveError}</p>}
        {(loadReport.issues.length > 0 || recoverySnapshots.length > 0) && (
          <section className="panel" aria-label="Récupération des personnages">
            <h2>Sauvegarde des personnages : récupération</h2>
            {loadReport.issues.length > 0 && (
              <>
                <p role="alert">Des données nécessitent votre attention. Les entrées non exploitables restent dans les données originales ; seules les entrées exploitables sont proposées à la modification.</p>
                <ul>{loadReport.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
              </>
            )}
            <p>Aucune réparation n'est enregistrée au chargement. Avant de remplacer une sauvegarde présentant une anomalie, une copie originale doit être conservée et vérifiée.</p>
            {recoverySnapshots.map((raw, index) => (
              <button key={index} type="button" onClick={() => exportOriginalData(raw, index)}>
                Exporter les données originales — copie {index + 1}
              </button>
            ))}
          </section>
        )}
        {/* MESSAGES */}
        {message && (
          <p
            role="alert"
            className="warning"
          >
            {message}
          </p>
        )}

        {/* ESPACE JOUEUR */}
        {activeSpace === 'player' && (
          <>
            <JoinCampaign
              campaign={joinedCampaign}
              onJoin={setJoinedCampaign}
            />

            {!current ? (
              <section className="panel">
                <div className="section-title">
                  <div>
                    <small>
                      VOTRE CHRONIQUE
                    </small>

                    <h2>
                      Mes personnages
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="primary"
                    onClick={create}
                  >
                    + Nouveau personnage
                  </button>
                </div>

                <p className="muted">
                  Crée tes personnages et retrouve-les
                  à tout moment.
                </p>

                <div className="cards">
                  {characters.map(character => (
                    <button
                      type="button"
                      className="character-card"
                      key={character.id}
                      onClick={() =>
                        setSelectedId(
                          character.id
                        )
                      }
                    >
                      <strong>
                        {character.name}
                      </strong>

                      <span>
                        Niveau {character.level}
                        {' · '}
                        {character.speciesId ||
                          'Espèce non définie'}
                      </span>
                    </button>
                  ))}
                </div>

                {characters.length === 0 && (
                  <p className="muted">
                    Aucun personnage pour le moment.
                    Commence par créer ton premier
                    aventurier !
                  </p>
                )}

                <button
                  type="button"
                  onClick={exportData}
                  disabled={
                    !characters.length
                  }
                >
                  Exporter mes personnages (JSON)
                </button>
              </section>
            ) : (
              <CharacterBuilder
                character={current}
                campaign={joinedCampaign}
                onChange={patch}
                onClose={() =>
                  setSelectedId(null)
                }
              />
            )}
          </>
        )}

        {/* ESPACE MAÎTRE DU JEU */}
        {activeSpace === 'dm' && (
          <DMSettings
            campaign={campaign}
            onChange={setCampaign}
          />
        )}

        {/* BIBLIOTHÈQUE */}
        {activeSpace === 'library' && (
          <>
            <section
              className="panel"
              id="library"
            >
              <div className="section-title">
                <div>
                  <small>
                    CATALOGUE
                  </small>

                  <h2>
                    Bibliothèque générale
                  </h2>
                </div>
              </div>

              <p className="muted">
                Retrouvez les ouvrages référencés
                pour la création des personnages.
              </p>

              <div className="book-list">
                {books.map(book => (
                  <div key={book.id}>
                    <span>
                      {book.name}
                    </span>

                    <small>
                      {book.ruleset}
                      {' · '}
                      {book.integrated
                        ? 'Intégré'
                        : 'À intégrer'}
                    </small>
                  </div>
                ))}
              </div>
            </section>

            <LibraryContentPanel refreshToken={libraryRefreshToken} />

            <ContentImportPanel onImported={() => setLibraryRefreshToken(value => value + 1)} />
          </>
        )}
      </main>

      {/* PIED DE PAGE */}
      <footer>
        Prototype 0.1 · Sauvegarde locale
        sur cet appareil
        {' · '}
        Projet non affilié à Wizards
        of the Coast
      </footer>
    </div>
  );
}

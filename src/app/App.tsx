
import { useEffect, useState } from 'react';

import CharacterBuilder from '../components/character/CharacterBuilder';
import JoinCampaign from '../components/campaign/JoinCampaign';
import DMSettings from '../components/library/DMSettings';

import { books } from '../data/books';

import type { Character } from '../models/Character';
import {
  createCampaign,
  type Campaign
} from '../models/Campaign';

import {
  loadCharacters,
  saveCharacters
} from '../services/storage';

// Création d'un personnage
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

// Vérification des données d'une campagne
function isValidCampaign(value: unknown): value is Campaign {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.id === 'string' &&
    typeof data.name === 'string' &&
    typeof data.createdAt === 'string' &&
    Array.isArray(data.allowedBooks) &&
    data.allowedBooks.every(
      (id: unknown) =>
        typeof id === 'string' &&
        books.some(book => book.id === id)
    )
  );
}

// Chargement d'une campagne depuis le navigateur
function loadCampaign(key: string): Campaign | null {
  try {
    const saved = localStorage.getItem(key);

    if (!saved) {
      return null;
    }

    const parsed: unknown = JSON.parse(saved);

    if (isValidCampaign(parsed)) {
      return parsed;
    }
  } catch {
    // Stockage indisponible ou données invalides.
  }

  return null;
}

export default function App() {
  // Personnages
  const [characters, setCharacters] = useState<Character[]>(
    loadCharacters
  );

  const [selectedId, setSelectedId] = useState<string | null>(
    null
  );

  const [message, setMessage] = useState('');

  // Navigation
  const [activeSpace, setActiveSpace] = useState<
    'player' | 'dm'
  >('player');

  // Campagne rejointe par le joueur
  const [joinedCampaign, setJoinedCampaign] = useState<
    Campaign | null
  >(() => loadCampaign('atelier-joined-campaign'));

  // Campagne configurée par le MJ
  const [campaign, setCampaign] = useState<Campaign>(
    () => loadCampaign('atelier-campaign') ?? createCampaign()
  );

  // Sauvegarde de la campagne joueur
  useEffect(() => {
    try {
      if (joinedCampaign) {
        localStorage.setItem(
          'atelier-joined-campaign',
          JSON.stringify(joinedCampaign)
        );
      } else {
        localStorage.removeItem('atelier-joined-campaign');
      }
    } catch {
      setMessage(
        'Impossible de sauvegarder la campagne rejointe.'
      );
    }
  }, [joinedCampaign]);

  // Sauvegarde de la campagne MJ
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

  // Personnage actuellement sélectionné
  const current = characters.find(
    character => character.id === selectedId
  );

  // Sauvegarde des personnages
  function update(next: Character[]) {
    setCharacters(next);

    if (!saveCharacters(next)) {
      setMessage(
        'Sauvegarde impossible : exportez vos données avant de quitter.'
      );
    } else {
      setMessage('');
    }
  }

  // Modification du personnage actuel
  function patch(partial: Partial<Character>) {
    if (!current) {
      return;
    }

    update(
      characters.map(character =>
        character.id === current.id
          ? { ...character, ...partial }
          : character
      )
    );
  }

  // Nouveau personnage
  function create() {
    const character = newCharacter();

    update([...characters, character]);
    setSelectedId(character.id);
  }

  // Export des personnages
  function exportData() {
    const blob = new Blob(
      [JSON.stringify(characters, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'mes-personnages.json';
    link.click();

    URL.revokeObjectURL(url);
  }

  // Navigation entre les espaces
  function navigate(space: 'player' | 'dm') {
    setActiveSpace(space);
    setSelectedId(null);
  }

  return (
    <div className="shell">
      {/* EN-TÊTE */}
      <header className="top">
        <span className="crest">✦</span>

        <div>
          <small>
            DONJONS & DRAGONS · 2024 + COMPATIBILITÉ 2014
          </small>

          <h1>L'Atelier des Aventuriers</h1>
        </div>
      </header>

      {/* NAVIGATION */}
      <nav>
        <button
          type="button"
          onClick={() => navigate('player')}
        >
          Espace Joueur
        </button>

        <button
          type="button"
          onClick={() => navigate('dm')}
        >
          Espace MJ
        </button>

        <button
          type="button"
          onClick={() =>
            document.getElementById('library')?.scrollIntoView({
              behavior: 'smooth'
            })
          }
        >
          Bibliothèque
        </button>
      </nav>

      <main>
        {/* MESSAGES */}
        {message && (
          <p role="alert" className="warning">
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
                    <small>VOTRE CHRONIQUE</small>
                    <h2>Mes personnages</h2>
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
                        setSelectedId(character.id)
                      }
                    >
                      <strong>{character.name}</strong>

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
                    Commence par créer ton premier aventurier !
                  </p>
                )}

                <button
                  type="button"
                  onClick={exportData}
                  disabled={!characters.length}
                >
                  Exporter mes personnages (JSON)
                </button>
              </section>
            ) : (
              <CharacterBuilder
                character={current}
                campaign={joinedCampaign}
                onChange={patch}
                onClose={() => setSelectedId(null)}
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
        <section className="panel" id="library">
          <small>CATALOGUE</small>

          <h2>Bibliothèque générale</h2>

          <p className="muted">
            Ouvrages référencés pour la création
            des personnages.
          </p>

          <div className="book-list">
            {books.map(book => (
              <div key={book.id}>
                <span>{book.name}</span>

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
      </main>

      {/* PIED DE PAGE */}
      <footer>
        Prototype 0.1 · Sauvegarde locale sur cet appareil
        {' · '}
        Projet non affilié à Wizards of the Coast
      </footer>
    </div>
  );
}

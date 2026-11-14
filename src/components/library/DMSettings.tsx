import { useState } from 'react';
import {
  generateCampaignCode,
  importCampaignCode
} from '../../services/campaignCode';
import { books } from '../../data/books';
import type { Campaign } from '../../models/Campaign';

interface Props {
  campaign: Campaign;
  onChange: (campaign: Campaign) => void;
}

export default function DMSettings({
  campaign,
  onChange
}: Props) {

  function toggleBook(bookId: string) {
    const allowed = campaign.allowedBooks.includes(bookId);

    const allowedBooks = allowed
      ? campaign.allowedBooks.filter(id => id !== bookId)
      : [...campaign.allowedBooks, bookId];

    onChange({
      ...campaign,
      allowedBooks
    });
  }
  const [importCode, setImportCode] = useState('');
const [feedback, setFeedback] = useState('');

async function copyCampaignCode() {
  try {
    await navigator.clipboard.writeText(
      generateCampaignCode(campaign)
    );
    setFeedback('Code copié dans le presse-papiers.');
  } catch {
    setFeedback('Copie impossible. Sélectionne le code manuellement.');
  }
}

function applyCampaignCode() {
  try {
    const imported = importCampaignCode(importCode);
    onChange(imported);
    setImportCode('');
    setFeedback('Campagne importée avec succès.');
  } catch (error) {
    setFeedback(
      error instanceof Error ? error.message : 'Code invalide.'
    );
  }
}

  return (
    <section className="panel" id="dm-settings">
      <small>CONFIGURATION DU MAÎTRE DU JEU</small>
      <h2>Livres autorisés</h2>

      <label>
        Nom de la campagne
        <input
          value={campaign.name}
          onChange={e =>
            onChange({
              ...campaign,
              name: e.target.value
            })
          }
        />
      </label>

      <div className="book-list">
        {books.map(book => (
          <label key={book.id}>
            <input
              type="checkbox"
              checked={campaign.allowedBooks.includes(book.id)}
              onChange={() => toggleBook(book.id)}
            />

            <span>{book.name}</span>
            <small>
              {book.ruleset}
              {' · '}
              {book.integrated ? 'Intégré' : 'À intégrer'}
            </small>
          </label>
        ))}
      </div>

<div className="campaign-sharing">
  <h3>Partager la campagne</h3>

  <p className="muted">
    Copie ce code pour transmettre les livres autorisés
    à tes joueurs.
  </p>

  <textarea
    aria-label="Code de campagne à partager"
    readOnly
    value={generateCampaignCode(campaign)}
    rows={4}
  />

  <button type="button" onClick={copyCampaignCode}>
    Copier le code
  </button>

  <h3>Importer une campagne</h3>

  <textarea
    aria-label="Code de campagne à importer"
    placeholder="Colle ici le code transmis par ton MJ..."
    value={importCode}
    onChange={e => setImportCode(e.target.value)}
    rows={4}
  />

  <button
    type="button"
    onClick={applyCampaignCode}
    disabled={!importCode.trim()}
  >
    Importer le code
  </button>

  {feedback && <p role="status">{feedback}</p>}
</div>

    </section>
  );
}

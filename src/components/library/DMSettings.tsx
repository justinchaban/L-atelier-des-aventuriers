import { isBookAllowed } from '../../engine/restrictions';

import { useState } from 'react';

import { books, normalizeBookId, normalizeBookIds } from '../../data/books';
import type { Campaign } from '../../models/Campaign';
import { generateCampaignCode } from '../../services/campaignCode';

interface Props {
  campaign: Campaign;
  onChange: (campaign: Campaign) => void;
}

export default function DMSettings({
  campaign,
  onChange
}: Props) {
  const [feedback, setFeedback] = useState('');

  function toggleBook(bookId: string) {
    const allowed = isBookAllowed(bookId, campaign.allowedBooks);

    const allowedBooks = allowed
      ? campaign.allowedBooks.filter(id => normalizeBookId(id) !== normalizeBookId(bookId))
      : [...campaign.allowedBooks, bookId];

    onChange({
      ...campaign,
      allowedBooks: normalizeBookIds(allowedBooks)
    });

    setFeedback('');
  }

  async function copyCampaignCode() {
    try {
      await navigator.clipboard.writeText(
        generateCampaignCode(campaign)
      );

      setFeedback('Code copié dans le presse-papiers.');
    } catch {
      setFeedback(
        'Copie impossible. Sélectionne le code manuellement.'
      );
    }
  }

  return (
    <section className="panel" id="dm-settings">
      <small>ESPACE MAÎTRE DU JEU</small>
      <h2>Configuration de campagne</h2>

      <label>
        Nom de la campagne
        <input
          value={campaign.name}
          onChange={e => {
            onChange({
              ...campaign,
              name: e.target.value
            });
            setFeedback('');
          }}
        />
      </label>

      <h3>Livres autorisés</h3>

      <div className="book-list">
        {books.map(book => (
          <label key={book.id}>
            <input
              type="checkbox"
              checked={isBookAllowed(book.id, campaign.allowedBooks)}
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
          Transmets ce code à tes joueurs pour leur
          communiquer les livres autorisés.
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

        {feedback && <p role="status">{feedback}</p>}
      </div>
    </section>
  );
}

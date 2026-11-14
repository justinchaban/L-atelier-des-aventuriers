
import { useState } from 'react';

import type { Campaign } from '../../models/Campaign';
import { importCampaignCode } from '../../services/campaignCode';
import { books } from '../../data/books';

interface Props {
  campaign: Campaign | null;
  onJoin: (campaign: Campaign) => void;
}

export default function JoinCampaign({
  campaign,
  onJoin
}: Props) {
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState('');

  function joinCampaign() {
    try {
      const imported = importCampaignCode(code);

      onJoin(imported);
      setCode('');
      setFeedback('Campagne rejointe avec succès.');
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Code de campagne invalide.'
      );
    }
  }

  return (
    <section className="panel">
      <small>ESPACE JOUEUR</small>
      <h2>Rejoindre une campagne</h2>

      <p className="muted">
        Ton Maître du Jeu t'a transmis un code ?
        Colle-le ci-dessous pour récupérer les
        livres autorisés dans sa campagne.
      </p>

      <textarea
        aria-label="Code de campagne"
        placeholder="Colle ici le code de ton MJ..."
        value={code}
        onChange={e => setCode(e.target.value)}
        rows={4}
      />

      <button
        className="primary"
        type="button"
        disabled={!code.trim()}
        onClick={joinCampaign}
      >
        Rejoindre la campagne
      </button>

      {feedback && <p role="status">{feedback}</p>}

      {campaign && (
        <div className="campaign-summary">
          <h3>Campagne actuelle : {campaign.name}</h3>

          <p>Livres autorisés :</p>

          <ul>
            {campaign.allowedBooks.map(id => {
              const book = books.find(b => b.id === id);

              return (
                <li key={id}>
                  {book?.name ?? id}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

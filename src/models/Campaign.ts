
export interface Campaign {
  id: string;
  name: string;
  allowedBooks: string[];
  createdAt: string;
}

export function createCampaign(): Campaign {
  return {
    id: crypto.randomUUID(),
    name: 'Nouvelle campagne',
    allowedBooks: ['srd-5.2.1'],
    createdAt: new Date().toISOString()
  };
}

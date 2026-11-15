
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
    allowedBooks: ['XSRD'],
    createdAt: new Date().toISOString()
  };
}

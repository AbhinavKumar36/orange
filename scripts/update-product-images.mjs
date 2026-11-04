import fetch from 'node-fetch';

const SUPABASE_URL = 'https://pdosvzdkuulstvzqfnkl.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkb3N2emRrdXVsc3R2enFmbmtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzUyODM4MiwiZXhwIjoyMTA5MTA0MzgyfQ.zQeqzGhSs0gCBCCqUiCwNL8CQRMqSXf-Q2urNwdLbxs';

const updates = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    image_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80',
    description: '70% Belgian dark chocolate sponge with silky ganache. In-store ready to sell.'
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    image_url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80',
    description: 'Pure Valencia orange juice cold-pressed and bottled, chilled and ready in display counter.'
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    image_url: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=800&q=80',
    description: 'Assorted roasted hazelnut and almond pralines in luxury presentation box. Ready to collect.'
  },
  {
    id: 'c8b068d8-7134-4c99-9976-4b2a81421a5b',
    image_url: 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=800&q=80',
    description: 'Classic velvety sponge with rich cream cheese frosting. Ready in display counter.'
  },
  {
    id: '9c9a3727-62c8-415f-b9eb-3375e108a6da',
    image_url: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=800&q=80',
    description: 'Chilled sparkling refreshment ready for instant counter handover.'
  },
  {
    id: '6a7f1000-188a-467f-8cee-2b655db356e0',
    image_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80',
    description: 'Seasonal Alphonso mango layered sponge cake with fresh mango glaze. Ready to sell.'
  },
  {
    id: '140d8f79-1a86-42be-8aae-6748195b6b0d',
    image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
    description: 'Decadent dark chocolate truffles with dusted cocoa. Chilled in confectionery vitrine.'
  }
];

async function updateAll() {
  for (const item of updates) {
    const res = await globalThis.fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${item.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        image_url: item.image_url,
        description: item.description
      })
    });
    console.log(item.id, 'status:', res.status);
  }
}
updateAll();

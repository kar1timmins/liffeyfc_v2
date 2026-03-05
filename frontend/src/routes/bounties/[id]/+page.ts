import { PUBLIC_API_URL } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Disable SSR so the load function runs in the browser only.
// PUBLIC_API_URL (http://localhost:3000) is reachable from the browser via
// Docker's port mapping but not from the frontend container itself during SSR.
export const ssr = false;

export const load: PageLoad = async ({ params, fetch }) => {
  const id = params.id;

  const [bountyRes, contributorsRes] = await Promise.all([
    fetch(`${PUBLIC_API_URL}/bounties/${id}`),
    fetch(`${PUBLIC_API_URL}/bounties/${id}/contributors`)
  ]);

  const bountyData = await bountyRes.json();
  const contributorsData = await contributorsRes.json();

  if (!bountyData.success) {
    throw error(404, bountyData.message || 'Bounty not found');
  }

  return {
    bounty: bountyData.data,
    contributors: contributorsData.success ? (contributorsData.data || []) : [],
    bountyId: id
  };
};

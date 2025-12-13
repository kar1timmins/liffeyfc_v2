**Toast UI Improvements — Contract Deployment**

Summary
- Replaced overlapping success/info toast pair (created when deploying escrow contracts) with a single "rich" toast that includes:
  - Campaign name and description
  - Per-chain contract addresses (Ethereum Sepolia / Avalanche Fuji)
  - Copy-to-clipboard and Explorer links for each address
  - Dismiss control and a grouped behavior so repeated deployments replace the previous toast

Files changed
- `frontend/src/lib/stores/toast.ts` — extended `Toast` type with optional `group` and `data`; `add()` will replace existing toasts with the same `group`.
- `frontend/src/lib/components/Toast.svelte` — rich toast rendering for contract data (addresses, copy, explorer links); nicer visuals and dismiss button.
- `frontend/src/lib/components/WishlistForm.svelte` — emits one grouped rich toast on contract deploy instead of two separate toasts.
- `frontend/src/lib/components/CreateBountyModal.svelte` — shows grouped rich toast on success and added copy buttons in the success modal.

Behavior notes
- The rich toast uses `group: 'contract_deploy'` so subsequent deployments will replace the previous toast instead of stacking.
- TTL for contract deploy toasts is 12s (adjustable in `WishlistForm.svelte` / `CreateBountyModal.svelte`).

How to test
1. Open the app and create a wishlist item with "Enable escrow" checked.
2. Deploy to one or both testnets.
3. Observe a single rich toast (bottom-right) with addresses, copy and Explorer actions.

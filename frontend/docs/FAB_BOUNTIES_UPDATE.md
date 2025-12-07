# Bounties Navigation Update

## Summary

Added the Bounties link to the FAB (Floating Action Button) navigation menu with access control that only shows the link to authenticated users who have registered at least one business.

## Changes Made

### 1. Updated `/frontend/src/routes/+layout.svelte`

#### Imports
- Added `Target` icon from `lucide-svelte` for the Bounties button
- Added `PUBLIC_API_URL` import for API calls

#### State Management
```typescript
// User companies state for bounties access control
let userCompanies = $state<any[]>([]);
let companiesFetched = $state(false);
```

#### API Integration
```typescript
// Fetch user's companies to determine bounties access
async function fetchUserCompanies() {
  if (!$authStore.isAuthenticated || companiesFetched) return;
  
  try {
    const response = await fetch(`${PUBLIC_API_URL}/companies/my-companies`, {
      headers: { Authorization: `Bearer ${$authStore.accessToken}` },
      credentials: 'include',
    });
    
    if (response.ok) {
      const result = await response.json();
      userCompanies = result.data || [];
      companiesFetched = true;
    }
  } catch (error) {
    console.error('Failed to fetch user companies:', error);
  }
}
```

#### Reactive Effect
```typescript
// Reactive effect to fetch companies when auth state changes
$effect(() => {
  if ($authStore.isAuthenticated && !companiesFetched) {
    fetchUserCompanies();
  } else if (!$authStore.isAuthenticated) {
    // Reset companies when logged out
    userCompanies = [];
    companiesFetched = false;
  }
});
```

#### FAB Navigation Button
```svelte
{#if userCompanies.length > 0}
  <button 
    class="btn glass-fab btn-neon-cool w-full mb-2 flex items-center justify-center gap-2.5 md:gap-3 border-0 hover:scale-105 transition-all duration-300 text-xs sm:text-sm md:text-base" 
    onclick={() => navTo('/bounties')}
  >
    <Target size={16} class="flex-shrink-0 w-4 h-4 sm:w-[17px] sm:h-[17px] md:w-[18px] md:h-[18px]"/> 
    <span class="flex-1 text-center">Bounties</span>
  </button>
{/if}
```

## Access Control Logic

### Visibility Requirements
The Bounties link is only visible when:
1. **User is authenticated**: `$authStore.isAuthenticated === true`
2. **User has companies**: `userCompanies.length > 0`

### Data Flow
1. **On mount**: If user is authenticated, fetch their companies
2. **On auth change**: Reactive effect monitors `$authStore.isAuthenticated`
   - When user logs in → fetch companies
   - When user logs out → reset companies array and flag
3. **On render**: FAB checks `userCompanies.length > 0` before showing link

## User Experience

### For Users Without Companies
- FAB shows: Home, Companies, Dashboard, Profile, Sign Out
- Bounties link is **hidden**
- No indication that bounties feature exists

### For Users With Companies
- FAB shows: Home, Companies, **Bounties**, Dashboard, Profile, Sign Out
- Bounties link appears after Companies button
- Target icon (🎯) indicates crowdfunding/goal-oriented feature
- Clicking navigates to `/bounties` page

### Mobile Optimization
- Button uses responsive sizing classes
- Icon sizes: 16px base, scales with screen size
- Full width button for easy touch targets
- Smooth hover scale animation (105%)

## Technical Details

### API Endpoint Used
- **Endpoint**: `GET /companies/my-companies`
- **Authentication**: JWT Bearer token in Authorization header
- **Response**: `{ success: true, data: Company[] }`

### Performance Considerations
- Companies fetched once per login session (`companiesFetched` flag)
- Reactive effect prevents duplicate fetches
- No companies fetch on logout (immediate reset)
- Lazy loading: Only fetches when user authenticates

### Error Handling
- Failed API calls log to console
- Graceful degradation: Link simply won't appear if fetch fails
- No user-facing error for this non-critical feature

## Testing Checklist

### User Without Company
- [ ] Sign in as user without registered business
- [ ] Open FAB navigation menu
- [ ] Verify Bounties link does **not** appear
- [ ] Should see: Home, Companies, Dashboard, Profile, Sign Out

### User With Company
- [ ] Sign in as user (or register business while logged in)
- [ ] Open FAB navigation menu
- [ ] Verify Bounties link **appears** after Companies
- [ ] Verify Target icon is displayed
- [ ] Click Bounties link
- [ ] Should navigate to `/bounties` page

### Auth State Changes
- [ ] Start logged out
- [ ] Log in (bounties link should appear if has company)
- [ ] Log out (bounties link should disappear)
- [ ] Log in again (bounties link should reappear)

### Mobile Responsive
- [ ] Test on mobile viewport (< 768px)
- [ ] Verify button is full width
- [ ] Verify icon and text are properly sized
- [ ] Verify touch target is adequate (> 44px height)

### Company Registration Flow
- [ ] Log in as new user (no companies)
- [ ] Verify Bounties link is hidden
- [ ] Navigate to companies and create new company
- [ ] Return to dashboard or home
- [ ] Open FAB menu
- [ ] **Note**: May need to refresh page or trigger re-fetch
  - Current implementation only fetches on auth state change
  - May need to add event listener or store for company creation

## Future Enhancements

### Real-time Company Updates
Consider adding event bus or store to notify layout when company is created/deleted:
```typescript
// In company creation success handler
window.dispatchEvent(new CustomEvent('company-updated'));

// In +layout.svelte
onMount(() => {
  window.addEventListener('company-updated', () => {
    companiesFetched = false; // Force re-fetch
    fetchUserCompanies();
  });
});
```

### Caching Strategy
For production, consider caching companies in localStorage:
```typescript
const cachedCompanies = localStorage.getItem('user-companies');
if (cachedCompanies) {
  userCompanies = JSON.parse(cachedCompanies);
}
```

### Loading State
Add loading indicator while fetching companies:
```typescript
let loadingCompanies = $state(false);

// In FAB
{#if loadingCompanies}
  <div class="w-full mb-2 text-center text-xs">Loading...</div>
{:else if userCompanies.length > 0}
  <!-- Bounties button -->
{/if}
```

## Related Files

- **Frontend Navigation**: `/frontend/src/routes/+layout.svelte`
- **Bounties Listing**: `/frontend/src/routes/bounties/+page.svelte`
- **Bounties Detail**: `/frontend/src/routes/bounties/[id]/+page.svelte`
- **Companies API**: `/backend/src/companies/companies.controller.ts`
- **Auth Store**: `/frontend/src/lib/stores/auth.ts`

## Documentation References

- Main bounties documentation: `/BOUNTIES_IMPLEMENTATION.md`
- Bounties API reference: `/backend/docs/BOUNTIES_API.md`
- Quick start guide: `/BOUNTIES_QUICKSTART.md`
- Latest update summary: `/BOUNTIES_UPDATE.md`

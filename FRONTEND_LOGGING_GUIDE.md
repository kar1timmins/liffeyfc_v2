# Frontend Components - Update Guide for Production Logging

## Quick Migration Guide

### Option 1: Simple Replacement (Recommended for most cases)

Replace direct `console.log()` calls with conditional logging from `$lib/env`:

```typescript
// OLD - Always logs
console.log('Debug info', data);

// NEW - Only logs in development
import { devLog } from '$lib/env';
devLog('Debug info', data);
```

### Option 2: Use Logger Object (For components with multiple logs)

```typescript
import { createLogger } from '$lib/env';
const logger = createLogger('ComponentName');

// In code
logger.log('Regular log');      // Dev only
logger.warn('Warning');         // Always
logger.error('Error');          // Always
logger.debug('Debug info');     // Dev only
```

## Files Needing Updates

### Components with console.log calls:
- `src/routes/bounties/[id]/+page.svelte` - 1 log
- `src/lib/components/SendFunds.svelte` - 9 logs
- `src/routes/+layout.svelte` - 2 logs
- `src/lib/components/WishlistForm.svelte` - 12 logs
- `src/lib/components/GenerateWalletModal.svelte` - 1 log
- `src/lib/components/CompanyManager.svelte` - 1 log

### Components with console.error calls (keep as-is, they're critical):
- Various error logging (should remain always-visible)

## Update Pattern

### Example 1: SendFunds.svelte
```typescript
// At top of component
import { devLog, devError } from '$lib/env';

// In code, replace:
console.log('Wallet addresses loaded:', userWalletAddress);
// With:
devLog('Wallet addresses loaded:', userWalletAddress);
```

### Example 2: WishlistForm.svelte
```typescript
// At top of component
import { createLogger } from '$lib/env';
const logger = createLogger('WishlistForm');

// In code, replace:
console.log('📊 Chainlink prices loaded:', { ethEurRate, avaxEurRate });
// With:
logger.log('📊 Chainlink prices loaded:', { ethEurRate, avaxEurRate });

// For errors (keep always visible):
console.error('Failed to fetch crypto prices, using defaults:', err);
// Keep as-is or use:
logger.error('Failed to fetch crypto prices, using defaults:', err);
```

## Available Helpers from $lib/env

```typescript
import { 
  devLog,      // Development-only logging
  devWarn,     // Warning (always shown)
  devError,    // Error (always shown)
  createLogger // Creates logger object with all methods
} from '$lib/env';

// Simple functions
devLog('message', data);
devWarn('warning');
devError('error');

// Logger object
const logger = createLogger('Namespace');
logger.log('msg');
logger.info('info');
logger.warn('warn');
logger.error('error');
logger.debug('debug');
```

## Priority Order (if updating one file)

1. **WishlistForm.svelte** - Most logs (12)
2. **SendFunds.svelte** - Important wallet logs (9)
3. **+layout.svelte** - Auth/company logs (2)
4. **Bounties [id]/+page.svelte** - 1 log
5. **GenerateWalletModal.svelte** - 1 log
6. **CompanyManager.svelte** - 1 log

## Testing Changes

After updating a component:
```bash
# Logs shown
NODE_ENV=development npm run dev

# Logs hidden
NODE_ENV=production npm run build
```

## Notes

- Error logs (🔴/❌) are ALWAYS shown, even in production
- Warning logs (⚠️) are ALWAYS shown
- Info/debug logs only in development
- Keep console.error() for critical failures
- Use devLog/logger.log() for debugging
- No need to wrap console.error() calls - they're already visible

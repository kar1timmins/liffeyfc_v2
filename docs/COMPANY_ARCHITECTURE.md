# Company/Business Architecture

## Overview

The Liffey Founders Club platform properly separates user authentication/profile data from business/company information, allowing users to register and manage multiple companies.

## Database Schema

### Users Table (`users`)
Stores user authentication, profile, and role-specific information.

**Core Fields:**
- `id` (UUID) - Primary key
- `email` - Unique email for authentication
- `passwordHash` - Hashed password
- `name` - User's display name
- `profilePhotoUrl` - GCP Storage path to profile photo
- `role` - ENUM: 'user', 'investor', 'staff'

**Investor-Specific Fields:**
- `investorCompany` - VC firm or investment company
- `investmentFocus` - Investment focus areas
- `isAccredited` - Accredited investor status
- `linkedinUrl` - LinkedIn profile

**Staff-Specific Fields:**
- `department` - Staff department
- `phoneNumber` - Contact number

**Relationships:**
- `wallets` - OneToMany with Wallet (for Web3 authentication)
- `refreshTokens` - OneToMany with RefreshToken (for JWT auth)
- `companies` - OneToMany with Company (users can own multiple companies)

### Companies Table (`companies`)
Stores complete business/company information. **Each user can register multiple companies.**

**Fields:**
- `id` (UUID) - Primary key
- `ownerId` (UUID) - Foreign key to users table
- `name` - Company name
- `description` - Company description
- `industry` - Industry/sector
- `website` - Company website URL
- `employeeCount` - Number of employees
- `stage` - ENUM: 'idea', 'mvp', 'early_stage', 'growth', 'scale', 'established'
- `fundingStage` - ENUM: 'bootstrapped', 'pre_seed', 'seed', 'series_a', 'series_b', 'series_c_plus'
- `location` - Geographic location
- `foundedDate` - Date company was founded
- `logoUrl` - GCP Storage path to company logo
- `linkedinUrl` - Company LinkedIn page
- `twitterUrl` - Company Twitter/X handle
- `tags` - Array of searchable tags
- `isActive` - Soft delete flag
- `isPublic` - Public visibility toggle

**Relationships:**
- `owner` - ManyToOne with User
- `wishlistItems` - OneToMany with WishlistItem

### Wishlist Items Table (`wishlist_items`)
Stores company wishlist entries (needs/wants for each company).

**Fields:**
- `id` (UUID) - Primary key
- `companyId` (UUID) - Foreign key to companies table
- `title` - Wishlist item title
- `description` - Detailed description
- `category` - ENUM: 'funding', 'talent', 'mentorship', 'partnerships', 'resources', 'technology', 'marketing', 'other'
- `priority` - ENUM: 'low', 'medium', 'high', 'critical'
- `isFulfilled` - Completion status

**Relationships:**
- `company` - ManyToOne with Company

## API Endpoints

### Company Management
- `POST /companies` - Create new company (authenticated)
- `GET /companies` - List all public companies (with filters)
- `GET /companies/:id` - Get company details
- `GET /companies/my-companies` - Get current user's companies
- `PATCH /companies/:id` - Update company (owner only)
- `DELETE /companies/:id` - Delete company (owner only)

### Wishlist Management
- `POST /companies/:id/wishlist` - Add wishlist item
- `GET /companies/:id/wishlist` - Get company wishlist
- `PATCH /companies/:companyId/wishlist/:itemId` - Update wishlist item
- `DELETE /companies/:companyId/wishlist/:itemId` - Delete wishlist item

## Security & Data Privacy

### User Data Sanitization

The system implements two levels of user data exposure:

**1. Sanitized User (Public/Limited Access)**
```typescript
{
  id: string;
  name: string | null;
  profilePhotoUrl?: string;
  role: UserRole;
  linkedinUrl?: string;
  createdAt: Date;
}
```

**2. Full User Profile (Authenticated User Only)**
```typescript
{
  ...SanitizedUser,
  email: string | null;
  investorCompany?: string;
  investmentFocus?: string;
  isAccredited: boolean | null;
  phoneNumber?: string;
  wallets: any[];
  updatedAt: Date;
  userType: string;
}
```

**Removed from Public Responses:**
- Email address
- Password hash
- Provider information (OAuth)
- Provider ID
- Phone number
- isActive status
- Department
- All authentication tokens

### Company Owner Privacy

When companies are returned via API:
- Owner information is automatically sanitized
- Only public-safe owner fields are included
- Email and sensitive user data is removed from company.owner

## Frontend Integration

### Profile Page
- `CompanyManager.svelte` - Register/edit/delete companies
- Users can manage multiple companies from their profile
- Each company has its own registration form

### Companies Directory
- `/companies` - Browse all public companies
- `/companies/[id]` - Individual company detail pages
- Company cards display owner name (sanitized)

### Dashboard
- Shows user profile with GCP Storage avatar
- Displays user role and status
- No company fields (moved to separate Companies section)

## Migration History

1. **Initial Companies Schema** (`create-companies-and-wishlist`) - Created companies and wishlist_items tables
2. **Remove Deprecated Fields** (`remove-deprecated-company-fields-from-users`) - Removed companyName, companyWebsite, industry from users table

## Best Practices

✅ **Proper Separation of Concerns**
- User authentication/profile in `users` table
- Business information in `companies` table
- One user → many companies relationship

✅ **Data Privacy**
- Sensitive user data never exposed publicly
- Two-tier sanitization (public vs. authenticated)
- Owner data sanitized in company responses

✅ **Scalability**
- Users can register unlimited companies
- Each company has complete independent data
- Proper foreign key relationships with cascade delete

✅ **Security**
- JWT authentication required for modifications
- Ownership validation on all CRUD operations
- Public/private visibility controls per company

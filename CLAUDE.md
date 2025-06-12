# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start development server with Turbo
npm run build        # Build for production
npm start           # Start production server
npm run lint        # Run ESLint

# Database (Supabase)
npx supabase start  # Start local Supabase instance
npx supabase db reset  # Reset local database
npx supabase db push   # Push schema changes

# Production Deployment
npm run build && npm start  # Test production build locally
npx supabase db push --linked  # Deploy schema to production
```

## Architecture Overview

This is an **equipment rental management system** built with Next.js, TypeScript, Supabase, and deployed on Netlify.

### Core Stack
- **Frontend**: Next.js 15 with App Router + TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Netlify with serverless functions
- **Styling**: Tailwind CSS + Radix UI components
- **Forms**: React Hook Form + Zod validation

### Authentication & Authorization
- Supabase Auth handles user authentication
- `AuthContext` provides global auth state via `useAuth()` hook
- Row Level Security (RLS) policies control database access
- User roles: `admin`, `manager`, `user` (enum in database)

### Data Model Hierarchy
```
Users (auth.users + public.users with roles)
├── Projects (with status: active/completed/cancelled)
│   └── Purchase Orders (draft/sent/confirmed/completed/cancelled)
│       ├── PO Items (equipment line items)
│       └── Delivery Notes
│           └── DN Items (with return status tracking)
└── Vendors (supplier information)
```

### Component Architecture
- **Pages**: `/src/app/` - Next.js App Router structure
- **Components**: `/src/components/` organized by type:
  - `forms/` - CRUD forms for each entity (Project, Vendor, PO, etc.)
  - `data-tables/` - Table components with search/filter
  - `ui/` - Reusable Radix UI + Tailwind components
  - `layout/` - DashboardLayout wrapper
- **Contexts**: `/src/contexts/AuthContext.tsx` - Global auth state
- **Utils**: `/src/lib/` - Supabase client, env validation, utilities

### Serverless Functions (`/netlify/functions/`)
- `generate-rental-report.ts` - PDF generation with Puppeteer
- `process-return.ts` - Handle equipment returns with audit logging
- `upload-po-document.ts` - File upload processing

### Database Schema Key Points
- All tables use UUID primary keys
- `created_at`/`updated_at` timestamps with auto-update triggers  
- Comprehensive RLS policies (though some need security improvements)
- Foreign key relationships enforce data integrity
- Enum types for status fields ensure data consistency

### Environment Variables Required
```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Error Tracking (Optional)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn

# Deployment
NODE_ENV=production
WEBSITE_URL=https://your-domain.com
```

### Production Security Features Implemented
- ✅ **RLS Policies**: Replaced vulnerable `auth.role()` with secure user table queries
- ✅ **IDOR Protection**: Added authorization checks in all Netlify functions  
- ✅ **Input Validation**: Comprehensive Zod schemas with sanitization
- ✅ **Error Handling**: Centralized error management with Sentry integration
- ✅ **Testing**: Unit, integration, and coverage testing setup
- ✅ **Health Checks**: `/api/health` endpoint for monitoring

### Known Architecture Patterns
- **Form Pattern**: All CRUD forms use React Hook Form + Zod validation
- **Data Table Pattern**: Consistent table components with search/filter
- **Layout Pattern**: DashboardLayout wraps all dashboard pages
- **Auth Pattern**: useAuth() hook + route protection via middleware
- **Error Handling**: Basic try/catch with console.error (needs improvement)

### Development Notes
- Supabase client is configured in `/src/lib/supabase.ts`
- Middleware handles auth redirects in `/src/middleware.ts`
- Environment validation happens in `/src/lib/env.ts` using Zod
- All forms follow the same validation and submission patterns
- Database migrations are in `/supabase/migrations/`
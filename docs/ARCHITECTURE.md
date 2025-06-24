# Architecture Overview

This document provides an overview of the architecture of the Lean Supabase SaaS Starter.

## High-Level Architecture

The Lean Supabase SaaS Starter follows a modular, API-first architecture with Supabase as the core platform. The architecture is designed to be scalable, maintainable, and secure.

### Key Components

1. **Supabase Backend**
   - PostgreSQL Database with Row Level Security (RLS)
   - Supabase Auth for authentication and authorization
   - Supabase Storage for file storage
   - Supabase Edge Functions for serverless API endpoints

2. **Next.js Frontend**
   - App Router for routing
   - React Server Components for server-side rendering
   - Tailwind CSS for styling
   - shadcn/ui for UI components

3. **Third-Party Integrations**
   - Stripe for payments and subscriptions
   - Resend for transactional emails

## Module-First Architecture

The backend code is organized into independent feature modules, each containing its own migrations, functions, and tests. This approach ensures high cohesion and low coupling between different parts of the application.

### Module Structure

Each module follows this structure:

```
src/modules/{module_name}/
├── migrations/       # SQL migrations for the module
├── functions/        # Edge Functions (API endpoints)
└── tests/            # Integration tests
```

### Core Modules

1. **Core Module**
   - Health check endpoints
   - Error handling
   - Version information

2. **Auth Module**
   - User profiles
   - API key management
   - Authentication utilities

3. **Billing Module**
   - Stripe integration
   - Subscription management
   - Payment processing

## API-First Design

All features are exposed through well-defined API endpoints, making the backend a standalone, stateless, "headless" API product. This approach allows any client (Web, Mobile, Extension, Server-to-Server) to interact with the backend.

### API Structure

- All API endpoints follow the pattern `/v1/{module}/{resource}`
- API responses follow a consistent format
- API documentation is generated from OpenAPI specifications

## Security Model

Security is a core principle of the architecture:

1. **Row Level Security (RLS)**
   - All tables containing user data have RLS enabled
   - No access is granted by default
   - Policies are defined to allow specific operations

2. **API Security**
   - JWT authentication for user endpoints
   - API key authentication for machine-to-machine communication
   - Rate limiting to prevent abuse

3. **Security Headers**
   - All API responses include security headers
   - CORS is configured to allow only specific origins

## Deployment Architecture

The application is designed for a "Zero-Ops" deployment model:

1. **Backend Deployment**
   - Supabase for database, auth, storage, and edge functions
   - GitHub Actions for CI/CD

2. **Frontend Deployment**
   - Vercel for Next.js hosting
   - GitHub Actions for CI/CD

This approach eliminates the need for developers to manage servers, databases, or containers in production.
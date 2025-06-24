# Lean Supabase SaaS Starter (API-First & Modular)

A production-ready starter kit for modern SaaS applications. This project is lean, extremely easy to operate, highly scalable, and follows best practices for security and developer experience.

## Core Philosophy

- **API-First is Supreme**: Backend is a standalone, stateless, "headless" API product. All features are exposed through well-defined API endpoints to serve any client (Web, Mobile, Extension, Server-to-Server).
- **Module-First Architecture**: Backend code is organized into independent feature modules (e.g., billing, auth). Each module contains its own migrations, functions, and tests, ensuring high cohesion and low coupling.
- **Supabase-First**: Maximizes the use of Supabase managed services (Postgres, Auth, Storage, Edge Functions). Treats Supabase as a platform, not just a library.
- **Security by Default**: Row Level Security (RLS) is ENABLED on all tables containing user data. No access is granted by default.
- **Superior Developer Experience (DevEx)**: Automates repetitive tasks through a powerful set of scripts. Provides a clear workflow from local development to production deployment.
- **Zero-Ops Infrastructure**: No requirement for developers to manage servers, databases, or containers in production.

## Tech Stack

- **Backend Platform**: Supabase (Postgres, Auth, Storage, Edge Functions)
- **Frontend Template**: Next.js (App Router)
- **Styling & UI Kit**: Tailwind CSS & shadcn/ui
- **Monorepo Management**: pnpm workspaces
- **Payments**: Stripe
- **Transactional Email**: Resend
- **DB Management & CLI**: Supabase CLI
- **Testing**: Vitest & Supertest
- **Linting & Formatting**: ESLint & Prettier
- **Pre-commit Hooks**: Husky
- **API Documentation**: OpenAPI/Swagger
- **Deployment**: Vercel (Frontend), GitHub Actions + Supabase CLI (Backend)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker (for local Supabase)
- Supabase CLI

### Setup

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/lean-saas-starter.git
   cd lean-saas-starter
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Set up environment variables
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. Start Supabase locally
   ```bash
   pnpm db:start
   ```

5. Start the development server
   ```bash
   pnpm dev:full
   ```

## Documentation

- [Setup Guide](docs/SETUP.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)

## License

MIT
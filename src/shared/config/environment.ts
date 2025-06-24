import { z } from 'zod';

const environmentSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  
  // Resend
  RESEND_API_KEY: z.string(),
  
  // App Config
  APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'test', 'production']),
  
  // Rate Limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.coerce.number().default(60),
  
  // Monitoring
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  METRICS_ENABLED: z.coerce.boolean().default(false),
});

export const env = environmentSchema.parse(process.env);
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  environment: string;
  services: {
    database: {
      status: string;
      latency: number;
    };
    auth: {
      status: string;
    };
    storage: {
      status: string;
    };
  };
}

serve(async (req) => {
  try {
    // In a real implementation, we would check the health of each service
    const healthData: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      environment: Deno.env.get('NODE_ENV') || 'development',
      services: {
        database: {
          status: 'ok',
          latency: 5, // ms
        },
        auth: {
          status: 'ok',
        },
        storage: {
          status: 'ok',
        },
      },
    };

    return new Response(JSON.stringify(healthData), {
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Failed to check health',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  }
});
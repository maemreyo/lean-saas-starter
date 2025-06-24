import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface CreateApiKeyRequest {
  name?: string;
  expiresInDays?: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the JWT from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the JWT and get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request body
    const requestData: CreateApiKeyRequest = await req.json();
    
    // Generate a random API key
    const apiKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const keyPrefix = apiKey.substring(0, 8);
    
    // Hash the API key
    const keyHash = await bcrypt.hash(apiKey);
    
    // Calculate expiration date if provided
    let expiresAt = null;
    if (requestData.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + requestData.expiresInDays);
    }
    
    // Insert the API key into the database
    const { data: apiKeyData, error: insertError } = await supabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name: requestData.name || 'API Key',
        expires_at: expiresAt,
      })
      .select('id, key_prefix, name, expires_at, created_at')
      .single();
    
    if (insertError) {
      console.error('Error creating API key:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Return the API key (only time it will be shown in plain text)
    return new Response(
      JSON.stringify({
        apiKey,
        ...apiKeyData,
      }),
      {
        status: 201,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block',
          'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
        },
      }
    );
  } catch (error) {
    console.error('Error in create-api-key function:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
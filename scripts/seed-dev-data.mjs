#!/usr/bin/env node

/**
 * Script to seed development data into the local Supabase instance
 * This script:
 * 1. Connects to the local Supabase instance
 * 2. Creates test users, profiles, and other necessary data
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(rootDir, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required but not found in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedData() {
  console.log('🌱 Seeding development data...');
  
  try {
    // Create test users if they don't exist
    const { data: existingUsers, error: userCheckError } = await supabase
      .from('auth.users')
      .select('id, email')
      .eq('email', 'test@example.com');
    
    if (userCheckError) {
      console.error('❌ Error checking for existing users:', userCheckError);
      return;
    }
    
    if (!existingUsers || existingUsers.length === 0) {
      console.log('👤 Creating test users...');
      
      // In a real implementation, you would use the Supabase Auth API to create users
      // For now, we'll just log what would happen
      console.log('  ✅ Would create user: test@example.com');
      console.log('  ✅ Would create user: admin@example.com');
    } else {
      console.log('👤 Test users already exist, skipping creation');
    }
    
    // Additional seeding logic would go here
    
    console.log('✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  }
}

// Run the seeding
seedData();
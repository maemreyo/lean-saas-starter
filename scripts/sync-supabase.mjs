#!/usr/bin/env node

/**
 * Script to synchronize modules from src/modules to supabase/_internal
 * This script:
 * 1. Reads all modules from src/modules
 * 2. Copies migrations to supabase/_internal/migrations
 * 3. Copies functions to supabase/_internal/functions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const modulesDir = path.join(rootDir, 'src', 'modules');
const internalDir = path.join(rootDir, 'supabase', '_internal');

// Ensure internal directories exist
const migrationsDir = path.join(internalDir, 'migrations');
const functionsDir = path.join(internalDir, 'functions');

if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

if (!fs.existsSync(functionsDir)) {
  fs.mkdirSync(functionsDir, { recursive: true });
}

// Function to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Main function to sync modules
function syncModules() {
  console.log('🔄 Syncing modules to supabase/_internal...');
  
  // Clear existing internal directories
  fs.rmSync(migrationsDir, { recursive: true, force: true });
  fs.rmSync(functionsDir, { recursive: true, force: true });
  fs.mkdirSync(migrationsDir, { recursive: true });
  fs.mkdirSync(functionsDir, { recursive: true });
  
  // Read all modules
  const modules = fs.readdirSync(modulesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  console.log(`📦 Found ${modules.length} modules: ${modules.join(', ')}`);
  
  // Process each module
  for (const module of modules) {
    const moduleDir = path.join(modulesDir, module);
    
    // Sync migrations if they exist
    const migrationsPath = path.join(moduleDir, 'migrations');
    if (fs.existsSync(migrationsPath)) {
      console.log(`📄 Syncing migrations for module: ${module}`);
      const files = fs.readdirSync(migrationsPath)
        .filter(file => file.endsWith('.sql'));
      
      for (const file of files) {
        const srcFile = path.join(migrationsPath, file);
        const destFile = path.join(migrationsDir, `${module}_${file}`);
        fs.copyFileSync(srcFile, destFile);
        console.log(`  ✅ Copied: ${file} -> ${module}_${file}`);
      }
    }
    
    // Sync functions if they exist
    const functionsPath = path.join(moduleDir, 'functions');
    if (fs.existsSync(functionsPath)) {
      console.log(`🔄 Syncing functions for module: ${module}`);
      const functionDirs = fs.readdirSync(functionsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      for (const funcDir of functionDirs) {
        const srcDir = path.join(functionsPath, funcDir);
        const destDir = path.join(functionsDir, `${module}_${funcDir}`);
        copyDir(srcDir, destDir);
        console.log(`  ✅ Copied: ${funcDir}/ -> ${module}_${funcDir}/`);
      }
    }
  }
  
  console.log('✅ Sync completed successfully!');
}

// Run the sync
syncModules();
#!/usr/bin/env node

/**
 * Script to generate API documentation from OpenAPI specs
 * This script:
 * 1. Reads all openapi.yaml files from modules
 * 2. Merges them into a single spec
 * 3. Generates HTML documentation using Swagger UI
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const modulesDir = path.join(rootDir, 'src', 'modules');
const docsDir = path.join(rootDir, 'docs', 'generated');

// Ensure docs directory exists
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// Function to find all OpenAPI spec files
function findOpenApiSpecs() {
  const specs = [];
  
  function searchDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        searchDir(fullPath);
      } else if (entry.name === 'openapi.yaml' || entry.name === 'openapi.yml') {
        specs.push(fullPath);
      }
    }
  }
  
  searchDir(modulesDir);
  return specs;
}

// Function to merge OpenAPI specs
function mergeSpecs(specFiles) {
  // Start with a base spec
  const mergedSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Lean SaaS Starter API',
      version: '1.0.0',
      description: 'API documentation for the Lean SaaS Starter'
    },
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  };
  
  // Merge each spec file
  for (const file of specFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const spec = yaml.load(content);
    
    // Merge paths
    if (spec.paths) {
      for (const [path, methods] of Object.entries(spec.paths)) {
        if (!mergedSpec.paths[path]) {
          mergedSpec.paths[path] = {};
        }
        
        for (const [method, operation] of Object.entries(methods)) {
          mergedSpec.paths[path][method] = operation;
        }
      }
    }
    
    // Merge schemas
    if (spec.components && spec.components.schemas) {
      for (const [name, schema] of Object.entries(spec.components.schemas)) {
        mergedSpec.components.schemas[name] = schema;
      }
    }
  }
  
  return mergedSpec;
}

// Function to generate HTML documentation
function generateDocs(mergedSpec) {
  // Write the merged spec to a file
  const specPath = path.join(docsDir, 'openapi.yaml');
  fs.writeFileSync(specPath, yaml.dump(mergedSpec));
  
  // Create an HTML file that uses Swagger UI
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lean SaaS Starter API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui.css">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    #swagger-ui {
      max-width: 1200px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.0.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "openapi.yaml",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    }
  </script>
</body>
</html>
  `;
  
  fs.writeFileSync(path.join(docsDir, 'index.html'), htmlContent);
}

// Main function to generate API docs
function generateApiDocs() {
  console.log('📚 Generating API documentation...');
  
  // Find all OpenAPI specs
  const specFiles = findOpenApiSpecs();
  console.log(`📄 Found ${specFiles.length} OpenAPI spec files`);
  
  if (specFiles.length === 0) {
    console.log('⚠️ No OpenAPI spec files found. Creating a placeholder spec.');
    
    // Create a placeholder spec
    const placeholderSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Lean SaaS Starter API (Placeholder)',
        version: '1.0.0',
        description: 'This is a placeholder API documentation. Add openapi.yaml files to your modules to see actual API docs.'
      },
      paths: {
        '/v1/health': {
          get: {
            summary: 'Health check endpoint',
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: {
                          type: 'string',
                          example: 'ok'
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    
    generateDocs(placeholderSpec);
  } else {
    // Merge specs and generate docs
    const mergedSpec = mergeSpecs(specFiles);
    generateDocs(mergedSpec);
  }
  
  console.log(`✅ API documentation generated at: ${docsDir}`);
  console.log('📖 Run "pnpm docs:serve" to view the documentation');
}

// Run the generator
generateApiDocs();
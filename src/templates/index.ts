import fs from 'fs';
import Handlebars from 'handlebars';
import path from 'path';
import { fileURLToPath } from 'url';

import './helpers';

export type TemplateContext = {
  // Depth of this template in the hierarchy of headings, starting at 1.
  depth: number;
};

// Cache for compiled templates
const templateCache: Map<string, Handlebars.TemplateDelegate> = new Map();

/**
 * Loads and compiles a Handlebars template from a file
 * @param templatePath Path to the template file relative to the templates directory
 * @returns Compiled Handlebars template
 */
export function loadTemplate(templatePath: string): Handlebars.TemplateDelegate {
  // Check cache first
  if (templateCache.has(templatePath)) {
    return templateCache.get(templatePath)!;
  }

  // Read and compile template
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fullPath = path.join(__dirname, '..', 'scryfall', templatePath);
  const template = fs.readFileSync(fullPath, 'utf-8');
  const compiled = Handlebars.compile(template);

  // Cache the compiled template
  templateCache.set(templatePath, compiled);

  return compiled;
}

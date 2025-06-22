import Handlebars from 'handlebars';

import { TemplateContext } from './types.js';

/**
 * Generate a base heading prefix for markdown, given a depth
 * @param templateContext The template context, which includes the heading depth.
 * @returns The heading prefix (e.g. '#' for h1, '##' for h2)
 */
function heading({ depth }: TemplateContext): string {
  return '#'.repeat(depth);
}

Handlebars.registerHelper('heading', heading);

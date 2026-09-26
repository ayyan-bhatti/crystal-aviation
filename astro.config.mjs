// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://thecrystalaviation.com',
  // Static by default; promotion list/detail and sitemap opt out with `prerender = false`.
  output: 'static',
  adapter: cloudflare({
    // Build-time image optimisation only: no Cloudflare Images binding (avoids paid transformations).
    imageService: 'compile',
  }),
  // No Astro sessions: avoids provisioning a KV namespace.
  session: false,
  integrations: [react()],
  trailingSlash: 'never',
  build: { format: 'file' },
  security: { checkOrigin: true },
});

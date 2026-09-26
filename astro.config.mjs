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
  // The Astro dev toolbar is a local-only overlay; keep it off so previews look like the real site.
  devToolbar: { enabled: false },
  trailingSlash: 'never',
  build: { format: 'file' },
  security: { checkOrigin: true },
});

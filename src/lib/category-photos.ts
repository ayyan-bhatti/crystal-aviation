// Server-only (used in .astro frontmatter): stand-in photos for offers that
// have no poster, so no offer is shown as an empty box.
import { getImage } from 'astro:assets';
import umrah from '../assets/photos/madinah-green-dome.jpg';
import tour from '../assets/photos/langkawi-bay.jpg';
import flight from '../assets/photos/wing-above-clouds.jpg';
import hotel from '../assets/photos/bangkok-wat-arun.jpg';
import visa from '../assets/photos/london-big-ben.jpg';
import other from '../assets/photos/airport-departures.jpg';
import type { Category } from './types';

const sources: Record<Category, ImageMetadata> = { umrah, tour, flight, hotel, visa, other };

export type CategoryPhotos = Record<Category, string>;

export async function categoryPhotos(): Promise<CategoryPhotos> {
  const entries = await Promise.all(
    (Object.keys(sources) as Category[]).map(async (c) => {
      const img = await getImage({ src: sources[c], width: 800, height: 1000, fit: 'cover', format: 'webp' });
      return [c, img.src] as const;
    }),
  );
  return Object.fromEntries(entries) as CategoryPhotos;
}

// Server-only (used in .astro frontmatter): stand-in photos for offers that
// have no poster, so no offer is ever shown as an empty box. Keys are offer
// categories plus known destinations (lower-case).
import { getImage } from 'astro:assets';
import umrah from '../assets/photos/makkah-kaaba-clock.jpg';
import tour from '../assets/photos/langkawi-bay.jpg';
import flight from '../assets/photos/plane-blue-sky.jpg';
import hotel from '../assets/photos/resort-pool.jpg';
import visa from '../assets/photos/london-big-ben.jpg';
import other from '../assets/photos/wing-above-clouds.jpg';
import baku from '../assets/photos/baku-old-city.jpg';
import thailand from '../assets/photos/bangkok-wat-arun.jpg';
import singapore from '../assets/photos/singapore-supertrees.jpg';
import malaysia from '../assets/photos/langkawi-bay.jpg';

const sources: Record<string, ImageMetadata> = {
  umrah, tour, flight, hotel, visa, other,
  baku, azerbaijan: baku, thailand, bangkok: thailand, singapore, malaysia, langkawi: malaysia,
};

export type CategoryPhotos = Record<string, string>;

export async function categoryPhotos(): Promise<CategoryPhotos> {
  const entries = await Promise.all(
    Object.entries(sources).map(async ([key, src]) => {
      const img = await getImage({ src, width: 800, height: 1000, fit: 'cover', format: 'webp' });
      return [key, img.src] as const;
    }),
  );
  return Object.fromEntries(entries);
}


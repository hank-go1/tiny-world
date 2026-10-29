import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tiny Block · A little world of its own',
  description: 'Explore a cozy, living town. Zoom in, meet the neighbors, and make a little rain.',
};

export default function TownLayout({ children }: { children: React.ReactNode }) {
  return children;
}

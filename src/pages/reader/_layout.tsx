import type { ReactNode } from 'react';
import { ReaderLayoutClient } from '@/components/reader-layout-client';

export default function Layout({ children }: { children: ReactNode }) {
  return <ReaderLayoutClient>{children}</ReaderLayoutClient>;
}

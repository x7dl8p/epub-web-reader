import { UploadZone } from '@/components/upload-zone';
import { BookMarked } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-6">
      <UploadZone />
    </div>
  );
}

export async function getConfig() {
  return {
    render: 'static',
  } as const;
}

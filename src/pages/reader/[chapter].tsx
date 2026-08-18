import { ChapterView } from '@/components/chapter-view';
import { PageProps } from 'waku/router';

export default function Page({ chapter }: PageProps<'/reader/[chapter]'>) {
  return <ChapterView chapterParam={chapter} />;
}

export async function getConfig() {
  return {
    render: 'dynamic',
  } as const;
}

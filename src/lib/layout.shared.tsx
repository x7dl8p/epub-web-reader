import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    links: [
      {
        text: 'About',
        url: '/about',
      },
      {
        text: 'Developer',
        url: '/developer',
      },
      {
        text: 'Philosophy',
        url: '/philosophy',
      },
    ],
    githubUrl: undefined,
  };
}

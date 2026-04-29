import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { BookOpenText, Boxes, Gem, Sprout } from 'lucide-react'

import { CliviaIcon } from '@/components/clivia-icon'
import { SiteBrand } from '@/components/site-brand'

import { gitConfig } from './shared'

export function baseOptions(): BaseLayoutProps {
  return {
    links: [
      {
        text: 'Start',
        url: '/docs/start',
      },
      {
        text: 'Model',
        url: '/docs/model',
      },
      {
        text: 'Examples',
        url: '/docs/examples',
      },
      {
        type: 'button',
        text: 'Reference',
        icon: <CliviaIcon className="size-4" title="Clivia mark" />,
        url: '/docs/reference',
        secondary: true,
      },
      {
        type: 'menu',
        text: 'Path',
        items: [
          {
            text: 'Overview',
            description: 'The philosophy and shape of clily.',
            url: '/docs',
            icon: <Gem className="size-4" />,
          },
          {
            text: 'Start',
            description: 'Install and write one comfortable command.',
            url: '/docs/start',
            icon: <Sprout className="size-4" />,
          },
          {
            text: 'Examples',
            description: 'Read the source-backed workspaces.',
            url: '/docs/examples',
            icon: <Boxes className="size-4" />,
          },
          {
            text: 'Reference',
            description: 'The supported package surface.',
            url: '/docs/reference',
            icon: <BookOpenText className="size-4" />,
          },
        ],
      },
    ],
    nav: {
      title: <SiteBrand kicker="comfort over chrome" />,
      url: '/',
      transparentMode: 'top',
    },
    themeSwitch: {
      enabled: true,
      mode: 'light-dark-system',
    },
    searchToggle: {
      enabled: true,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  }
}

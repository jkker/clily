import { RootProvider } from 'fumadocs-ui/provider/next'
import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Geist, IBM_Plex_Mono } from 'next/font/google'

import './global.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  weight: ['400', '500', '600', '700'],
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://clily.dev'),
  applicationName: 'clily',
  title: {
    default: 'clily',
    template: '%s | clily',
  },
  description: 'Elegant, comfortable TypeScript CLI documentation.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5ece1' },
    { media: '(prefers-color-scheme: dark)', color: '#121512' },
  ],
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${cormorant.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="mori-root flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}

import { notFound } from 'next/navigation'
import { ImageResponse } from 'next/og'

import { appName } from '@/lib/shared'
import { getPageImage, source } from '@/lib/source'

export const revalidate = false

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  const { slug } = await params
  const page = source.getPage(slug.slice(0, -1))
  if (!page) notFound()

  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        padding: 40,
        background: 'linear-gradient(135deg, #f5ece1 0%, #fff8ef 48%, #eef4e8 100%)',
        color: '#262a25',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRadius: 28,
          border: '1.5px solid rgba(54, 95, 57, 0.16)',
          background: 'rgba(255, 255, 255, 0.35)',
          padding: 52,
          boxShadow: '0 24px 60px rgba(54, 95, 57, 0.12)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              height: 96,
              width: 96,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 24,
              background: 'rgba(255, 252, 247, 0.76)',
            }}
          >
            <div
              style={{
                position: 'relative',
                display: 'flex',
                height: 68,
                width: 68,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  height: 68,
                  width: 68,
                  borderRadius: 999,
                  background: 'linear-gradient(145deg, #365f39, #6e8f58)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  height: 34,
                  width: 34,
                  borderRadius: 999,
                  background: '#f5ece1',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  transform: 'translateY(-14px)',
                  color: '#f24405',
                  fontSize: 38,
                  fontWeight: 700,
                }}
              >
                *
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '0.16em',
                opacity: 0.72,
                textTransform: 'uppercase',
              }}
            >
              Clivia Forest docs
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
              }}
            >
              {appName}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div
            style={{
              fontSize: 92,
              fontWeight: 700,
              lineHeight: 0.92,
            }}
          >
            {page.data.title}
          </div>
          <div
            style={{
              maxWidth: 920,
              fontSize: 30,
              lineHeight: 1.35,
              opacity: 0.78,
            }}
          >
            {page.data.description}
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  )
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }))
}

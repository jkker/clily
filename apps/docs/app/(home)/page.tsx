import { ArrowRight, Command, LibraryBig, MoonStar, Sprout, Terminal } from 'lucide-react'
import Link from 'next/link'

import { CliviaIcon } from '@/components/clivia-icon'

const snippet = `import clily from '@clily/core'
import { z } from 'zod'

const run = clily({
  name: 'release',
  completion: true,
  subCommands: {
    deploy: clily.command({
      args: z.object({
        image: z.string(),
        region: z.string().default('us-east-1'),
      }),
      positionals: z.string(),
      run: ({ args, positionals }) => {
        console.log(args.image, args.region, positionals)
      },
    }),
  },
})

await run()`

const promises = [
  {
    title: 'One command tree.',
    copy: 'Parsing, validation, config, prompts, help, and completion metadata stay in one ergonomic place.',
  },
  {
    title: 'One schema per command.',
    copy: 'Nested commands stay local and readable without hauling generic ceremony through the full app.',
  },
  {
    title: 'Comfort under load.',
    copy: 'The interface stays breathable in bright and dark rooms, with papery light mode and forest-dark depth.',
  },
  {
    title: 'Readable when tired.',
    copy: 'Cormorant headings, Geist body text, and Monaspace-style code keep the docs soft without losing precision.',
  },
]

export default function HomePage() {
  return (
    <main className="page-shell flex flex-1 flex-col gap-8 lg:gap-10">
      <section className="hero">
        <div className="mori-glass hero-panel p-6 sm:p-8 lg:p-10">
          <div className="hero-badge">
            <span className="hero-badge-mark" aria-hidden>
              <CliviaIcon className="size-6" />
            </span>
            <span>Clivia Forest / Mori-kei / Modern Botanical</span>
          </div>
          <div className="accent mt-8 mb-8" />
          <p className="eyebrow">Comfort is the product</p>
          <h1 className="hero-title mt-4">CLI docs should feel grown, not fabricated.</h1>
          <p className="hero-copy mt-6">
            clily keeps validation, config, prompts, lifecycle hooks, help, and completion metadata
            close to the command you are writing.
          </p>
          <div className="hero-actions mt-8 flex flex-wrap gap-3">
            <Link href="/docs/start" className="button button-primary">
              Start softly
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/docs/reference" className="button button-secondary">
              See the surface
              <LibraryBig className="size-4" />
            </Link>
          </div>
          <div className="hero-meta mt-8 grid gap-3 sm:grid-cols-3">
            <div className="hero-meta-card">
              <Sprout className="size-4 text-[var(--mori-green)]" />
              <span>Breathable docs chrome</span>
            </div>
            <div className="hero-meta-card">
              <CliviaIcon className="size-4" title="Clivia mark" />
              <span>Schema-first ergonomics</span>
            </div>
            <div className="hero-meta-card">
              <MoonStar className="size-4 text-[var(--mori-yellow)]" />
              <span>Balanced light and dark</span>
            </div>
          </div>
        </div>

        <div className="hero-rail">
          <aside className="code-panel p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between text-xs font-bold tracking-[0.15em] text-white/64 uppercase">
              <span className="inline-flex items-center gap-2">
                <Terminal className="size-4" />
                first command
              </span>
              <span className="inline-flex items-center gap-2">
                <CliviaIcon className="size-4" title="Clivia mark" />
                <Command className="size-4 text-[#f2b705]" />
              </span>
            </div>
            <pre className="overflow-x-auto p-4 text-[0.82rem] leading-6">
              <code>{snippet}</code>
            </pre>
          </aside>

          <div className="mori-glass p-5 sm:p-6">
            <p className="eyebrow">Forest floor rules</p>
            <div className="feature-stack mt-5 space-y-4">
              <div className="feature-inline">
                <CliviaIcon className="size-5" title="Clivia mark" />
                <p>
                  Deep greens hold structure. Orange and yellow only bloom where attention matters.
                </p>
              </div>
              <div className="feature-inline">
                <CliviaIcon className="size-5" title="Clivia mark" />
                <p>
                  Soft glass, papery neutrals, and grain keep the interface warm instead of sterile.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        {promises.map((promise) => (
          <div key={promise.title} className="feature-card">
            <div className="feature-flag">
              <CliviaIcon className="size-6" title="Clivia mark" />
            </div>
            <p className="text-lg font-semibold">{promise.title}</p>
            <p className="feature-copy">{promise.copy}</p>
          </div>
        ))}
      </section>

      <section className="garden-grid">
        <div className="mori-glass library-card p-6 sm:p-7">
          <p className="eyebrow">Documentation path</p>
          <h2 className="mt-4 text-4xl leading-none sm:text-5xl">
            A calmer path into the command tree.
          </h2>
          <p className="hero-copy mt-5 max-w-none">
            Start with the first command, skim the runtime model, then move into examples and the
            package surface when you need exact edges.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/docs" className="button button-secondary">
              Browse the path
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/docs/model" className="button button-secondary">
              Study the runtime
              <Command className="size-4" />
            </Link>
          </div>
        </div>

        <div className="principles">
          <div className="principle-card">
            <p className="eyebrow">Breathability</p>
            <p>
              Wide spacing, rounded containers, and low-noise contrast keep long reading
              comfortable.
            </p>
          </div>
          <div className="principle-card">
            <p className="eyebrow">Organic structure</p>
            <p>
              Grain, softened gradients, and botanical accents keep the interface from feeling
              machine-flat.
            </p>
          </div>
          <div className="principle-card">
            <p className="eyebrow">Elegant ergonomics</p>
            <p>
              Buttons, code blocks, and docs navigation stay tactile, clear, and easy to scan when
              tired.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

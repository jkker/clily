import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  allowedDevOrigins: ['abyss'],
  reactStrictMode: true,
}

export default withMDX(config)

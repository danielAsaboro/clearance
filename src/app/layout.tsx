import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ClusterProvider } from '@/components/cluster/cluster-data-access'
import Providers from '@/components/Providers'
import { AppProviders } from '@/components/app-providers'
import { AppLayout } from '@/components/app-layout'
import './globals.css'

export const dynamic = 'force-dynamic'

const links: { label: string; path: string }[] = [
  { label: 'Arena', path: '/arena' },
  { label: 'Leaderboard', path: '/leaderboard' },
  { label: 'Rewards', path: '/rewards' },
  { label: 'Mint USDC', path: '/mint' },
]

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'The Clearance',
  description: 'Predict trending content. Earn rewards. Own the moment.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'The Clearance',
  },
}

export const viewport: Viewport = {
  themeColor: '#F5E642',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

function ServiceWorkerRegistration() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            });
          }
        `,
      }}
    />
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ServiceWorkerRegistration />
      </head>
      <body className={`${inter.variable} antialiased bg-black`}>
        <ClusterProvider>
          <Providers>
            <AppProviders>
              <AppLayout links={links}>
                <div className="app-container flex-1 flex flex-col">{children}</div>
              </AppLayout>
            </AppProviders>
          </Providers>
        </ClusterProvider>
      </body>
    </html>
  )
}

// Patch BigInt so we can log it using JSON.stringify without any errors
declare global {
  interface BigInt {
    toJSON(): string
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString()
}

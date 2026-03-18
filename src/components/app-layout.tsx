'use client'

import { usePathname } from 'next/navigation'
import { Toaster } from './ui/sonner'
import { AppHeader } from '@/components/app-header'
import React from 'react'
import { AppFooter } from '@/components/app-footer'
import { ClusterChecker } from '@/components/cluster/cluster-ui'
import { AccountChecker } from '@/components/account/account-ui'

const ADMIN_PREFIXES = ['/admin']

export function AppLayout({
  children,
  links,
}: {
  children: React.ReactNode
  links: { label: string; path: string }[]
}) {
  const pathname = usePathname()
  const isAdmin = ADMIN_PREFIXES.some((p) => pathname.startsWith(p))

  return (
    <>
      <div className="flex flex-col min-h-screen">
        <AppHeader links={links} isAdmin={isAdmin} />
        <main className={`flex-grow flex flex-col ${isAdmin ? 'container mx-auto p-4' : ''}`}>
          <ClusterChecker>
            <AccountChecker />
          </ClusterChecker>
          {children}
        </main>
        {isAdmin && <AppFooter />}
      </div>
      <Toaster />
    </>
  )
}

'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import Image from 'next/image'
import { ThemeSelect } from '@/components/theme-select'
import { ClusterUiSelect } from './cluster/cluster-ui'
import ConnectWallet from '@/components/ConnectWallet'

export function AppHeader({ links = [], isAdmin = false }: { links: { label: string; path: string }[]; isAdmin?: boolean }) {
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)

  function isActive(path: string) {
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  // Consumer routes: no header — each page handles its own navigation
  if (!isAdmin) {
    return null
  }

  // Admin routes: full header with nav links
  return (
    <header className="sticky top-0 z-50 px-4 py-2 bg-black border-b border-[#2A2A2A]">
      <div className="mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link className="flex items-center gap-2 hover:opacity-80 transition-opacity" href="/">
            <Image src="/spotr-logo.png" alt="Spotr TV" width={28} height={28} className="rounded-lg" />
            <span className="text-white font-bold text-sm">SPOTR <span className="text-[#F5E642]">/</span> TV</span>
          </Link>
          <div className="hidden md:flex items-center">
            <ul className="flex gap-4 flex-nowrap items-center">
              {links.map(({ label, path }) => (
                <li key={path}>
                  <Link
                    className={`text-sm transition-colors hover:text-white ${isActive(path) ? 'text-[#F5E642]' : 'text-[#888]'}`}
                    href={path}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button className="md:hidden text-[#888] hover:text-white transition-colors p-1" onClick={() => setShowMenu(!showMenu)}>
          {showMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        <div className="hidden md:flex items-center gap-2">
          <ClusterUiSelect />
          <ThemeSelect />
          <ConnectWallet />
        </div>

        {showMenu && (
          <div className="md:hidden fixed inset-x-0 top-[52px] bottom-0 bg-black/95 backdrop-blur-sm">
            <div className="flex flex-col p-4 gap-4 border-t border-[#2A2A2A]">
              <ul className="flex flex-col gap-4">
                {links.map(({ label, path }) => (
                  <li key={path}>
                    <Link
                      className={`block text-lg py-2 transition-colors hover:text-white ${isActive(path) ? 'text-[#F5E642]' : 'text-[#888]'}`}
                      href={path}
                      onClick={() => setShowMenu(false)}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <ConnectWallet />
              <div className="flex items-center gap-2">
                <ClusterUiSelect />
                <ThemeSelect />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

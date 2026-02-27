'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Eye, Menu, X } from 'lucide-react'
import { ThemeSelect } from '@/components/theme-select'
import { ClusterUiSelect } from './cluster/cluster-ui'

export function AppHeader({ links = [] }: { links: { label: string; path: string }[] }) {
  const pathname = usePathname()
  const [showMenu, setShowMenu] = useState(false)

  function isActive(path: string) {
    return path === '/' ? pathname === '/' : pathname.startsWith(path)
  }

  return (
    <header className="sticky top-0 z-50 px-4 py-2 bg-black border-b border-[#2A2A2A]">
      <div className="mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link className="flex items-center gap-2 hover:opacity-80 transition-opacity" href="/">
            <div className="w-7 h-7 bg-[#F5E642] rounded-lg flex items-center justify-center">
              <Eye className="w-4 h-4 text-black" />
            </div>
            <span className="text-white font-bold text-sm">The Clearance</span>
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

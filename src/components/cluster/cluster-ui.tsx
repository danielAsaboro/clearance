'use client'

import { useConnection } from '@solana/wallet-adapter-react'

import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { ReactNode } from 'react'

import { useCluster } from './cluster-data-access'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { AppAlert } from '@/components/app-alert'
import { Globe, ChevronDown } from 'lucide-react'

export function ExplorerLink({ path, label, className }: { path: string; label: string; className?: string }) {
  const { getExplorerUrl } = useCluster()
  return (
    <a
      href={getExplorerUrl(path)}
      target="_blank"
      rel="noopener noreferrer"
      className={className ? className : `link font-mono`}
    >
      {label}
    </a>
  )
}

export function ClusterChecker({ children }: { children: ReactNode }) {
  const { cluster } = useCluster()
  const { connection } = useConnection()

  const query = useQuery({
    queryKey: ['version', { cluster, endpoint: connection.rpcEndpoint }],
    queryFn: () => connection.getVersion(),
    retry: 1,
  })
  if (query.isLoading) {
    return null
  }
  if (query.isError || !query.data) {
    return (
      <AppAlert
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Refresh
          </Button>
        }
      >
        Error connecting to cluster <span className="font-bold">{cluster.name}</span>.
      </AppAlert>
    )
  }
  return children
}

export function ClusterUiSelect() {
  const { clusters, setCluster, cluster } = useCluster()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 h-8 px-3 text-xs bg-[#1A1A1A] text-[#888] border border-[#2A2A2A] hover:border-[#F5E642]/40 hover:text-white rounded-full transition-colors">
          <Globe className="size-3.5" />
          <span>{cluster.name}</span>
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={cluster.name} onValueChange={(name) => {
          const selected = clusters.find((c) => c.name === name)
          if (selected) setCluster(selected)
        }}>
          {clusters.map((item) => (
            <DropdownMenuRadioItem key={item.name} value={item.name}>
              <span className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${item.active ? 'bg-green-500' : 'bg-[#555]'}`} />
                {item.name}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

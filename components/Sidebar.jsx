'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { LayoutDashboard, Database, Settings,  } from 'lucide-react'
import { BookMarked } from 'lucide-react';
import { Cctv } from 'lucide-react';


const topSidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Database, label: 'Database', href: '/database' },
  { icon: BookMarked, label: 'Known Plates', href: '/known_plates' },
  { icon: Cctv, label: 'Watchlist', href: '/known_plates' },
]




export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col justify-between h-screen bg-background border-r px-4">
      <nav className="flex flex-col items-center pt-4 space-y-2">
        {topSidebarItems.map((item) => (
          <Button
            key={item.href}
            asChild
            variant="ghost"
            className={cn(
              "w-14 h-14 flex flex-col items-center justify-center",
              pathname === item.href && "bg-muted"
            )}
          >
            <Link href={item.href}>
              <item.icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          </Button>
        ))}
      </nav>
      <div className="flex flex-col items-center pb-4 space-y-2">
        <ThemeToggle />
        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-14 h-14 flex flex-col items-center justify-center",
            pathname === '/settings' && "bg-muted"
          )}
        >
          <Link href="/settings">
            <Settings className="h-5 w-5" />
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </Button>
      </div>
    </aside>
  )
}
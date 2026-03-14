import type { Metadata } from 'next'
import { getCategoryConfig } from '@/lib/category-config'

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params
  const config = getCategoryConfig(category)
  return { title: `${config.label} — Kmart Kurator` }
}

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// app/page.jsx
import PlateReadsClient from '@/components/PlateReadsClient'
import { getPlateReads, getTags } from '@/lib/db'
import { addTagAction, removeTagAction } from './actions/tagActions'

export const dynamic = 'force-dynamic'

export default async function PlateReadsPage({ searchParams }) {
  // Access searchParams directly with defaults
  const queryParams = {
    search: searchParams.search ?? '',
    sortBy: searchParams.sortBy ?? 'timestamp',
    sortOrder: searchParams.sortOrder ?? 'DESC',
    filterTag: searchParams.filterTag ?? 'all',
    page: parseInt(searchParams.page ?? '1')
  }

  const dbFilterTag = queryParams.filterTag === 'all' ? '' : queryParams.filterTag
  
  const [plateReads, tags] = await Promise.all([
    getPlateReads({ 
      ...queryParams,
      filterTag: dbFilterTag
    }),
    getTags()
  ])

  return (
    <PlateReadsClient 
      initialData={plateReads}
      initialTags={tags}
      addTagAction={addTagAction}
      removeTagAction={removeTagAction}
    />
  )
}
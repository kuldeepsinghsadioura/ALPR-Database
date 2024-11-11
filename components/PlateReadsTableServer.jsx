// app/components/PlateReadsTableServer.jsx
import { getPlateReads, getTags } from '@/lib/db'

export async function fetchPlateReadsData({ search, sortBy, sortOrder, filterTag, page }) {
  const apiFilterTag = filterTag === 'all' ? '' : filterTag
  const plateReads = await getPlateReads({ 
    search, 
    sortBy, 
    sortOrder, 
    filterTag: apiFilterTag, 
    page 
  })
  const tags = await getTags()
  
  return { plateReads, tags }
}
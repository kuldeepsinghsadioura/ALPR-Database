'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table'
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import Image from 'next/image'

export default function PlateReadsClient({ 
  initialData, 
  initialTags, 
  addTagAction, 
  removeTagAction 
}) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('timestamp')
  const [sortOrder, setSortOrder] = useState('DESC')
  const [filterTag, setFilterTag] = useState('all')
  const [page, setPage] = useState(1)
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateUrl = (params) => {
    const newParams = new URLSearchParams(searchParams)
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value)
      } else {
        newParams.delete(key)
      }
    })
    router.push(`?${newParams.toString()}`)
  }

  const handleSearch = (e) => {
    const newSearch = e.target.value
    setSearch(newSearch)
    updateUrl({ search: newSearch })
  }

  const handleSort = (column) => {
    const newSortOrder = sortBy === column && sortOrder === 'ASC' ? 'DESC' : 'ASC'
    setSortBy(column)
    setSortOrder(newSortOrder)
    updateUrl({ sortBy: column, sortOrder: newSortOrder })
  }

  const handleFilterTag = (tag) => {
    setFilterTag(tag)
    updateUrl({ filterTag: tag === 'all' ? '' : tag })
  }

  const handlePageChange = (newPage) => {
    setPage(newPage)
    updateUrl({ page: newPage })
  }

  const handleAddTag = async (plateNumber, newTag) => {
    await addTagAction(plateNumber, newTag)
    router.refresh()
  }

  const handleRemoveTag = async (plateNumber, tagToRemove) => {
    await removeTagAction(plateNumber, tagToRemove)
    router.refresh()
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">License Plate Reads</h1>
      <div className="flex mb-4">
        <Input
          type="text"
          placeholder="Search plate numbers"
          value={search}
          onChange={handleSearch}
          className="mr-2"
        />
        <Select value={filterTag} onValueChange={handleFilterTag}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {initialTags.map((tag) => (
              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Image</TableHead>
            <TableHead onClick={() => handleSort('plate_number')} className="cursor-pointer">
              Plate Number {sortBy === 'plate_number' && (sortOrder === 'ASC' ? '▲' : '▼')}
            </TableHead>
            <TableHead>Tags</TableHead>
            <TableHead onClick={() => handleSort('count')} className="cursor-pointer">
              Count {sortBy === 'count' && (sortOrder === 'ASC' ? '▲' : '▼')}
            </TableHead>
            <TableHead onClick={() => handleSort('timestamp')} className="cursor-pointer">
              Timestamp {sortBy === 'timestamp' && (sortOrder === 'ASC' ? '▲' : '▼')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialData.map((read) => (
            <TableRow key={read.id}>
              <TableCell>
                <Dialog>
                  <DialogTrigger>
                  <Image 
                    src={`data:image/jpeg;base64,${read.image_data}`} 
                    alt={read.plate_number} 
                    className="w-16 h-16 object-cover" 
                    />
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{read.plate_number}</DialogTitle>
                    </DialogHeader>
                    <Image 
                    src={`data:image/jpeg;base64,${read.image_data}`} 
                    alt={read.plate_number} 
                    className="w-full" 
                    />
                  </DialogContent>
                </Dialog>
              </TableCell>
              <TableCell>{read.plate_number}</TableCell>
              <TableCell>
                {read.tags.map((tag) => (
                  <span key={tag} className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">
                    {tag}
                    <button onClick={() => handleRemoveTag(read.plate_number, tag)} className="ml-2 text-red-500">×</button>
                  </span>
                ))}
                <Dialog>
                  <DialogTrigger>
                    <Button variant="outline" size="sm">Add Tag</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Tag for {read.plate_number}</DialogTitle>
                    </DialogHeader>
                    <Input
                      type="text"
                      placeholder="Enter new tag"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddTag(read.plate_number, e.target.value)
                          e.target.value = ''
                        }
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </TableCell>
              <TableCell>{read.count}</TableCell>
              <TableCell>{new Date(read.timestamp).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 flex justify-between">
        <Button onClick={() => handlePageChange(page - 1)} disabled={page === 1}>Previous</Button>
        <span>Page {page}</span>
        <Button onClick={() => handlePageChange(page + 1)} disabled={initialData.length < 10}>Next</Button>
      </div>
    </div>
  )
}
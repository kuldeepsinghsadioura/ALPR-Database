'use client'

import { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getTags, addTag, removeTag } from '@/app/actions'
import DashboardLayout from '@/components/layout/MainLayout'
import TitleNavbar from '@/components/layout/TitleNav'

const ElegantTagManagement = () => {
  const [tags, setTags] = useState([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#22c55e')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    const loadTags = async () => {
      const result = await getTags()
      if (result.success) {
        setTags(result.data)
      }
    }
    loadTags()
  }, [])

  const onCreateTag = async (e) => {
    e.preventDefault()
    if (newTagName.trim()) {
      try {
        const formData = new FormData()
        formData.append('name', newTagName.trim())
        formData.append('color', newTagColor)
        
        const result = await addTag(formData)
        if (result.success) {
          setTags([...tags, result.data])
          setNewTagName('')
          setNewTagColor('#22c55e')
          setIsDialogOpen(false)
        }
      } catch (error) {
        console.error('Failed to create tag:', error)
      }
    }
  }

  const onDeleteTag = async (tagName) => {
    try {
      const formData = new FormData()
      formData.append('name', tagName)
      
      const result = await removeTag(formData)
      if (result.success) {
        setTags(tags.filter(tag => tag.name !== tagName))
      }
    } catch (error) {
      console.error('Failed to delete tag:', error)
    }
  }

  return (
    <DashboardLayout>
      <TitleNavbar title="Plate Database">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Tags</h3>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tag
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Tag</DialogTitle>
                </DialogHeader>
                <form onSubmit={onCreateTag} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tagName">Tag Name</Label>
                    <Input
                      id="tagName"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Enter tag name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagColor">Tag Color</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="tagColor"
                        type="color"
                        value={newTagColor}
                        onChange={(e) => setNewTagColor(e.target.value)}
                        className="w-12 p-1 h-10"
                      />
                      <Input
                        value={newTagColor}
                        onChange={(e) => setNewTagColor(e.target.value)}
                        placeholder="#RRGGBB"
                        className="flex-grow"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    Create Tag
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <ScrollArea className="h-[200px] w-full rounded-md border p-4">
            <div className="flex flex-wrap gap-2">
              {tags?.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="text-sm py-1 px-3 flex items-center space-x-2"
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span>{tag.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                    onClick={() => onDeleteTag(tag.name)}
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Delete {tag.name} tag</span>
                  </Button>
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>
      </TitleNavbar>
    </DashboardLayout>
  )
}

export default ElegantTagManagement
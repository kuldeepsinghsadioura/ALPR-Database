'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Search, Filter, Tag, Plus, Trash2, X } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getTags, addKnownPlate, tagPlate, untagPlate, deletePlate } from '@/app/actions'


export default function PlateTable({ initialData }) {
  const [data, setData] = useState(initialData)
  const [filteredData, setFilteredData] = useState(initialData)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('all')
  const [isAddKnownPlateOpen, setIsAddKnownPlateOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [activePlate, setActivePlate] = useState(null)
  const [newKnownPlate, setNewKnownPlate] = useState({ name: '', notes: '' })
  const [availableTags, setAvailableTags] = useState([])

  useEffect(() => {
    const loadTags = async () => {
      const result = await getTags();
      if (result.success) {
        setAvailableTags(result.data);
      }
    }
    loadTags();
  }, [])

  useEffect(() => {
    const filtered = data.filter(plate => 
      plate.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (selectedTag === 'all' || plate.tags?.some(tag => tag.name === selectedTag))
    )
    setFilteredData(filtered)
  }, [data, searchTerm, selectedTag])

  const handleAddTag = async (plateNumber, tagName) => {
    try {
      const formData = new FormData();
      formData.append('plateNumber', plateNumber);
      formData.append('tagName', tagName);
      
      const result = await tagPlate(formData);
      if (result.success) {
        // Update local state to reflect the new tag
        setData(prevData => prevData.map(plate => {
          if (plate.plate_number === plateNumber) {
            const newTag = availableTags.find(t => t.name === tagName);
            return {
              ...plate,
              tags: [...(plate.tags || []), newTag]
            };
          }
          return plate;
        }));
      }
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  }

  const handleRemoveTag = async (plateNumber, tagName) => {
    try {
      const formData = new FormData();
      formData.append('plateNumber', plateNumber);
      formData.append('tagName', tagName);
      
      const result = await untagPlate(formData);
      if (result.success) {
        setData(prevData => prevData.map(plate => {
          if (plate.plate_number === plateNumber) {
            return {
              ...plate,
              tags: (plate.tags || []).filter(tag => tag.name !== tagName)
            };
          }
          return plate;
        }));
      }
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  }

  const handleAddKnownPlate = async () => {
    if (!activePlate) return;
    try {
      const formData = new FormData();
      formData.append('plateNumber', activePlate.plate_number);
      formData.append('name', newKnownPlate.name);
      formData.append('notes', newKnownPlate.notes);
      
      const result = await addKnownPlate(formData);
      if (result.success) {
        setData(prevData => prevData.map(plate => 
          plate.plate_number === activePlate.plate_number 
            ? { ...plate, known_name: newKnownPlate.name, notes: newKnownPlate.notes }
            : plate
        ));
        setIsAddKnownPlateOpen(false);
        setNewKnownPlate({ name: '', notes: '' });
      }
    } catch (error) {
      console.error('Failed to add known plate:', error);
    }
  }

  const handleDeleteRecord = async () => {
    if (!activePlate) return;
    try {
      const formData = new FormData();
      formData.append('plateNumber', activePlate.plate_number);
      
      const result = await deletePlate(formData);
      if (result.success) {
        setData(prevData => prevData.filter(plate => plate.id !== activePlate.id));
        setIsDeleteConfirmOpen(false);
      }
    } catch (error) {
      console.error('Failed to delete record:', error);
    }
  }

  const getImageUrl = (base64Data) => {
    if (!base64Data) {
      return '/placeholder-image.jpg'; // You can replace this with your preferred placeholder image
    }
    // Check if the string already includes the data URL prefix
    if (base64Data.startsWith('data:image/jpeg;base64,')) {
      return base64Data;
    }
    // If not, add the prefix
    return `data:image/jpeg;base64,${base64Data}`;
  };

  const handleImageClick = (e, plate) => {
    e.preventDefault();
    
    // Don't open window if there's no image data
    if (!plate.image_data) {
      return;
    }

    const win = window.open();
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>License Plate Image - ${plate.plate_number}</title>
          </head>
          <body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000;">
            <img src="${getImageUrl(plate.image_data)}" 
                 style="max-width: 100%; max-height: 100vh; object-fit: contain;" 
                 alt="${plate.plate_number}" />
          </body>
        </html>
      `);
    }
  };

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Search className="text-gray-400 dark:text-gray-500" />
            <Input
              placeholder="Search plates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="text-gray-400 dark:text-gray-500" />
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {availableTags.map(tag => (
                  <SelectItem key={tag.name} value={tag.name}>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-md border dark:border-gray-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Plate Number</TableHead>
                <TableHead>Vehicle Description</TableHead>
                <TableHead>Occurrences</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((plate) => (
                <TableRow key={plate.id}>
                  <TableCell>
                    <a 
                      href={getImageUrl(plate.image_data)}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="cursor-pointer"
                      onClick={(e) => handleImageClick(e, plate)}
                    >
                      <Image
                        src={`data:image/jpeg;base64,${plate.image_data}`}
                        alt={plate.plate_number}
                        width={100}
                        height={75}
                        className="rounded hover:opacity-80 transition-opacity"
                      />
                    </a>
                  </TableCell>
                  <TableCell className={`font-medium font-mono ${plate.flagged && 'text-[#F31260]'} `}>
                    {plate.plate_number}
                    {plate.known_name && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 font-sans">{plate.known_name}</div>
                    )}
                  </TableCell>
                  <TableCell>{plate.vehicle_description}</TableCell>
                  <TableCell>{plate.occurrence_count}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {plate.tags?.length > 0 ? (
                        plate.tags.map((tag) => (
                          <Badge 
                            key={tag.name} 
                            variant="secondary"
                            className="text-xs py-0.5 pl-2 pr-1 flex items-center space-x-1"
                            style={{ backgroundColor: tag.color, color: '#fff' }}
                          >
                            <span>{tag.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 p-0 hover:bg-red-500 hover:text-white rounded-full"
                              onClick={() => handleRemoveTag(plate.plate_number, tag.name)}
                            >
                              <X className="h-3 w-3" />
                              <span className="sr-only">Remove {tag.name} tag</span>
                            </Button>
                          </Badge>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400 italic">No tags</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(plate.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Tag className="h-4 w-4" />
                            <span className="sr-only">Add tag</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {availableTags.map(tag => (
                          <DropdownMenuItem 
                            key={tag.name} 
                            onClick={() => handleAddTag(plate.plate_number, tag.name)}
                          >
                            <div className="flex items-center">
                              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </div>
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setActivePlate(plate)
                          setIsAddKnownPlateOpen(true)
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Add to known plates</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          setActivePlate(plate)
                          setIsDeleteConfirmOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete record</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={isAddKnownPlateOpen} onOpenChange={setIsAddKnownPlateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Known Plates</DialogTitle>
            <DialogDescription>
              Add details for the plate {activePlate?.plate_number}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newKnownPlate.name}
                onChange={(e) => setNewKnownPlate({ ...newKnownPlate, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={newKnownPlate.notes}
                onChange={(e) => setNewKnownPlate({ ...newKnownPlate, notes: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddKnownPlate}>Add to Known Plates</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record? This will not delete the plate from the known plates table.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteRecord}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
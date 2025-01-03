"use client";

import { useState, useEffect } from "react";
import { X, Plus, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { getTags, addTag, removeTag, updateTag } from "@/app/actions";
import DashboardLayout from "@/components/layout/MainLayout";
import TitleNavbar from "@/components/layout/TitleNav";

const TagDialog = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode = "create",
}) => {
  const [tagName, setTagName] = useState(initialData?.name ?? "");
  const [tagColor, setTagColor] = useState(initialData?.color ?? "#22c55e");

  useEffect(() => {
    if (isOpen) {
      setTagName(initialData?.name ?? "");
      setTagColor(initialData?.color ?? "#22c55e");
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (tagName.trim()) {
      const formData = new FormData();
      formData.append("name", tagName.trim());
      formData.append("color", tagColor);
      if (mode === "edit") {
        formData.append("originalName", initialData.name);
      }
      onSubmit(formData);
    }
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Create New Tag" : "Edit Tag"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tagName">Tag Name</Label>
          <Input
            id="tagName"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="Enter tag name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tagColor">Tag Color</Label>
          <div className="flex space-x-2">
            <Input
              id="tagColor"
              type="color"
              value={tagColor}
              onChange={(e) => setTagColor(e.target.value)}
              className="w-12 p-1 h-10"
            />
            <Input
              value={tagColor}
              onChange={(e) => setTagColor(e.target.value)}
              placeholder="#RRGGBB"
              className="flex-grow"
            />
          </div>
        </div>
        <Button type="submit" className="w-full">
          {mode === "create" ? "Create Tag" : "Save Changes"}
        </Button>
      </form>
    </DialogContent>
  );
};

const ElegantTagManagement = () => {
  const [tags, setTags] = useState([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState(null);

  useEffect(() => {
    const loadTags = async () => {
      const result = await getTags();
      if (result.success) {
        setTags(result.data);
      }
    };
    loadTags();
  }, []);

  const onCreateTag = async (formData) => {
    try {
      const result = await addTag(formData);
      if (result.success) {
        setTags([...tags, result.data]);
        setIsCreateDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to create tag:", error);
    }
  };

  const onUpdateTag = async (formData) => {
    try {
      const result = await updateTag(formData);
      if (result.success) {
        setTags(
          tags.map((tag) =>
            tag.name === formData.get("originalName") ? result.data : tag
          )
        );
        setIsEditDialogOpen(false);
        setEditingTag(null);
      }
    } catch (error) {
      console.error("Failed to update tag:", error);
    }
  };

  const onDeleteTag = async (tagName) => {
    try {
      const formData = new FormData();
      formData.append("name", tagName);
      const result = await removeTag(formData);
      if (result.success) {
        setTags(tags.filter((tag) => tag.name !== tagName));
      }
    } catch (error) {
      console.error("Failed to delete tag:", error);
    }
  };

  return (
    <DashboardLayout>
      <TitleNavbar title="Plate Database">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Tags</h3>
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tag
                </Button>
              </DialogTrigger>
              <TagDialog
                isOpen={isCreateDialogOpen}
                onClose={() => setIsCreateDialogOpen(false)}
                onSubmit={onCreateTag}
                initialData={null}
                mode="create"
              />
            </Dialog>
          </div>

          <ScrollArea className="h-[300px] w-full rounded-md border p-4">
            <div className="flex flex-wrap gap-3">
              {tags?.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="text-sm py-2 px-4 flex items-center space-x-2 hover:shadow-sm transition-shadow"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>{tag.name}</span>
                  <div className="flex items-center space-x-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-0 hover:bg-secondary rounded-full"
                      onClick={() => {
                        setEditingTag(tag);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                      <span className="sr-only">Edit {tag.name} tag</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                      onClick={() => onDeleteTag(tag.name)}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Delete {tag.name} tag</span>
                    </Button>
                  </div>
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <TagDialog
            isOpen={isEditDialogOpen}
            onClose={() => {
              setIsEditDialogOpen(false);
              setEditingTag(null);
            }}
            onSubmit={onUpdateTag}
            initialData={editingTag}
            mode="edit"
          />
        </Dialog>
      </TitleNavbar>
    </DashboardLayout>
  );
};

export default ElegantTagManagement;

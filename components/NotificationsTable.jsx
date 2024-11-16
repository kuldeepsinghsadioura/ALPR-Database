"use client";

import { useState } from "react";
import {
  addNotificationPlate,
  toggleNotification,
  deleteNotification,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export function NotificationsTable({ initialData }) {
  const [data, setData] = useState(initialData);
  const [newPlate, setNewPlate] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [plateToDelete, setPlateToDelete] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newPlate) return;

    const formData = new FormData();
    formData.append("plateNumber", newPlate.toUpperCase());

    const result = await addNotificationPlate(formData);
    if (result) {
      setData((prev) => [result, ...prev]);
      setNewPlate("");
    }
  };

  const handleToggle = async (plateNumber, enabled) => {
    const formData = new FormData();
    formData.append("plateNumber", plateNumber);
    formData.append("enabled", (!enabled).toString());

    const result = await toggleNotification(formData);
    if (result) {
      setData((prev) =>
        prev.map((p) =>
          p.plate_number === plateNumber ? { ...p, enabled: !enabled } : p
        )
      );
    }
  };

  const handleDeleteClick = (plate) => {
    setPlateToDelete(plate);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!plateToDelete) return;

    const formData = new FormData();
    formData.append("plateNumber", plateToDelete.plate_number);

    await deleteNotification(formData); // Pass the formData
    setData((prev) =>
      prev.filter((p) => p.plate_number !== plateToDelete.plate_number)
    );
    setIsDeleteConfirmOpen(false);
    setPlateToDelete(null);
  };

  return (
    <Card>
      <CardContent className="py-4">
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <Input
            placeholder="Enter plate number..."
            value={newPlate}
            onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
            className="w-64"
          />
          <Button type="submit">Create Notification</Button>
        </form>

        <div className="rounded-md border dark:border-gray-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plate Number</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Notifications</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">
                    No notification plates configured
                  </TableCell>
                </TableRow>
              ) : (
                data.map((plate) => (
                  <TableRow key={plate.plate_number}>
                    <TableCell className="font-medium font-mono">
                      {plate.plate_number}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {plate.tags?.length > 0 ? (
                          plate.tags.map((tag) => (
                            <Badge
                              key={tag.name}
                              variant="secondary"
                              className="text-xs py-0.5 px-2"
                              style={{
                                backgroundColor: tag.color,
                                color: "#fff",
                              }}
                            >
                              {tag.name}
                            </Badge>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                            No tags
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={plate.enabled}
                        onCheckedChange={() =>
                          handleToggle(plate.plate_number, plate.enabled)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteClick(plate)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Notification</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove notifications for plate{" "}
              {plateToDelete?.plate_number}? This will stop all notifications
              for this plate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

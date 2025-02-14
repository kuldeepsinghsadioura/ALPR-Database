"use client";
import { useState } from "react";
import {
  addNotificationPlate,
  toggleNotification,
  deleteNotification,
  updateNotificationPriority,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Bell, Search } from "lucide-react";

const priorityOptions = [
  { value: -2, label: "Lowest", description: "No notification or alert" },
  { value: -1, label: "Low", description: "Quiet notification" },
  { value: 0, label: "Normal", description: "Normal notification" },
  { value: 1, label: "High", description: "High-priority notification" },
  { value: 2, label: "Emergency", description: "Require confirmation" },
];

export function NotificationsTable({ initialData }) {
  const [data, setData] = useState(initialData);
  const [newPlate, setNewPlate] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [plateToDelete, setPlateToDelete] = useState(null);
  const [testStatus, setTestStatus] = useState(null);

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

  const handlePriorityChange = async (plateNumber, priority) => {
    const result = await updateNotificationPriority({
      plateNumber,
      priority,
    });

    if (result.success) {
      setData((prev) =>
        prev.map((p) =>
          p.plate_number === plateNumber
            ? { ...p, priority: parseInt(priority) }
            : p
        )
      );
    }
  };

  const handleTestNotification = async (plateNumber) => {
    try {
      setTestStatus({
        type: "loading",
        message: "Sending test notification...",
      });
      const formData = new FormData();
      formData.append("plateNumber", plateNumber);
      formData.append("message", "This is a test notification");

      const response = await fetch("/api/notifications/test", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setTestStatus({
          type: "success",
          message: "Test notification sent successfully!",
        });
      } else {
        throw new Error(result.error || "Failed to send test notification");
      }
    } catch (error) {
      setTestStatus({ type: "error", message: error.message });
    }

    // Clear status after 3 seconds
    setTimeout(() => setTestStatus(null), 3000);
  };

  const handleDeleteClick = (plate) => {
    setPlateToDelete(plate);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!plateToDelete) return;

    const formData = new FormData();
    formData.append("plateNumber", plateToDelete.plate_number);

    await deleteNotification(formData);
    setData((prev) =>
      prev.filter((p) => p.plate_number !== plateToDelete.plate_number)
    );
    setIsDeleteConfirmOpen(false);
    setPlateToDelete(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="py-4 ">
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <Input
            placeholder="Enter plate number..."
            value={newPlate}
            onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
            className="w-80 dark:bg-[#0e0e10]"
            icon={
              <Search size={16} className="text-gray-400 dark:text-gray-500 " />
            }
          />
          <Button type="submit">Create Notification</Button>
        </form>

        {testStatus && (
          <Alert
            className={`mb-4 ${
              testStatus.type === "error"
                ? "bg-red-50 text-red-900 border-red-200"
                : testStatus.type === "success"
                ? "bg-green-50 text-green-900 border-green-200"
                : "bg-blue-50 text-blue-900 border-blue-200"
            }`}
          >
            <AlertDescription>{testStatus.message}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border dark:bg-[#0e0e10] px-2">
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
                      <Select
                        value={String(plate.priority ?? 1)}
                        onValueChange={(value) =>
                          handlePriorityChange(plate.plate_number, value)
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={String(option.value)}
                            >
                              <div>
                                <div>{option.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {option.description}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-blue-500 hover:text-blue-700"
                          onClick={() =>
                            handleTestNotification(plate.plate_number)
                          }
                          title="Send test notification"
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteClick(plate)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
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
    </div>
  );
}

// components/TestNotificationButton.jsx
"use client";
import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TestNotificationButton({ plateNumber }) {
  const [testStatus, setTestStatus] = useState(null);

  const handleTestNotification = async () => {
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

    setTimeout(() => setTestStatus(null), 3000);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-blue-500 hover:text-blue-700"
        onClick={handleTestNotification}
        title="Send test notification"
      >
        <Bell className="h-4 w-4" />
      </Button>
      {testStatus && (
        <Alert
          className={`absolute mt-2 ${
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
    </>
  );
}

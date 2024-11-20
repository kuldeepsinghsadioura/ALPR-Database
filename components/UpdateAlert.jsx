"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getVersionInfo } from "@/lib/version";

const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export default function VersionAlert() {
  const [versionInfo, setVersionInfo] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [isAlertVisible, setIsAlertVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Don't spam the update alert
    const checkDismissalState = () => {
      try {
        const dismissedData = localStorage.getItem("versionAlertDismissed");
        if (dismissedData) {
          const { timestamp, version } = JSON.parse(dismissedData);
          const now = Date.now();

          if (
            now - timestamp < DISMISS_DURATION &&
            version === versionInfo?.latest
          ) {
            setIsAlertVisible(false);
            return;
          }
        }
        setIsAlertVisible(true);
      } catch (error) {
        console.error("Error checking dismissal state:", error);
        setIsAlertVisible(true);
      }
    };

    // Initial check
    startTransition(async () => {
      try {
        const info = await getVersionInfo();
        if (info) {
          setVersionInfo(info);
          checkDismissalState();
        }
      } catch (error) {
        console.error("Error checking version:", error);
      }
    });

    // Check every 30 minutes
    const interval = setInterval(() => {
      startTransition(async () => {
        try {
          const info = await getVersionInfo();
          if (info) {
            setVersionInfo(info);
            checkDismissalState();
          }
        } catch (error) {
          console.error("Error checking version:", error);
        }
      });
    }, CHECK_INTERVAL);

    return () => {
      clearInterval(interval);
      setMounted(false);
    };
  }, [versionInfo?.latest]);

  const handleDismiss = () => {
    try {
      // Save dismissal time and version to localStorage
      localStorage.setItem(
        "versionAlertDismissed",
        JSON.stringify({
          timestamp: Date.now(),
          version: versionInfo.latest,
        })
      );
    } catch (error) {
      console.error("Error saving dismissal state:", error);
    }
    setIsAlertVisible(false);
  };

  // Don't render anything during SSR
  if (!mounted) return null;

  // Don't render if we don't have version info or no update is needed or alert is closed
  if (
    isPending ||
    !versionInfo?.latest ||
    !versionInfo?.needsUpdate ||
    !isAlertVisible
  ) {
    return null;
  }

  return (
    <>
      <div className="relative mb-4">
        <Alert variant="warning" className="pr-12">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Update Available</AlertTitle>
          <AlertDescription>
            A new version ({versionInfo.latest}) is available. You are currently
            running version {versionInfo.current}.
            <div className="mt-2">
              <Button
                variant="outline"
                className="mr-2"
                onClick={() => setIsModalOpen(true)}
              >
                View Update Instructions
              </Button>
            </div>
          </AlertDescription>
        </Alert>
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2 h-8 w-8 p-0 hover:bg-slate-100"
          onClick={handleDismiss}
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Update Instructions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-4">
                In the same directory you originally deployed from:
              </p>
              <p className="mb-2">
                1. Get the latest database schema in case any changes were made:
              </p>
              <div className="bg-slate-950 dark:bg-neutral-800 text-slate-50 p-3 rounded-md font-mono text-sm">
                curl -O
                https://raw.githubusercontent.com/algertc/ALPR-Database/main/schema.sql
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                This file should be in the same directory as your
                docker-compose.yml file. Alternatively, you can
                <a
                  href="https://github.com/algertc/ALPR-Database/blob/main/schema.sql"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 ml-1"
                >
                  download it manually from GitHub
                </a>
                .
              </p>
            </div>

            <div>
              <p className="mb-2">
                2. Restart the application with the latest version:
              </p>
              <div className="bg-slate-950 dark:bg-neutral-800 text-slate-50 p-3 rounded-md font-mono text-sm">
                docker compose pull
              </div>
              <div className="bg-slate-950 dark:bg-neutral-800 text-slate-50 p-3 rounded-md font-mono text-sm">
                docker compose up -d
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Run these commands in the directory containing your
                docker-compose.yml file.
              </p>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Note: Your existing data will be preserved during the update.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";

const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export default function VersionAlert() {
  const [versionInfo, setVersionInfo] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [isAlertVisible, setIsAlertVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChangeLogOpen, setIsChangeLogOpen] = useState(false);

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
            <div className="flex mt-2 gap-2">
              <Button
                variant="outline"
                className="mr-2"
                onClick={() => setIsModalOpen(true)}
              >
                View Update Instructions
              </Button>
              <Button
                variant="outline"
                className="mr-2"
                onClick={() => setIsChangeLogOpen(true)}
              >
                View Changelog
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
          <div className="space-y-6">
            {/* Option 1: Automatic Update */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-lg font-semibold">
                Option 1: Automatic Update (Linux/MacOS only)
              </h3>
              <p className="text-sm">
                In the same directory you originally deployed from, run these
                commands to download and execute the automatic update script:
              </p>
              <div className="bg-slate-950 dark:bg-neutral-800 text-slate-50 p-3 rounded-md font-mono text-sm mb-2">
                curl -O
                https://raw.githubusercontent.com/algertc/ALPR-Database/refs/heads/main/update.sh
              </div>
              <div className="bg-slate-950 dark:bg-neutral-800 text-slate-50 p-3 rounded-md font-mono text-sm mb-2">
                chmod +x update.sh
              </div>
              <div className="bg-slate-950 dark:bg-neutral-800 text-slate-50 p-3 rounded-md font-mono text-sm">
                ./update.sh
              </div>
              <p className="text-sm text-muted-foreground">
                Follow the on-screen instructions after running the update
                script.
              </p>
            </div>

            {/* Option 2: Manual Update */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-lg font-semibold">Option 2: Manual Update</h3>
              <div>
                <p className="text-sm">
                  In the same directory you originally deployed from:
                </p>
                <p className="mb-2">
                  1. Get the migrations.sql file to update your database schema:
                </p>
                <div className="bg-slate-950 dark:bg-neutral-800 text-slate-50 p-3 rounded-md font-mono text-sm">
                  curl -O
                  https://raw.githubusercontent.com/algertc/ALPR-Database/main/migrations.sql
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  This file should be in the same directory as your
                  docker-compose.yml file. Alternatively, you can
                  <a
                    href="https://github.com/algertc/ALPR-Database/blob/main/migrations.sql"
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
                  2. Check for updates to the
                  <a
                    href="https://github.com/algertc/ALPR-Database/blob/main/docker-compose.yml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 ml-1"
                  >
                    docker-compose.yml
                  </a>
                  {"  "}
                  file on GitHub. Ensure your file is up-to-date with the latest
                  version.
                </p>
              </div>
              <p className="mb-2">
                3. Create the a directory called &quot;storage&quot; in the same
                location as your auth and config directories.
              </p>
              <div>
                <p className="mb-2">
                  4. Restart the application with the latest version:
                </p>
                <div className="bg-slate-950 dark:bg-neutral-800 text-slate-50 p-3 rounded-md font-mono text-sm mb-2">
                  docker compose pull
                </div>
                <div className="bg-slate-950 dark:bg-neutral-800 text-slate-50 p-3 rounded-md font-mono text-sm">
                  docker compose up -d
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-2">
              Note: Your existing data will be preserved during the update.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isChangeLogOpen} onOpenChange={setIsChangeLogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Changelog</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {!versionInfo || !versionInfo.changelog ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No changelog available</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Array.isArray(versionInfo.changelog) &&
                  versionInfo.changelog.map((version) => (
                    <div key={version.version} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">
                          Version {version.version}
                        </h3>
                        {version.version === versionInfo.current && (
                          <Badge variant="outline" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {version.date}
                      </p>
                      <ul className="space-y-1 list-disc list-inside">
                        {version.changes &&
                          version.changes.map((change, index) => (
                            <li key={index} className="text-sm">
                              {change}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

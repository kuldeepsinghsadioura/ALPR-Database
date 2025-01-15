import { Suspense } from "react";
import { unstable_noStore } from "next/cache";
import { getSystemLogs } from "@/app/actions";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import LogViewer from "./LogViewer";
import DashboardLayout from "@/components/layout/MainLayout";

async function LogsContent() {
  unstable_noStore();
  const { data: logs, error } = await getSystemLogs();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return <LogViewer initialLogs={logs} />;
}

export default function LogsPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col py-4 px-6">
        <div className="container flex h-14 items-center">
          <div className="flex items-center mb-3">
            <h1 className="text-2xl font-medium">System Settings</h1>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full w-8 h-8 border-b-2 border-primary" />
            </div>
          }
        >
          <LogsContent />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}

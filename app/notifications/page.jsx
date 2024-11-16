// app/notifications/page.jsx
import { getNotificationPlates } from "@/app/actions";
import { NotificationsTable } from "@/components/NotificationsTable";
import DashboardLayout from "@/components/layout/MainLayout";
import BasicTitle from "@/components/layout/BasicTitle";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const response = await getNotificationPlates();
  const notificationPlates = response.success ? response.data : [];

  return (
    <DashboardLayout>
      <BasicTitle title="Push Notifications">
        {notificationPlates.length > 0 ? (
          <NotificationsTable initialData={notificationPlates} />
        ) : (
          <p>No notifications found in the database.</p>
        )}
      </BasicTitle>
    </DashboardLayout>
  );
}

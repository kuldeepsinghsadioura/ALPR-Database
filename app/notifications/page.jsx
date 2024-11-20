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
        <NotificationsTable initialData={notificationPlates} />
      </BasicTitle>
    </DashboardLayout>
  );
}

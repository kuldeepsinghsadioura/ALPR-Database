import { getFlagged, getNotificationPlates } from '@/app/actions'
import { FlaggedPlatesTable } from '@/components/FlaggedPlatesTable'
import DashboardLayout from '@/components/layout/MainLayout'
import BasicTitle from '@/components/layout/BasicTitle'
import { NotificationsTable } from '@/components/NotificationsTable';

export default async function FlaggedPlatesPage() {
  const notificationPlates = await getNotificationPlates();
  
  return (
    <DashboardLayout>
      <BasicTitle title="Push Notifications">
        <NotificationsTable initialData={notificationPlates}/>
      </BasicTitle>
    </DashboardLayout>
  );
}
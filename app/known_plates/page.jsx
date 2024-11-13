import { getKnownPlates } from '@/lib/db';
import { KnownPlatesTable } from '@/components/KnownPlatesTable';
import DashboardLayout from '@/components/layout/MainLayout';

import { ThemeToggle } from '@/components/ThemeToggle';
import BasicTitle from '@/components/layout/BasicTitle';

export default async function KnownPlatesPage() {
  // Get initial data
  const knownPlates = await getKnownPlates();
  
  return (
    <DashboardLayout>
        <BasicTitle title="Known Plates">
            <KnownPlatesTable initialData={knownPlates} />
        </BasicTitle>
    </DashboardLayout>
  );
}
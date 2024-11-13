import { getKnownPlates, getPlateReads } from '@/lib/db';
import { KnownPlatesTable } from '@/components/KnownPlatesTable';
import DashboardLayout from '@/components/layout/MainLayout';

import { ThemeToggle } from '@/components/ThemeToggle';
import BasicTitle from '@/components/layout/BasicTitle';
import PlateTable from '@/components/PlateTable';

export default async function KnownPlatesPage() {
  // Get initial data
  const plateReads = await getPlateReads();
  
  return (
    <DashboardLayout>
        <BasicTitle title="Live ALPR Feed" recording={true}>
            <PlateTable initialData={plateReads} />
        </BasicTitle>
    </DashboardLayout>
  );
}
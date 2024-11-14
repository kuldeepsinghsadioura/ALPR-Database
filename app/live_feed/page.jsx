import { Suspense } from 'react';
import { PlateTableWrapper } from '@/components/PlateTableWrapper';
import DashboardLayout from '@/components/layout/MainLayout';
import BasicTitle from '@/components/layout/BasicTitle';
import { getLatestPlateReads } from '../actions';

export default function LivePlates() {
  return (
    <DashboardLayout>
      <BasicTitle title="Live ALPR Feed" recording={true}>
        <Suspense fallback={<div>Loading...</div>}>
          <PlateTableWrapper />
        </Suspense>
      </BasicTitle>
    </DashboardLayout>
  );
}
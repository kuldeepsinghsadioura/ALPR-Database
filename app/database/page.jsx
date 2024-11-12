import { getPlateReads } from '@/lib/db';
import { initMqtt } from '@/lib/mqtt-client';
import PlateTable from '@/components/PlateTable';
import { ThemeToggle } from "@/components/ThemeToggle";
import DashboardLayout from '@/components/layout/MainLayout';
import TitleNavbar from '@/components/layout/TitleNav';

export default async function Database() {
  // Initialize MQTT client on server
  initMqtt();
  
  // Get initial data
  const plateReads = await getPlateReads();
  
  return (

    <DashboardLayout>
        <TitleNavbar title="Plate Database">
            <PlateTable initialData={plateReads} />
        </TitleNavbar>
    </DashboardLayout>
  );
}

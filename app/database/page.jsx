import { getPlateReads } from "@/lib/db";
import { initMqtt } from "@/lib/mqtt-client";
import PlateTable from "@/components/PlateTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import DashboardLayout from "@/components/layout/MainLayout";
import TitleNavbar from "@/components/layout/TitleNav";
import PlateDbTable from "@/components/plateDbTable";
import { getPlates } from "@/app/actions";

export default async function Database() {
  const plateReads = await getPlates();

  return (
    <DashboardLayout>
      <TitleNavbar title="Plate Database">
        <PlateDbTable initialData={plateReads} />
      </TitleNavbar>
    </DashboardLayout>
  );
}

import { getKnownPlates } from "@/lib/db";
import { KnownPlatesTable } from "@/components/KnownPlatesTable";
import DashboardLayout from "@/components/layout/MainLayout";

import { ThemeToggle } from "@/components/ThemeToggle";
import BasicTitle from "@/components/layout/BasicTitle";
export const dynamic = "force-dynamic";

export default async function KnownPlatesPage() {
  const knownPlates = await getKnownPlates();

  return (
    <DashboardLayout>
      <BasicTitle title="Known Plates">
        <KnownPlatesTable initialData={knownPlates} />
      </BasicTitle>
    </DashboardLayout>
  );
}

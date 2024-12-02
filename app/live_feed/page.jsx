import { PlateTableWrapper } from "@/components/PlateTableWrapper";
import DashboardLayout from "@/components/layout/MainLayout";
import BasicTitle from "@/components/layout/BasicTitle";

export default function LivePlates() {
  return (
    <DashboardLayout>
      <BasicTitle title="Live ALPR Feed" recording={true}>
        <PlateTableWrapper />
      </BasicTitle>
    </DashboardLayout>
  );
}

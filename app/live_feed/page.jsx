import {
  getSettings,
  getLatestPlateReads,
  getTags,
  getCameraNames,
  getTimeFormat,
} from "@/app/actions";

import PlateTableWrapper from "@/components/PlateTableWrapper";
import DashboardLayout from "@/components/layout/MainLayout";
import BasicTitle from "@/components/layout/BasicTitle";
import { Suspense } from "react";
import LiveFeedSkeleton from "@/components/LiveFeedSkeleton";
import Link from "next/link";
import TitleNavbar from "@/components/layout/LiveFeedNav";

import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function LivePlates(props) {
  const searchParams = await props.searchParams;

  const params = {
    page: parseInt(searchParams?.page || "1"),
    pageSize: parseInt(searchParams?.pageSize || "25"),
    search: searchParams?.search || "",
    fuzzySearch: searchParams?.fuzzySearch === "true",
    tag: searchParams?.tag || "all",
    dateRange:
      searchParams?.dateFrom && searchParams?.dateTo
        ? { from: searchParams.dateFrom, to: searchParams.dateTo }
        : null,
    hourRange:
      searchParams?.hourFrom && searchParams?.hourTo
        ? {
            from: parseInt(searchParams.hourFrom),
            to: parseInt(searchParams.hourTo),
          }
        : null,
    cameraName: searchParams?.camera,
    sortField: searchParams?.sortField,
    sortDirection: searchParams?.sortDirection,
  };

  const [platesRes, tagsRes, camerasRes, timeFormat, config] =
    await Promise.all([
      getLatestPlateReads(params),
      getTags(),
      getCameraNames(),
      getTimeFormat(),
      getSettings(),
    ]);

  return (
    <DashboardLayout>
      <TitleNavbar title="ALPR Recognition Feed">
        {/* <BasicTitle
        title="ALPR Recognition Feed"
        recording={true}
        subtitle={
          "Monitor and manage the traffic on your ALPR system in real time."
        }
      >
        <div className="flex gap-2 items-center">
          <Link href="/live_feed">
            <Button
              variant="outline"
              size="sm"
              className={usePathname === "/live_feed" ? "bg-muted" : ""}
            >
              Table View
            </Button>
          </Link>
          <Link href="/live_feed/viewer">
            <Button
              variant="outline"
              size="sm"
              className={pathname === "/live_feed/viewer" ? "bg-muted" : ""}
            >
              Live Viewer
            </Button>
          </Link>
        </div> */}
        <Suspense fallback={<LiveFeedSkeleton />}>
          <PlateTableWrapper
            data={platesRes.data}
            total={platesRes.pagination.total}
            tags={tagsRes.success ? tagsRes.data : []}
            cameras={camerasRes.success ? camerasRes.data : []}
            timeFormat={timeFormat}
            biHost={config?.blueiris?.host} // Add this line
          />
        </Suspense>
      </TitleNavbar>
    </DashboardLayout>
  );
}

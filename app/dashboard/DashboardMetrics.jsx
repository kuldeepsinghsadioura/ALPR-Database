"use client";

import { useState, useEffect, Suspense } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  fetchPlateImagePreviews,
  getDashboardMetrics,
  getTimeFormat,
} from "@/app/actions";
import {
  AlertTriangle,
  TrendingUp,
  Car,
  Eye,
  Calendar,
  Clock,
  Database,
  ExternalLink,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TimeFrameSelector } from "./TimeSelect";
import { TagDistributionChart } from "./TagDistribution";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { DummyChart } from "./dummyChart";
import { FaRoad, FaGithub, FaDocker } from "react-icons/fa";

export function formatTimeRange(hour, timeFormat) {
  if (timeFormat === 24) {
    return `${String(hour).padStart(2, "0")}:00`;
  }

  const period = hour >= 12 ? "PM" : "AM";
  const adjustedHour = hour % 12 || 12;
  return `${adjustedHour}${period}`;
}

const PlateImagePreviews = ({ plate, timeFrame }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadImages = async () => {
      try {
        setLoading(true);
        const fetchedImages = await fetchPlateImagePreviews(plate, timeFrame);
        if (mounted) {
          setImages(fetchedImages || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadImages();

    return () => {
      mounted = false;
    };
  }, [plate, timeFrame]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
        Error loading images
      </div>
    );
  }

  if (!images?.length) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
        No recent images available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {images.map((img, idx) => (
        <div
          key={idx}
          className="relative aspect-video bg-muted rounded-sm overflow-hidden"
        >
          <Image
            src={`data:image/jpeg;base64,${img.image_data}`}
            alt={`Capture from ${new Date(img.capture_time).toLocaleString()}`}
            fill
            className="object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] bg-black/50 text-white">
            {new Date(img.capture_time).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
};

const ClickableBar = ({ payload, x, y, width, height, radius }) => {
  // Get the local hour number from the payload
  const localHour = payload.hour_block;

  // Get timezone offset in hours
  const tzOffset = -(new Date().getTimezoneOffset() / 60);

  // Convert to UTC for the query parameters
  let utcFrom = (localHour - tzOffset + 24) % 24;
  let utcTo = (localHour - tzOffset + 24) % 24;

  return (
    <Link
      href={{
        pathname: "/live_feed",
        query: {
          page: 1,
          hourFrom: Math.floor(utcFrom).toString().padStart(2, "0"),
          hourTo: Math.floor(utcTo).toString().padStart(2, "0"),
        },
      }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={radius}
        ry={radius}
        fill="var(--color-frequency)"
        className="cursor-pointer hover:opacity-80 transition-opacity"
      />
    </Link>
  );
};

export default function DashboardMetrics() {
  const [metrics, setMetrics] = useState({
    time_distribution: [],
    total_plates_count: 0,
    total_reads: 0,
    unique_plates: 0,
    weekly_unique: 0,
    suspicious_count: 0,
    top_plates: [],
  });

  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [timeFormat, setTimeFormat] = useState(12); // Default to 12
  const [timeFrame, setTimeFrame] = useState("24h");

  useEffect(() => {
    async function fetchData() {
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const endDate = new Date();
        const startDate = new Date();
        //startDate.setDate(endDate.getDate() - 7);

        switch (timeFrame) {
          case "3d":
            startDate.setDate(endDate.getDate() - 3);
            break;
          case "7d":
            startDate.setDate(endDate.getDate() - 7);
            break;
          case "30d":
            startDate.setDate(endDate.getDate() - 30);
            break;
          case "all":
            startDate.setFullYear(2000); // Or some early date
            break;
          default: // 24h
            startDate.setDate(endDate.getDate() - 1);
        }

        // Fetch both metrics and timeFormat
        const [data, config] = await Promise.all([
          getDashboardMetrics(timeZone, startDate, endDate),
          getTimeFormat(),
        ]);

        setTimeFormat(config);

        const sanitizedData = {
          ...data,
          time_distribution: Array.isArray(data?.time_distribution)
            ? data.time_distribution
            : [],
          top_plates: Array.isArray(data?.top_plates) ? data.top_plates : [],
          total_plates_count: parseInt(data?.total_plates_count) || 0,
          total_reads: parseInt(data?.total_reads) || 0,
          unique_plates: parseInt(data?.unique_plates) || 0,
          weekly_unique: parseInt(data?.weekly_unique) || 0,
          suspicious_count: parseInt(data?.suspicious_count) || 0,
        };
        setMetrics(sanitizedData);
      } catch (error) {
        console.error("Error fetching data:", error);
        setMetrics({
          time_distribution: [],
          total_plates_count: 0,
          total_reads: 0,
          unique_plates: 0,
          weekly_unique: 0,
          suspicious_count: 0,
          top_plates: [],
        });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [timeFrame]);

  //Transform time distribution data
  const timeDistributionData = metrics.time_distribution
    .filter((item) => item && typeof item.hour_block === "number")
    .map((item) => ({
      timeRange: formatTimeRange(item.hour_block, timeFormat),
      frequency: parseInt(item.frequency) || 0,
      hour: item.hour_block,
    }))
    .sort((a, b) => a.hour - b.hour);

  const mostActiveTime =
    timeDistributionData.length > 0
      ? timeDistributionData.reduce((max, current) =>
          current.frequency > max.frequency ? current : max
        ).timeRange
      : "No data available";

  return (
    <div className="space-y-4">
      <div className="flex justify-between pt-4">
        <div className="flex gap-8 items-baseline mb-6">
          <h1 className="text-3xl font-bold">License Plate Dashboard</h1>
          <div className="flex gap-4 text-xl">
            <Link
              href="https://github.com/algertc/ALPR-Database"
              target="_blank"
            >
              <FaGithub className="hover:text-blue-500" />
            </Link>
            <Link
              href="https://hub.docker.com/repository/docker/algertc/alpr-dashboard/general"
              target="_blank"
            >
              <FaDocker className="hover:text-blue-500" />
            </Link>
            <Link
              href="https://alprdatabase.featurebase.app/roadmap"
              target="_blank"
            >
              <FaRoad className="hover:text-blue-500" />
            </Link>
          </div>
        </div>
        <TimeFrameSelector value={timeFrame} onValueChange={setTimeFrame} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-full md:max-h-[600px] 2xl:max-h-[800px] flex flex-col">
          <CardHeader>
            <CardTitle>Time Distribution</CardTitle>
            <CardDescription>
              Frequency of plate sightings by time of day ({timeFrame})
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[400px]">
            {loading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ChartContainer
                config={{
                  frequency: {
                    label: "Frequency",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="w-full h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.time_distribution.map((item) => ({
                      timeRange: formatTimeRange(item.hour_block, timeFormat),
                      frequency: Math.round(parseFloat(item.frequency)) || 0,
                      hour_block: item.hour_block,
                      fullLabel: `${formatTimeRange(
                        item.hour_block,
                        timeFormat
                      )} - ${Math.round(parseFloat(item.frequency))} reads`,
                    }))}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 50,
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="timeRange"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval="preserveStartEnd"
                      tick={(props) => {
                        const { x, y, payload } = props;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={0}
                              y={0}
                              dy={16}
                              textAnchor="end"
                              fill="currentColor"
                              transform="rotate(-45)"
                              className="text-xs md:text-sm"
                            >
                              {payload.value}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => Math.round(value)}
                    />
                    <ChartTooltip
                      cursor={{ fill: "rgba(0, 0, 0, 0.1)" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    Time
                                  </span>
                                  <span className="font-bold">
                                    {payload[0].payload.timeRange}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    Reads
                                  </span>
                                  <span className="font-bold">
                                    {payload[0].payload.frequency}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="frequency"
                      fill="var(--color-frequency)"
                      radius={4}
                      shape={<ClickableBar />}
                    >
                      <LabelList
                        dataKey="frequency"
                        position="top"
                        className="fill-foreground text-[10px] md:text-xs"
                        formatter={(value) => Math.round(value)}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 text-sm mt-auto">
            <div className="flex gap-2 font-medium leading-none">
              Most active time: {mostActiveTime}
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="leading-none text-muted-foreground">
              Total plate reads by hour over the last {timeFrame}
            </div>
          </CardFooter>
        </Card>

        <Card className="md:max-h-[600px] 2xl:max-h-[800px] overflow-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Top 10 Plates
              <span className="text-base font-normal text-muted-foreground">
                ({timeFrame})
              </span>
            </CardTitle>
            <CardDescription>
              Most frequently seen license plates in the last {timeFrame} -
              Hover to preview images
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="w-full h-16" />
                ))}
              </div>
            ) : (
              <ul className="space-y-3">
                {metrics.top_plates.map((plate, index) => (
                  <li
                    key={plate.plate}
                    className="flex items-center justify-between p-3 rounded-lg bg-neutral-100 dark:bg-zinc-900/70 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex items-center justify-center w-8 h-8 text-lg font-bold rounded-full bg-primary/10 text-primary">
                        {index + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <HoverCard>
                          <HoverCardTrigger>
                            <div className="space-y-1">
                              <p className="font-semibold">{plate.plate}</p>
                              {plate.name && (
                                <p className="text-md font-medium">
                                  {plate.name}
                                </p>
                              )}
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-96">
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-semibold mb-1">
                                  Recent Captures Quick Look
                                </h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                  Click the reads count to view all appearances
                                </p>
                                <Suspense
                                  fallback={
                                    <div className="flex items-center justify-center h-32">
                                      <Loader2 className="w-6 h-6 animate-spin" />
                                    </div>
                                  }
                                >
                                  <PlateImagePreviews
                                    plate={plate.plate}
                                    timeFrame={timeFrame}
                                  />
                                </Suspense>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                        {plate.tags && plate.tags.length > 0 && (
                          <>
                            <Separator
                              orientation="vertical"
                              className="h-10 mx-4"
                            />
                            <div className="flex gap-1">
                              {plate.tags.map((tag) => (
                                <Badge
                                  key={tag.name}
                                  style={{
                                    backgroundColor: tag.color,
                                    color: "white",
                                    textShadow: "0 1px 1px rgba(0,0,0,0.2)",
                                  }}
                                  className="text-xs h-fit"
                                >
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <Link
                      href={{
                        pathname: "/live_feed",
                        query: { search: plate.plate },
                      }}
                    >
                      <Button variant="secondary" size="sm" className="group">
                        <span className="mr-2">{plate.count} reads</span>
                        <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Metrics Grid */}
        <div className="xl:col-span-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              title="Total Unique Plates"
              value={metrics.total_plates_count}
              icon={<Database className="h-4 w-4" />}
              description="Total unique plates stored in the database"
              loading={loading}
            />
            <MetricCard
              title="Total Reads"
              value={metrics.total_reads}
              icon={<Eye className="h-4 w-4" />}
              description="License plates read during period"
              loading={loading}
            />
            <MetricCard
              title="Unique Vehicles"
              value={metrics.unique_plates}
              icon={<Car className="h-4 w-4" />}
              description="Distinct vehicles detected during period"
              loading={loading}
            />
            <MetricCard
              title="New Vehicles"
              value={metrics.new_plates_count}
              icon={<Calendar className="h-4 w-4" />}
              description="Vehicles detected for the first time during period"
              loading={loading}
            />
          </div>
          <DummyChart />
        </div>

        {/* Tag Distribution Chart */}
        <div className="xl:col-span-4">
          <TagDistributionChart
            data={metrics.tag_stats || []}
            loading={loading}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, description, loading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

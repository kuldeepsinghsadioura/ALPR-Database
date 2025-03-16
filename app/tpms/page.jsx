"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Thermometer,
  Radio,
  RefreshCw,
  Clock,
  ArrowUpRight,
  Maximize2,
  Map,
  Shield,
  Car,
  BarChart as BarChartIcon,
  Cpu,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/layout/MainLayout";
import TPMS from "@/components/icons/tpms";

// Uptime data
const uptimeData = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  uptime: Math.min(100, 98 + Math.random() * 2).toFixed(2),
}));

// Temperature data
const temperatureData = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  temperature: (25 + Math.sin(i / 3) * 5 + Math.random() * 2).toFixed(1),
}));

// Error data
const errorData = {
  total: 24,
  critical: 3,
  warning: 7,
  info: 14,
  recent: [
    {
      time: "14:32:15",
      type: "critical",
      message: "Signal loss",
    },
    {
      time: "14:28:42",
      type: "warning",
      message: "Too many vehicles in RF field",
    },
    {
      time: "14:21:17",
      type: "info",
      message: "2x Sensors Linked to Plate: D333X1",
    },
    {
      time: "14:15:03",
      type: "warning",
      message: "No Prediction from ALPR",
    },
  ],
};

// Generate a proper GQRX-like spectrum with low noise floor and peaks
const generateSpectrumData = () => {
  // Create base frequencies with consistently LOW power levels (proper noise floor)
  const result = Array.from({ length: 500 }, (_, i) => ({
    frequency: 315 + i * 0.01,
    // Most values should be VERY LOW (-100 to -105) = noise floor
    power: -100 - Math.random() * 5,
  }));

  // Add tiny noise variations to the floor
  result.forEach((point) => {
    point.power += Math.random() * 1 - 0.5; // Tiny fluctuations in noise floor
  });

  // Add sharp spikes ABOVE the noise floor
  const spikes = [
    { center: 317.5, height: 55, width: 0.015 }, // Main spike
    { center: 316.2, height: 20, width: 0.01 },
    { center: 318.9, height: 15, width: 0.008 },
  ];

  // Apply spikes that go UP from the noise floor
  spikes.forEach((spike) => {
    result.forEach((point) => {
      const distance = Math.abs(point.frequency - spike.center);
      if (distance < spike.width * 6) {
        // Sharp exponential falloff for pointy spikes
        const peakValue =
          spike.height *
          Math.exp(-(distance * distance) / (spike.width * spike.width * 0.08));
        // ADD to current power to create a spike ABOVE noise floor
        point.power += peakValue;
      }
    });
  });

  return result;
};

// Spectrum data
const baseSpectrumData = generateSpectrumData();

// Vehicle stats
const vehicleStats = {
  todayCount: 478,
  lastHourCount: 42,
  manufacturers: [
    { name: "Continental", count: 164, percentage: 34.3 },
    { name: "Michelin", count: 127, percentage: 26.6 },
    { name: "Bridgestone", count: 98, percentage: 20.5 },
    { name: "Goodyear", count: 56, percentage: 11.7 },
    { name: "Pirelli", count: 33, percentage: 6.9 },
  ],
  hourlyData: Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: Math.floor(15 + Math.random() * 45),
  })),
};

const generateRandomId = () => {
  return [...Array(40)]
    .map(() => Math.floor(Math.random() * 16).toString(16)) // Generate random hex digits (0-9, a-f)
    .join("");
};

// TPMS readings with improved data structure
const tireReadings = Array.from({ length: 12 }, (_, i) => {
  // Generate license plate
  const randomNum = Math.floor(Math.random() * 900) + 100;
  const randomLetters =
    String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
    String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
    String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const plateNumber = `${randomNum}${randomLetters}${randomNum}`;

  // Generate tags
  const tagOptions = [
    "delivery",
    "neighbor",
    "home services",
    "rideshare",
    "commercial",
    "school",
    "government",
    "unknown",
  ];
  const tag = tagOptions[Math.floor(Math.random() * tagOptions.length)];

  // Generate names for some entries
  const nameOptions = [
    "Amazon Prime",
    "UPS",
    "DoorDash",
    "FedEx",
    "John Doe",
    "ABC Plumbing",
    "XYZ Electric",
    "Uber",
    "David Tacoma",
    null,
    null,
    null,
  ];
  const knownName = nameOptions[Math.floor(Math.random() * nameOptions.length)];

  return {
    id: generateRandomId(),
    temperature: 38.0,
    plateNumber: plateNumber,
    psi: (30 + Math.random() * 10).toFixed(1),
    speed: Math.floor(Math.random() * 120),
    lastSeen: new Date(
      Date.now() - Math.random() * 3600000 * 24
    ).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    firstSeen: new Date(
      Date.now() - Math.random() * 3600000 * 24 * 30
    ).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
    }),
    tag: tag,
    knownName: knownName,
  };
});

// Custom chart tooltips
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-md shadow-md p-3">
        <p className="text-sm font-medium mb-1">{`Hour: ${label}:00`}</p>
        {payload.map((entry, index) => (
          <p
            key={`item-${index}`}
            className="text-xs"
            style={{ color: entry.color }}
          >
            {`${entry.name}: ${entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const SpectrumTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/90 border border-border rounded-md shadow-md p-2">
        <p className="text-xs font-medium">{`${Number(label).toFixed(
          3
        )} MHz`}</p>
        <p className="text-xs font-mono">{`${Number(payload[0]?.value).toFixed(
          1
        )} dBm`}</p>
      </div>
    );
  }
  return null;
};

export default function TPMSDashboard() {
  const [timeRange, setTimeRange] = useState("24h");
  const [spectrumData, setSpectrumData] = useState(baseSpectrumData);

  // Simulate spectrum updates
  useEffect(() => {
    let frameCount = 0;

    const intervalId = setInterval(() => {
      frameCount++;

      setSpectrumData((prevData) => {
        // Occasionally regenerate data
        if (frameCount % 20 === 0) {
          return generateSpectrumData();
        }

        // Most of the time, just make micro adjustments to the noise floor
        return prevData.map((point) => {
          // Tiny noise floor adjustments
          const noiseAdjustment = Math.random() * 0.4 - 0.2;

          // Very occasional random spike
          const randomSpike = Math.random() > 0.998 ? Math.random() * 10 : 0;

          return {
            ...point,
            power: point.power + noiseAdjustment + randomSpike,
          };
        });
      });
    }, 50);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <DashboardLayout>
      <div className="flex flex-col w-full min-h-screen">
        {/* Top navigation */}
        <div className="bg-background border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <TPMS size={28} />
            <h1 className="text-xl font-semibold tracking-tight">
              TPMS Signal Intelligence
            </h1>
            <Badge
              variant="outline"
              className="ml-4 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-900"
            >
              SYSTEM ONLINE
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <Select defaultValue="sensor 1">
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select station" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="station1">Station 1 - Downtown</SelectItem>
                <SelectItem value="station2">Station 2 - East Side</SelectItem>
                <SelectItem value="station3">Station 3 - Highway 80</SelectItem>
                <SelectItem value="sensor 1">Sensor 1 - North</SelectItem>
                <SelectItem value="station5">
                  Station 5 - West Bridge
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-6 mx-auto w-full">
          {/* Time range selector */}

          {/* Top stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="shadow-sm dark:bg-[#0e0e10]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  System Uptime
                </CardTitle>
                <Activity className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {uptimeData[uptimeData.length - 1].uptime}%
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-900"
                  >
                    Very Good
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm dark:bg-[#0e0e10]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Receiver CPU Usage
                </CardTitle>
                <Cpu className="h-4 w-4 " />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">38%</div>
                <div className="flex items-center gap-1 mt-2">
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-900"
                  >
                    Normal
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm dark:bg-[#0e0e10]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Signal Quality
                </CardTitle>
                <Radio className="h-4 w-4 " />
              </CardHeader>
              <CardContent className="">
                <div className="text-2xl font-bold">Excellent</div>
                <div className="flex items-center gap-1 mt-2">
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-900"
                  >
                    &lt;20 dB
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm dark:bg-[#0e0e10]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Vehicles Fingerprinted
                </CardTitle>
                <Car className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {vehicleStats.todayCount}
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <Badge
                    variant="outline"
                    className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900"
                  >
                    +{vehicleStats.lastHourCount} last hour
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-3 gap-6">
            {/* Left column */}
            <div className="col-span-2 space-y-6">
              {/* RF Spectrum with improved visualization */}
              <Card className="shadow-sm overflow-hidden dark:bg-[#0e0e10]">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>RF Spectrum Analyzer</CardTitle>
                      <CardDescription className="mt-1">
                        Raw FR spectrum data from the SDR
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 dark:bg-[#0e0e10]">
                  <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={spectrumData}
                        margin={{
                          top: 5,
                          right: 20,
                          left: 0,
                          bottom: 0,
                        }}
                      >
                        <XAxis
                          dataKey="frequency"
                          tickFormatter={(freq) => `${freq.toFixed(1)}`}
                          stroke="#555"
                          fontSize={10}
                          tick={{ fill: "#888" }}
                          domain={[315, 320]}
                        />
                        <YAxis
                          domain={[-80, -40]}
                          stroke="#555"
                          fontSize={10}
                          tick={{ fill: "#888" }}
                          tickFormatter={(value) => `${value}`}
                          width={30}
                        />
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#333"
                          vertical={false}
                        />
                        <Tooltip content={<SpectrumTooltip />} />
                        <defs>
                          <linearGradient id="spectrumGradient">
                            <stop
                              offset="0%"
                              stopColor="#0039e6"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="100%"
                              stopColor="#0039e6"
                              stopOpacity={0.9}
                            />
                          </linearGradient>
                        </defs>
                        <Area
                          type="#1c4aff"
                          dataKey="power"
                          stroke="#1cbbff"
                          fill="url(#spectrumGradient)"
                          fillOpacity={0.7}
                          dot={false}
                          isAnimationActive={false}
                          connectNulls={true}
                          baseValue={-105}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* System Alerts */}
              <Card className="shadow-sm dark:bg-[#0e0e10]">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>TPMS Database</CardTitle>
                      <CardDescription className="mt-1">
                        Recorded sensor data summary
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="h-8">
                      Analyze
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center mb-8 mt-8">
                    <div className="flex gap-8">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-red-500">
                          {errorData.critical}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Decode Error
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl font-bold text-yellow-500">
                          {errorData.warning}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          No Association
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl font-bold text-blue-500">
                          {errorData.info}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Associated
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {errorData.total}
                      </div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {errorData.recent.map((error, index) => (
                      <div
                        key={index}
                        className="flex gap-2 items-start border-b pb-2"
                      >
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            error.type === "critical"
                              ? "bg-red-500"
                              : error.type === "warning"
                              ? "bg-yellow-500"
                              : "bg-blue-500"
                          }`}
                        />
                        <div className="flex-grow min-w-0">
                          <div className="text-sm font-medium truncate">
                            {error.message}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {error.time}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Table */}
          <Card className="shadow-sm mt-6 dark:bg-[#0e0e10] border-border">
            <CardHeader className="px-6 py-5">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-semibold">
                    Tire Pressure Sensor Readings
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Recent TPMS data intercepted by the system
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-9">
                  Export Data
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pt-0 pb-0">
              <div className="overflow-x-auto">
                <Table className="">
                  <TableHeader className="">
                    <TableRow className="border-b border-border">
                      <TableHead className="w-[100px] px-6 py-3 bg-muted/30">
                        Sensor ID
                      </TableHead>
                      <TableHead className="w-[150px] px-6 py-3 bg-muted/30">
                        Associated License Plate
                      </TableHead>
                      <TableHead className="w-[180px] px-6 py-3 bg-muted/30">
                        Known Name
                      </TableHead>
                      <TableHead className="w-[100px] px-6 py-3 bg-muted/30">
                        Confidence
                      </TableHead>
                      <TableHead className="w-[140px] px-6 py-3 bg-muted/30">
                        First Seen
                      </TableHead>
                      <TableHead className="w-[140px] px-6 py-3 bg-muted/30">
                        Last Seen
                      </TableHead>
                      <TableHead className="w-[100px] px-6 py-3 bg-muted/30">
                        Tag
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tireReadings.map((reading, index) => (
                      <TableRow
                        key={index}
                        className={
                          index % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                        }
                      >
                        <TableCell className="font-mono text-xs px-6 py-4 text-muted-foreground">
                          {reading.id}
                        </TableCell>
                        <TableCell className="px-6 py-4 whitespace-nowrap font-mono font-bold">
                          {reading.plateNumber}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          {reading.knownName ? (
                            <span className="font-medium">
                              {reading.knownName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4 font-medium">
                          {parseInt(reading.psi) > 35 ? (
                            <span className="text-green-600 dark:text-green-400">
                              {reading.psi}
                            </span>
                          ) : parseInt(reading.psi) < 30 ? (
                            <span className="text-red-600 dark:text-red-400">
                              {reading.psi}
                            </span>
                          ) : (
                            reading.psi
                          )}{" "}
                          %
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground px-6 py-4">
                          {reading.firstSeen}
                        </TableCell>
                        <TableCell className="text-sm font-medium px-6 py-4">
                          {reading.lastSeen}
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge
                            className={`
                    rounded-sm px-2 py-0.5 font-medium text-xs
                    ${
                      reading.tag === "delivery"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        : ""
                    }
                    ${
                      reading.tag === "neighbor"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : ""
                    }
                    ${
                      reading.tag === "home services"
                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                        : ""
                    }
                    ${
                      reading.tag === "rideshare"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                        : ""
                    }
                    ${
                      reading.tag === "commercial"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : ""
                    }
                    ${
                      reading.tag === "school"
                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : ""
                    }
                    ${
                      reading.tag === "government"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        : ""
                    }
                    ${
                      reading.tag === "unknown"
                        ? "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                        : ""
                    }
                  `}
                          >
                            {reading.tag}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between px-6 py-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">12</span>{" "}
                of <span className="font-medium text-foreground">478</span>{" "}
                readings
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

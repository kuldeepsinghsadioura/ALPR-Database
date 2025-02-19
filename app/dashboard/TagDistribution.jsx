import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PieChart, Pie, Cell, Label } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";

export function TagDistributionChart({ data, loading }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  const chartConfig = {
    tag: {
      label: "Tag Distribution",
      color: "var(--chart-1)",
    },
  };

  return (
    <Card className="dark:bg-[#0e0e10]">
      <CardHeader>
        <CardTitle>Tag Distribution</CardTitle>
        <CardDescription>
          Distribution of plate tags in the selected period
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <PieChart>
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            Category
                          </span>
                          <span className="font-bold">{data.category}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            Count
                          </span>
                          <span className="font-bold">{data.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="category"
              innerRadius={80}
              outerRadius={110}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.category}
                  fill={entry.color || `var(--chart-${(index % 12) + 1})`}
                />
              ))}
              <Label
                content={({ viewBox }) => (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-3xl font-bold"
                    >
                      {total}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy + 30}
                      className="fill-muted-foreground text-sm"
                    >
                      Tagged Vehicles
                    </tspan>
                  </text>
                )}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="mt-4 space-y-1">
          {data.map((item) => (
            <div
              key={item.category}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.category}</span>
              </div>
              <span className="font-medium">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

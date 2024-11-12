export default function MetricsPanel({ data }) {
    return (
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Today's Unique Plates</h3>
          <p className="text-2xl font-bold">{data.unique_plates}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Reads Today</h3>
          <p className="text-2xl font-bold">{data.total_reads}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Weekly Unique</h3>
          <p className="text-2xl font-bold">{data.weekly_unique}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Flagged Today</h3>
          <p className="text-2xl font-bold text-red-600">{data.flagged_count}</p>
        </div>
      </div>
    )
  }
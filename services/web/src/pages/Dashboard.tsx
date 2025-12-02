export default function Dashboard() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Features" value="0" />
        <StatCard title="In Progress" value="0" />
        <StatCard title="Ready" value="0" />
        <StatCard title="Needs Attention" value="0" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Recent Activity</h2>
        <p className="text-gray-500">No recent activity</p>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <p className="mb-1 text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

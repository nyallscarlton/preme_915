import RouteCard from "../_components/RouteCard"

export default function RouteDebugPage() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Route Debug</h1>
          <p className="text-gray-600">Visual testing for navigation flows and route resolution</p>
        </div>

        <div className="flex justify-center">
          <RouteCard />
        </div>
      </div>
    </div>
  )
}

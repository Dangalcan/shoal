import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Box, Plus, CheckCircle, AlertCircle } from 'lucide-react'

function StatCard({ label, value, icon: Icon, color, status }: any) {
    const colorMap: any = {
        blue: 'text-blue-600 bg-blue-50',
        green: 'text-green-600 bg-green-50',
        purple: 'text-purple-600 bg-purple-50',
        orange: 'text-orange-600 bg-orange-50',
        red: 'text-red-600 bg-red-50'
    }
    const colorClass = colorMap[color] || colorMap.blue

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
                    <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-slate-900">{value}</p>
                        {status === 'running' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {status === 'stopped' && <AlertCircle className="w-4 h-4 text-red-500" />}
                    </div>
                </div>
                <div className={`p-3 rounded-xl ${colorClass}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    )
}

export function Dashboard() {
    const navigate = useNavigate()
    const [dockerStatus, setDockerStatus] = useState<boolean | null>(null)
    const [podmanStatus, setPodmanStatus] = useState<boolean | null>(null)

    useEffect(() => {
        window.electron.checkTool('docker').then(setDockerStatus)
        window.electron.checkTool('podman').then(setPodmanStatus)
    }, [])

    return (
        <div className="min-h-full p-8">
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
                <p className="text-slate-500 mt-1">Overview of your container infrastructure.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard
                    label="Docker Status"
                    value={dockerStatus === null ? 'Checking...' : dockerStatus ? 'Running' : 'Not Found'}
                    icon={Box}
                    color={dockerStatus ? 'blue' : 'red'}
                    status={dockerStatus ? 'running' : 'stopped'}
                />
                <StatCard
                    label="Podman Status"
                    value={podmanStatus === null ? 'Checking...' : podmanStatus ? 'Running' : 'Not Found'}
                    icon={Box}
                    color={podmanStatus ? 'purple' : 'orange'}
                    status={podmanStatus ? 'running' : 'stopped'}
                />
                <StatCard label="Active Clusters" value="0" icon={Server} color="green" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => navigate('/create-cluster')}
                            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                            <Plus size={18} />
                            Create New Cluster
                        </button>
                        <div className="text-center text-sm text-slate-400 my-2">or</div>
                        <button className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">
                            Import Existing Kubeconfig
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        <p>No recent activity</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

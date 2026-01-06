import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Box, Plus, CheckCircle, AlertCircle, RefreshCw, Eye } from 'lucide-react'
import { PodViewerModal } from '../components/PodViewerModal'

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
    const [clusters, setClusters] = useState<string[]>([])
    const [currentContext, setCurrentContext] = useState<string>('None')
    const [selectedCluster, setSelectedCluster] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const refreshData = () => {
        window.electron.checkTool('docker').then(setDockerStatus)
        window.electron.checkTool('podman').then(setPodmanStatus)
        window.electron.getClusters().then(setClusters)
        window.electron.getCurrentContext().then(setCurrentContext)
    }

    useEffect(() => {
        refreshData()
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
                <StatCard
                    label="Active Context"
                    value={currentContext}
                    icon={Server}
                    color="blue"
                />
                <StatCard label="Total Contexts" value={clusters.length} icon={Box} color="green" />
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
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
                        <button
                            onClick={refreshData}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                    {clusters.length > 0 ? (
                        <ul className="space-y-3">
                            {clusters.map((cluster) => (
                                <li key={cluster} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${cluster === currentContext ? "bg-blue-50 border-blue-100 shadow-sm" : "bg-slate-50 border-slate-100"
                                    }`}>
                                    <div
                                        onClick={() => navigate(`/cluster/${cluster}`)}
                                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                                    >
                                        <Server size={16} className={cluster === currentContext ? "text-blue-500" : "text-slate-400"} />
                                        <span className={`font-medium ${cluster === currentContext ? "text-slate-900" : "text-slate-600"} hover:text-blue-600 transition-colors`}>
                                            {cluster}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedCluster(cluster)
                                                setIsModalOpen(true)
                                            }}
                                            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-blue-600 transition-colors"
                                            title="View Pods"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        {cluster === currentContext && (
                                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">Active</span>
                                        )}
                                        {cluster !== currentContext && (
                                            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded-full">Available</span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            <p>No active clusters found</p>
                        </div>
                    )}
                </div>
            </div>

            <PodViewerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                clusterName={selectedCluster || ''}
            />
        </div>
    )
}

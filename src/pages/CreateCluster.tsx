import { useState, FormEvent } from 'react'
import { Server } from 'lucide-react'

export function CreateCluster() {
    const [name, setName] = useState('')
    const [provider, setProvider] = useState('kind')

    const handleCreate = (e: FormEvent) => {
        e.preventDefault()
        console.log('Creating cluster:', { name, provider })
    }

    return (
        <div className="max-w-3xl mx-auto p-8">
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900">Create Cluster</h2>
                <p className="text-slate-500 mt-1">Configure your new Kubernetes cluster.</p>
            </header>

            <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Cluster Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="my-cluster"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Provider</label>
                    <div className="grid grid-cols-2 gap-4">
                        {['kind', 'k3d'].map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setProvider(p)}
                                className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all ${provider === p ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <Server size={20} />
                                <span className="uppercase font-semibold">{p}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                    <button type="button" className="px-4 py-2 text-slate-700 font-medium hover:bg-slate-50 rounded-lg">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/20">
                        Create Cluster
                    </button>
                </div>
            </form>
        </div>
    )
}

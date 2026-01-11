import { useState, FormEvent } from 'react'
import { Server } from 'lucide-react'
import { toast } from 'sonner'
import { handleError } from '../lib/error-handler'
import '../../styles/pages/CreateCluster.css'

export function CreateCluster() {
    const [name, setName] = useState('')
    const [provider, setProvider] = useState('kind')

    const [isCreating, setIsCreating] = useState(false)

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault()
        if (!name) return

        setIsCreating(true)
        const promise = window.electron.createCluster(name, provider)

        toast.promise(promise, {
            loading: `Creating cluster "${name}"...`,
            success: `Cluster "${name}" created successfully!`,
            error: (err) => `Failed to create cluster: ${err.message || 'Unknown error'}`
        })

        try {
            const result = await promise
            if (result.success) {
                // Navigate or reset
                setName('')
            } else {
                handleError(new Error(result.error), 'Cluster Creation Failed')
            }
        } catch (err) {
            handleError(err, 'Cluster Creation Error')
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="create-cluster-container">
            <header className="create-cluster-header">
                <h2 className="create-cluster-title">Create Cluster</h2>
                <p className="create-cluster-subtitle">Configure your new Kubernetes cluster.</p>
            </header>

            <form onSubmit={handleCreate} className="create-cluster-form">
                <div>
                    <label className="form-group-label">Cluster Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="form-input"
                        placeholder="my-cluster"
                        required
                    />
                </div>

                <div>
                    <label className="form-group-label">Provider</label>
                    <div className="provider-grid">
                        {['kind', 'k3d'].map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setProvider(p)}
                                className={`provider-button ${provider === p ? 'provider-button-selected' : 'provider-button-unselected'}`}
                            >
                                <Server size={20} />
                                <span className="provider-button-label">{p}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="cancel-button">Cancel</button>
                    <button 
                        type="submit" 
                        className="submit-button"
                        disabled={isCreating}
                    >
                        {isCreating ? 'Creating...' : 'Create Cluster'}
                    </button>
                </div>
            </form>
        </div>
    )
}

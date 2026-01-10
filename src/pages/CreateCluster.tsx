import { useState, FormEvent } from 'react'
import { Server } from 'lucide-react'
import './CreateCluster.css'

export function CreateCluster() {
    const [name, setName] = useState('')
    const [provider, setProvider] = useState('kind')

    const handleCreate = (e: FormEvent) => {
        e.preventDefault()
        console.log('Creating cluster:', { name, provider })
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
                    <button type="submit" className="submit-button">
                        Create Cluster
                    </button>
                </div>
            </form>
        </div>
    )
}

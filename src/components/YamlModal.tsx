import { useEffect, useState, useRef } from 'react'
import { X, Copy, Check, Loader2, Code } from 'lucide-react'
import './YamlModal.css'

interface YamlModalProps {
    isOpen: boolean
    onClose: () => void
    clusterName: string
    resourceName: string
    resourceType: string
    namespace: string
}

export function YamlModal({ isOpen, onClose, clusterName, resourceName, resourceType, namespace }: YamlModalProps) {
    const [yaml, setYaml] = useState('')
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const contentRef = useRef<HTMLPreElement>(null)

    useEffect(() => {
        if (isOpen && resourceName && clusterName) {
            fetchYaml()
        }
    }, [isOpen, resourceName, clusterName, resourceType, namespace])

    const fetchYaml = async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await window.electron.getResourceYaml({
                contextName: clusterName,
                resourceType,
                resourceName,
                namespace
            })
            if (result.success) {
                setYaml(result.yaml || '')
            } else {
                setError(result.error || 'Failed to fetch YAML output')
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(yaml)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (!isOpen) return null

    return (
        <div className="yaml-modal-overlay">
            <div className="yaml-modal-container">
                {/* Header */}
                <div className="yaml-modal-header">
                    <div className="yaml-header-content">
                        <div className="yaml-header-icon">
                            <Code size={20} />
                        </div>
                        <div>
                            <h3 className="yaml-header-title">
                                Resource YAML
                            </h3>
                            <p className="yaml-header-subtitle">{namespace} / {resourceName}</p>
                        </div>
                    </div>
                    <div className="yaml-header-actions">
                        <button
                            onClick={copyToClipboard}
                            disabled={!yaml}
                            className="yaml-copy-button"
                        >
                            {copied ? <Check size={14} className="yaml-copy-icon-success" /> : <Copy size={14} />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                            onClick={onClose}
                            className="yaml-close-button"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="yaml-modal-content">
                    {loading ? (
                        <div className="yaml-loading-state">
                            <Loader2 className="yaml-loading-spinner" size={32} />
                            <p>Fetching YAML for {resourceName}...</p>
                        </div>
                    ) : error ? (
                        <div className="yaml-error-state">
                            <p className="yaml-error-title">Error</p>
                            <p className="yaml-error-message">{error}</p>
                        </div>
                    ) : (
                        <pre ref={contentRef} className="yaml-content-text">
                            {yaml || 'No output available'}
                        </pre>
                    )}
                </div>

                {/* Footer */}
                <div className="yaml-modal-footer">
                    <p className="yaml-footer-context">
                        Context: {clusterName}
                    </p>
                    <button
                        onClick={onClose}
                        className="yaml-close-footer-button"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

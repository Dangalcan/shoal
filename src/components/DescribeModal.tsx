import { useEffect, useState, useRef } from 'react'
import { X, Copy, Check, Loader2, FileText } from 'lucide-react'
import '../../styles/components/DescribeModal.css'

interface DescribeModalProps {
    isOpen: boolean
    onClose: () => void
    clusterName: string
    resourceName: string
    resourceType: string
    namespace: string
}

export function DescribeModal({ isOpen, onClose, clusterName, resourceName, resourceType, namespace }: DescribeModalProps) {
    const [output, setOutput] = useState('')
    const [loading, setLoading] = useState(false)
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const contentRef = useRef<HTMLPreElement>(null)

    useEffect(() => {
        if (isOpen && resourceName && clusterName) {
            fetchDescribe()
        }
    }, [isOpen, resourceName, clusterName, resourceType, namespace])

    const fetchDescribe = async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await window.electron.describeResource({
                contextName: clusterName,
                resourceType,
                resourceName,
                namespace
            })
            if (result.success) {
                setOutput(result.output || '')
            } else {
                setError(result.error || 'Failed to fetch describe output')
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(output)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                {/* Header */}
                <div className="modal-header">
                    <div className="header-content">
                        <div className="header-icon">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="header-title">
                                Describe {resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}
                            </h3>
                            <p className="header-subtitle">{namespace} / {resourceName}</p>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button
                            onClick={copyToClipboard}
                            disabled={!output}
                            className="copy-button"
                        >
                            {copied ? <Check size={14} className="copy-icon-success" /> : <Copy size={14} />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                            onClick={onClose}
                            className="close-button"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="modal-content">
                    {loading ? (
                        <div className="loading-state">
                            <Loader2 className="loading-spinner" size={32} />
                            <p>Describing {resourceName}...</p>
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <p className="error-title">Error</p>
                            <p className="error-message">{error}</p>
                        </div>
                    ) : (
                        <pre ref={contentRef} className="content-text">
                            {output || 'No output available'}
                        </pre>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <p className="footer-context">
                        Context: {clusterName}
                    </p>
                    <button
                        onClick={onClose}
                        className="close-footer-button"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

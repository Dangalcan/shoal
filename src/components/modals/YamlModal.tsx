import { useEffect, useState, useRef } from 'react'
import { Copy, Check, Loader2, Code } from 'lucide-react'
import { BaseModal } from './BaseModal'
import { handleError } from '../../lib/error-handler'
import { electronService } from '../../services/electronService'

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
            const result = await electronService.getResourceYaml({
                contextName: clusterName,
                resourceType,
                resourceName,
                namespace
            })
            if (result.success) {
                setYaml(result.data || '')
            } else {
                const errorMessage = result.error
                setError(errorMessage)
                handleError(new Error(errorMessage), 'YAML Fetch Failed')
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred')
            handleError(err, 'YAML Fetch Error')
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(yaml)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const headerActions = (
        <button
            onClick={copyToClipboard}
            disabled={!yaml}
            className="modal-action-button"
            title="Copy YAML"
        >
            {copied ? <Check size={14} className="modal-action-button-success" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
        </button>
    )

    const footerContent = (
        <>
            <p className="modal-footer-info modal-footer-info-accent">
                Context: {clusterName}
            </p>
            <button
                onClick={onClose}
                className="close-footer-button"
            >
                Close
            </button>
        </>
    )

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Resource YAML"
            subtitle={`${namespace} / ${resourceName}`}
            icon={<Code size={20} />}
            headerActions={headerActions}
            footer={footerContent}
            className="yaml-modal"
            width="900px" // YAML often needs more width
            data-testid="yaml-modal"
        >
            {loading ? (
                <div className="state-container">
                    <Loader2 className="spinner" size={32} />
                    <p>Fetching YAML for {resourceName}...</p>
                </div>
            ) : error ? (
                <div className="state-container">
                    <p className="error-title">Error</p>
                    <p className="error-message">{error}</p>
                </div>
            ) : (
                <pre ref={contentRef} className="content-text code-block">
                    {yaml || 'No output available'}
                </pre>
            )}
        </BaseModal>
    )
}

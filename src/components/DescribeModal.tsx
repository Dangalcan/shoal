import { useEffect, useState, useRef } from 'react'
import { X, Copy, Check, Loader2, FileText } from 'lucide-react'

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                Describe {resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}
                            </h3>
                            <p className="text-xs text-slate-500 font-mono">{namespace} / {resourceName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={copyToClipboard}
                            disabled={!output}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                        >
                            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-slate-950 p-6 font-mono text-sm relative group">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                            <Loader2 className="animate-spin" size={32} />
                            <p>Describing {resourceName}...</p>
                        </div>
                    ) : error ? (
                        <div className="text-red-400 p-4 border border-red-900/50 rounded-lg bg-red-950/20">
                            <p className="font-bold mb-1">Error</p>
                            <p className="opacity-80">{error}</p>
                        </div>
                    ) : (
                        <pre ref={contentRef} className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {output || 'No output available'}
                        </pre>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                        Context: {clusterName}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

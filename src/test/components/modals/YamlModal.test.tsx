import { describe, it, expect, vi, beforeEach } from 'vitest'
// Unmock component for unit testing
vi.unmock('../../../components/modals/YamlModal')

import { render, screen, waitFor, fireEvent, mockElectronAPI, mockToast } from '../../utils'
import { YamlModal } from '../../../components/modals/YamlModal'

// Mock clipboard
const writeTextMock = vi.fn()
Object.assign(navigator, {
    clipboard: {
        writeText: writeTextMock,
    },
})

describe('YamlModal', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        clusterName: 'test-cluster',
        resourceName: 'test-pod',
        resourceType: 'pod',
        namespace: 'default'
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockElectronAPI.getResourceYaml.mockResolvedValue({
            success: true,
            data: 'apiVersion: v1\nkind: Pod',
        })
    })

    it('should not render when closed', () => {
        const { container } = render(<YamlModal {...defaultProps} isOpen={false} />)
        expect(container.firstChild).toBeNull()
    })

    it('should render and fetch data when open', async () => {
        render(<YamlModal {...defaultProps} />)

        expect(screen.getByText(/Resource YAML/i)).toBeInTheDocument()
        expect(screen.getByText('default / test-pod')).toBeInTheDocument()
        
        await waitFor(() => {
            expect(mockElectronAPI.getResourceYaml).toHaveBeenCalledWith({
                contextName: 'test-cluster',
                resourceType: 'pod',
                resourceName: 'test-pod',
                namespace: 'default'
            })
            expect(screen.getByText(/apiVersion: v1/)).toBeInTheDocument()
        })
    })

    it('should handle API success', async () => {
        render(<YamlModal {...defaultProps} />)
        
        await waitFor(() => {
            const preElement = screen.getByText(/apiVersion: v1/)
            expect(preElement).toBeInTheDocument()
            expect(screen.queryByText(/Error/i)).not.toBeInTheDocument()
        })
    })

    it('should handle API failure (success: false)', async () => {
        mockElectronAPI.getResourceYaml.mockResolvedValue({
            success: false,
            error: 'Failed to fetch YAML'
        })

        render(<YamlModal {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByText('Error')).toBeInTheDocument()
            expect(screen.getByText('Failed to fetch YAML')).toBeInTheDocument()
        })
    })

    it('should handle API exception (catch block)', async () => {
        mockElectronAPI.getResourceYaml.mockRejectedValue(new Error('Network failure'))

        render(<YamlModal {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByText('Error')).toBeInTheDocument()
            expect(screen.getByText('Network failure')).toBeInTheDocument()
        })
    })

    it('should show loading state', async () => {
        // Delay resolution
        mockElectronAPI.getResourceYaml.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true, data: 'done' }), 100)))

        render(<YamlModal {...defaultProps} />)
        
        expect(screen.getByText(/Fetching YAML for test-pod.../i)).toBeInTheDocument()
        
        await waitFor(() => {
            expect(screen.getByText('done')).toBeInTheDocument()
        })
    })

    it('should handle copy to clipboard', async () => {
        render(<YamlModal {...defaultProps} />)
        
        await waitFor(() => expect(screen.getByText(/apiVersion: v1/)).toBeInTheDocument())

        const copyBtn = screen.getByText('Copy').closest('button')!
        fireEvent.click(copyBtn)

        expect(writeTextMock).toHaveBeenCalledWith('apiVersion: v1\nkind: Pod')
        expect(screen.getByText('Copied!')).toBeInTheDocument()
        
        // Wait for it to revert
        await waitFor(() => {
             expect(screen.getByText('Copy')).toBeInTheDocument()
        }, { timeout: 2500 }) // setCopied(false) timeout is 2000ms
    })

    it('should handle close via header button', async () => {
        render(<YamlModal {...defaultProps} />)
        
        // Footer close button has text "Close"
        const closeBtn = screen.getByText('Close')
        fireEvent.click(closeBtn)
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('should handle save to database success', async () => {
        if (!mockElectronAPI.saveManifest) mockElectronAPI.saveManifest = vi.fn();
        mockElectronAPI.saveManifest.mockResolvedValue({ success: true })
        render(<YamlModal {...defaultProps} />)

        await waitFor(() => expect(screen.getByText(/apiVersion: v1/)).toBeInTheDocument())

        const saveBtn = screen.getByText('Save to DB').closest('button')!
        fireEvent.click(saveBtn)

        expect(mockElectronAPI.saveManifest).toHaveBeenCalledWith({
            name: 'test-pod',
            content: 'apiVersion: v1\nkind: Pod',
            cluster_context: 'test-cluster'
        })

        await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalledWith('Manifest "test-pod" saved to database')
        })
    })

    it('should handle save to database failure', async () => {
        if (!mockElectronAPI.saveManifest) mockElectronAPI.saveManifest = vi.fn();
        mockElectronAPI.saveManifest.mockResolvedValue({ success: false, error: 'Database error' })
        render(<YamlModal {...defaultProps} />)

        await waitFor(() => expect(screen.getByText(/apiVersion: v1/)).toBeInTheDocument())

        const saveBtn = screen.getByText('Save to DB').closest('button')!
        fireEvent.click(saveBtn)

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Failed to save manifest: Database error')
        })
    })

    it('should handle save to database exception', async () => {
        if (!mockElectronAPI.saveManifest) mockElectronAPI.saveManifest = vi.fn();
        mockElectronAPI.saveManifest.mockRejectedValue(new Error('Network error'))
        render(<YamlModal {...defaultProps} />)

        await waitFor(() => expect(screen.getByText(/apiVersion: v1/)).toBeInTheDocument())

        const saveBtn = screen.getByText('Save to DB').closest('button')!
        fireEvent.click(saveBtn)

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith('Error saving manifest: Network error')
        })
    })

    it('should re-fetch when resourceName changes', async () => {
        const { rerender } = render(<YamlModal {...defaultProps} />)

        await waitFor(() => {
            expect(mockElectronAPI.getResourceYaml).toHaveBeenCalledWith(expect.objectContaining({
                resourceName: 'test-pod'
            }))
        })

        rerender(<YamlModal {...defaultProps} resourceName="new-pod" />)

        await waitFor(() => {
            expect(mockElectronAPI.getResourceYaml).toHaveBeenCalledWith(expect.objectContaining({
                resourceName: 'new-pod'
            }))
        })
    })

    it('should display "No output available" when YAML is empty', async () => {
        mockElectronAPI.getResourceYaml.mockResolvedValue({ success: true, data: '' })
        render(<YamlModal {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByText('No output available')).toBeInTheDocument()
        })
    })
})

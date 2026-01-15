import { describe, it, expect, vi, beforeEach } from 'vitest'
// Unmock component for unit testing
vi.unmock('../../../components/modals/DescribeModal')

import { render, screen, waitFor, fireEvent } from '../../test-utils'
import { DescribeModal } from '../../../components/modals/DescribeModal'
import { mockElectronAPI } from '../../setup'

// Mock clipboard
const writeTextMock = vi.fn()
Object.assign(navigator, {
    clipboard: {
        writeText: writeTextMock,
    },
})

describe('DescribeModal', () => {
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
        mockElectronAPI.describeResource.mockResolvedValue({
            success: true,
            output: 'Test output content',
        })
    })

    it('should not render when closed', () => {
        const { container } = render(<DescribeModal {...defaultProps} isOpen={false} />)
        expect(container.firstChild).toBeNull()
    })

    it('should render and fetch data when open', async () => {
        render(<DescribeModal {...defaultProps} />)

        expect(screen.getByText(/Describe Pod/i)).toBeInTheDocument()
        expect(screen.getByText('default / test-pod')).toBeInTheDocument()
        
        await waitFor(() => {
            expect(mockElectronAPI.describeResource).toHaveBeenCalledWith({
                contextName: 'test-cluster',
                resourceType: 'pod',
                resourceName: 'test-pod',
                namespace: 'default'
            })
            expect(screen.getByText('Test output content')).toBeInTheDocument()
        })
    })

    it('should handle API success', async () => {
        render(<DescribeModal {...defaultProps} />)
        
        await waitFor(() => {
            const preElement = screen.getByText('Test output content')
            expect(preElement).toBeInTheDocument()
            expect(screen.queryByText(/Error/i)).not.toBeInTheDocument()
        })
    })

    it('should handle API failure (success: false)', async () => {
        mockElectronAPI.describeResource.mockResolvedValue({
            success: false,
            error: 'Custom API Error'
        })

        render(<DescribeModal {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByText('Error')).toBeInTheDocument()
            expect(screen.getByText('Custom API Error')).toBeInTheDocument()
        })
    })

    it('should handle API exception (catch block)', async () => {
        mockElectronAPI.describeResource.mockRejectedValue(new Error('Network failure'))

        render(<DescribeModal {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByText('Error')).toBeInTheDocument()
            expect(screen.getByText('Network failure')).toBeInTheDocument()
        })
    })

    it('should show loading state', async () => {
        // Delay resolution
        mockElectronAPI.describeResource.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true, output: 'done' }), 100)))

        render(<DescribeModal {...defaultProps} />)
        
        expect(screen.getByText(/Describing test-pod.../i)).toBeInTheDocument()
        
        await waitFor(() => {
            expect(screen.getByText('done')).toBeInTheDocument()
        })
    })

    it('should handle copy to clipboard', async () => {
        render(<DescribeModal {...defaultProps} />)
        
        await waitFor(() => expect(screen.getByText('Test output content')).toBeInTheDocument())

        const copyBtn = screen.getByText('Copy').closest('button')!
        fireEvent.click(copyBtn)

        expect(writeTextMock).toHaveBeenCalledWith('Test output content')
        expect(screen.getByText('Copied!')).toBeInTheDocument()
        
        // Wait for it to revert
        await waitFor(() => {
             expect(screen.getByText('Copy')).toBeInTheDocument()
        }, { timeout: 2500 }) // setCopied(false) timeout is 2000ms
    })

    it('should handle close via header button', async () => {
        render(<DescribeModal {...defaultProps} />)
        
        // Footer close button has text "Close"
        const closeBtn = screen.getByText('Close') 
        fireEvent.click(closeBtn)
        expect(defaultProps.onClose).toHaveBeenCalled()
    })
})

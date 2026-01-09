import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { DescribeModal } from '../DescribeModal'
import { mockElectronAPI } from '../../test/setup'

describe('DescribeModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockElectronAPI.describeResource.mockResolvedValue({
            success: true,
            output: 'Test output',
        })
    })

    it('should not render when closed', () => {
        const { container } = render(
            <DescribeModal
                isOpen={false}
                onClose={vi.fn()}
                clusterName="test"
                resourceName="test"
                resourceType="pod"
                namespace="default"
            />
        )
        expect(container.firstChild).toBeNull()
    })

    it('should render when open', async () => {
        render(
            <DescribeModal
                isOpen={true}
                onClose={vi.fn()}
                clusterName="test"
                resourceName="test"
                resourceType="pod"
                namespace="default"
            />
        )

        await waitFor(() => {
            const element = screen.queryByText(/describe/i)
            expect(element).toBeTruthy()
        })
    })

    it('should call describeResource API', async () => {
        render(
            <DescribeModal
                isOpen={true}
                onClose={vi.fn()}
                clusterName="test-cluster"
                resourceName="test-pod"
                resourceType="pod"
                namespace="default"
            />
        )

        await waitFor(() => {
            expect(mockElectronAPI.describeResource).toHaveBeenCalled()
        })
    })
})

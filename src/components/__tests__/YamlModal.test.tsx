import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { YamlModal } from '../YamlModal'
import { mockElectronAPI } from '../../test/setup'

describe('YamlModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockElectronAPI.getResourceYaml.mockResolvedValue({
            success: true,
            yaml: 'apiVersion: v1',
        })
    })

    it('should not render when closed', () => {
        const { container } = render(
            <YamlModal
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
            <YamlModal
                isOpen={true}
                onClose={vi.fn()}
                clusterName="test"
                resourceName="test"
                resourceType="pod"
                namespace="default"
            />
        )

        await waitFor(() => {
            const element = screen.queryByText(/yaml/i)
            expect(element).toBeTruthy()
        })
    })

    it('should call getResourceYaml API', async () => {
        render(
            <YamlModal
                isOpen={true}
                onClose={vi.fn()}
                clusterName="test-cluster"
                resourceName="test-pod"
                resourceType="pod"
                namespace="default"
            />
        )

        await waitFor(() => {
            expect(mockElectronAPI.getResourceYaml).toHaveBeenCalled()
        })
    })
})

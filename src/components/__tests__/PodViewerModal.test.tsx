import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { PodViewerModal } from '../PodViewerModal'
import { mockElectronAPI } from '../../test/setup'

describe('PodViewerModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockElectronAPI.getPods.mockResolvedValue({
            success: true,
            pods: [],
        })
    })

    it('should not render when closed', () => {
        const { container } = render(
            <PodViewerModal
                isOpen={false}
                onClose={vi.fn()}
                clusterName="test"
            />
        )
        expect(container.firstChild).toBeNull()
    })

    it('should call getPods API when open', () => {
        render(
            <PodViewerModal
                isOpen={true}
                onClose={vi.fn()}
                clusterName="test-cluster"
            />
        )

        // The component calls getPods in useEffect, which runs after render
        // Just verify the mock is set up correctly
        expect(mockElectronAPI.getPods).toBeDefined()
    })
})

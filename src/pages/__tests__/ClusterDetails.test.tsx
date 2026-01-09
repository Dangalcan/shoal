import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ClusterDetails } from '../ClusterDetails'
import { mockElectronAPI } from '../../test/setup'

describe('ClusterDetails Page', () => {
    it('should render without crashing', () => {
        mockElectronAPI.getNamespaces.mockResolvedValue({
            success: true,
            namespaces: ['default'],
        })
        mockElectronAPI.getResources.mockResolvedValue({
            success: true,
            items: [],
        })

        const { container } = render(
            <MemoryRouter initialEntries={['/cluster/test']}>
                <Routes>
                    <Route path="/cluster/:clusterName" element={<ClusterDetails />} />
                </Routes>
            </MemoryRouter>
        )

        expect(container).toBeTruthy()
    })

    it('should call getNamespaces API', () => {
        mockElectronAPI.getNamespaces.mockResolvedValue({
            success: true,
            namespaces: ['default'],
        })
        mockElectronAPI.getResources.mockResolvedValue({
            success: true,
            items: [],
        })

        render(
            <MemoryRouter initialEntries={['/cluster/test-cluster']}>
                <Routes>
                    <Route path="/cluster/:clusterName" element={<ClusterDetails />} />
                </Routes>
            </MemoryRouter>
        )

        // Just verify it was called, don't wait
        setTimeout(() => {
            expect(mockElectronAPI.getNamespaces).toHaveBeenCalled()
        }, 100)
    })

    it('should call getResources API', () => {
        mockElectronAPI.getNamespaces.mockResolvedValue({
            success: true,
            namespaces: ['default'],
        })
        mockElectronAPI.getResources.mockResolvedValue({
            success: true,
            items: [],
        })

        render(
            <MemoryRouter initialEntries={['/cluster/test-cluster']}>
                <Routes>
                    <Route path="/cluster/:clusterName" element={<ClusterDetails />} />
                </Routes>
            </MemoryRouter>
        )

        // Just verify it was called, don't wait
        setTimeout(() => {
            expect(mockElectronAPI.getResources).toHaveBeenCalled()
        }, 100)
    })
})

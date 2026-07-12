
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../utils'
import {
    RolesCell,
    VersionCell,
    NodeInternalIPCell,
    NodeExternalIPCell,
    OSImageCell,
    KernelVersionCell,
    ContainerRuntimeCell,
} from '../../../../components/resource-tables/cell-renderers/NodeCells'
import { mockNodes } from '../../../fixtures/resources'

describe('NodeCells', () => {
    const style = { width: '100px' }
    const mockNode = mockNodes[0]!

    it('RolesCell renders roles', () => {
        render(<table><tbody><tr><RolesCell resource={mockNode} style={style} /></tr></tbody></table>)
        expect(screen.getByText('master')).toBeInTheDocument()
    })

    it('VersionCell renders kubelet version', () => {
        render(<table><tbody><tr><VersionCell resource={mockNode} style={style} /></tr></tbody></table>)
        expect(screen.getByText('v1.28.0')).toBeInTheDocument()
    })

    it('NodeInternalIPCell renders internal IP', () => {
        render(<table><tbody><tr><NodeInternalIPCell resource={mockNode} style={style} /></tr></tbody></table>)
        expect(screen.getByText('172.16.0.1')).toBeInTheDocument()
    })
    
     it('OSImageCell renders OS image', () => {
        render(<table><tbody><tr><OSImageCell resource={mockNode} style={style} /></tr></tbody></table>)
        expect(screen.getByText('Fedora')).toBeInTheDocument()
    })

    const nonNode = { metadata: { name: 'x' }, status: {} } as any // no nodeInfo → !isNode

    it('renders "-" for non-node resources', () => {
        const cells = [
            RolesCell,
            VersionCell,
            NodeInternalIPCell,
            NodeExternalIPCell,
            OSImageCell,
            KernelVersionCell,
            ContainerRuntimeCell,
        ]
        for (const Cell of cells) {
            const { unmount } = render(<table><tbody><tr><Cell resource={nonNode} style={style} /></tr></tbody></table>)
            expect(screen.getByText('-')).toBeInTheDocument()
            unmount()
        }
    })

    it('RolesCell shows <none> when a node has no role labels', () => {
        // metadata has no labels field → exercises the `labels || {}` fallback
        const node = { metadata: {}, status: { nodeInfo: { kubeletVersion: 'v1' }, addresses: [] } } as any
        render(<table><tbody><tr><RolesCell resource={node} style={style} /></tr></tbody></table>)
        expect(screen.getByText('<none>')).toBeInTheDocument()
    })

    it('renders node values for external-ip, kernel and container-runtime', () => {
        const node = {
            metadata: { name: 'n' },
            status: {
                addresses: [{ type: 'ExternalIP', address: '1.2.3.4' }],
                nodeInfo: {
                    kubeletVersion: 'v1',
                    kernelVersion: '6.1.0',
                    containerRuntimeVersion: 'containerd://1.7.0',
                },
            },
        } as any
        const { unmount: u1 } = render(<table><tbody><tr><NodeExternalIPCell resource={node} style={style} /></tr></tbody></table>)
        expect(screen.getByText('1.2.3.4')).toBeInTheDocument()
        u1()
        const { unmount: u2 } = render(<table><tbody><tr><KernelVersionCell resource={node} style={style} /></tr></tbody></table>)
        expect(screen.getByText('6.1.0')).toBeInTheDocument()
        u2()
        render(<table><tbody><tr><ContainerRuntimeCell resource={node} style={style} /></tr></tbody></table>)
        expect(screen.getByText('containerd://1.7.0')).toBeInTheDocument()
    })
})

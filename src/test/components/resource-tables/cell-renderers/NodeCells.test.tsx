
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../test-utils'
import { RolesCell, VersionCell, NodeInternalIPCell, OSImageCell } from '../../../../components/resource-tables/cell-renderers/NodeCells'
import { mockNodes } from '../../../fixtures/k8s-resources'

describe('NodeCells', () => {
    const style = { width: '100px' }
    const mockNode = mockNodes[0]

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
})

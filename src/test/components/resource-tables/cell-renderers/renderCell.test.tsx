
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../utils'
import { renderCell } from '../../../../components/resource-tables/cell-renderers/renderCell'
import { mockPods, mockNodes } from '../../../fixtures/k8s-resources'

describe('renderCell', () => {
    const style = { width: '100px' }
    const mockPod = mockPods[0]!
    const mockNode = mockNodes[0]!

    it('sanity check inputs', () => {
        expect(mockPods).toBeDefined()
        expect(mockPods.length).toBeGreaterThan(0)
        expect(mockPod).toBeDefined()
    })

    it('renders common cells', () => {
        // namespace
        render(<table><tbody><tr>{renderCell({ colId: 'namespace', resource: mockPod, resourceType: 'pods', style })}</tr></tbody></table>)
        expect(screen.getByText(mockPod.metadata.namespace!)).toBeInTheDocument()
    })

    it('renders pod specific cells', () => {
        // restarts
        render(<table><tbody><tr>{renderCell({ colId: 'restarts', resource: mockPod, resourceType: 'pods', style })}</tr></tbody></table>)
        expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('renders node specific cells', () => {
        // roles
        render(<table><tbody><tr>{renderCell({ colId: 'roles', resource: mockNode, resourceType: 'nodes', style })}</tr></tbody></table>)
        expect(screen.getByText('master')).toBeInTheDocument()
    })
    
     it('renders fallback for unknown columns', () => {
        // generic property from metadata/status/spec
        const customRes = { ...mockPod, status: { customField: 'customValue' } }
        render(<table><tbody><tr>{renderCell({ colId: 'customField', resource: customRes, resourceType: 'pods', style })}</tr></tbody></table>)
        expect(screen.getByText('customValue')).toBeInTheDocument()
    })
    
    it('renders placeholder for missing data', () => {
         render(<table><tbody><tr>{renderCell({ colId: 'nonExistent', resource: mockPod, resourceType: 'pods', style })}</tr></tbody></table>)
         expect(screen.getByText('-')).toBeInTheDocument()
    })
})

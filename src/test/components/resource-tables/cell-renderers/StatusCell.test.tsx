
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../test-utils'
import { StatusCell } from '../../../../components/resource-tables/cell-renderers/StatusCell'
import { mockPods, mockNodes } from '../../../fixtures/k8s-resources'

describe('StatusCell', () => {
    const style = { width: '100px' }
    const mockPod = mockPods[0]
    const mockNode = mockNodes[0]

    it('renders Pod status', () => {
        render(<table><tbody><tr><StatusCell resource={mockPod} resourceType="pods" style={style} /></tr></tbody></table>)
        expect(screen.getByText('Running')).toBeInTheDocument()
    })

    it('renders Node status', () => {
        render(<table><tbody><tr><StatusCell resource={mockNode} resourceType="nodes" style={style} /></tr></tbody></table>)
        expect(screen.getByText('Ready')).toBeInTheDocument()
    })

    it('renders Unknown for mismatched types', () => {
        render(<table><tbody><tr><StatusCell resource={{} as any} resourceType="services" style={style} /></tr></tbody></table>)
        // Should default to Unknown or handled gracefully
        expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
})

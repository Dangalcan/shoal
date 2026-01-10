
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../test-utils'
import { NamespaceCell, AgeCell, DataCountCell, SelectorCell, ContainersCell, ImagesCell } from '../../../../components/resource-tables/cell-renderers/CommonCells'
import { mockPods } from '../../../fixtures/k8s-resources'

describe('CommonCells', () => {
    const style = { width: '100px' }
    const mockPod = mockPods[0]

    it('NamespaceCell renders namespace', () => {
        render(<table><tbody><tr><NamespaceCell resource={mockPod} style={style} /></tr></tbody></table>)
        expect(screen.getByText(mockPod.metadata.namespace)).toBeInTheDocument()
    })

    it('AgeCell renders creation timestamp', () => {
        // Just checking it renders something date-like or content present
        render(<table><tbody><tr><AgeCell resource={mockPod} style={style} /></tr></tbody></table>)
        expect(screen.getByText(/20/)).toBeInTheDocument() // Assuming mock has a year or reasonable date part
    })

    it('DataCountCell renders count from data', () => {
        const secret = { ...mockPod, data: { 'key': 'value', 'key2': 'value2' } }
        render(<table><tbody><tr><DataCountCell resource={secret} style={style} /></tr></tbody></table>)
        expect(screen.getByText('2')).toBeInTheDocument()
    })
    
     it('SelectorCell renders labels', () => {
        const deployment = { ...mockPod, spec: { selector: { matchLabels: { app: 'test' } } } }
         render(<table><tbody><tr><SelectorCell resource={deployment} style={style} /></tr></tbody></table>)
        expect(screen.getByText('app=test')).toBeInTheDocument()
    })
    
    it('ContainersCell renders container names', () => {
         render(<table><tbody><tr><ContainersCell resource={mockPod} style={style} /></tr></tbody></table>)
         expect(screen.getByText('c1')).toBeInTheDocument()
    })
})

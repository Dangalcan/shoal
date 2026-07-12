
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../utils'
import { NamespaceCell, AgeCell, DataCountCell, SelectorCell, ContainersCell, ImagesCell } from '../../../../components/resource-tables/cell-renderers/CommonCells'
import { mockPods } from '../../../fixtures/resources'

describe('CommonCells', () => {
    const style = { width: '100px' }
    const mockPod = mockPods[0]!

    it('NamespaceCell renders namespace', () => {
        render(<table><tbody><tr><NamespaceCell resource={mockPod} style={style} /></tr></tbody></table>)
        expect(screen.getByText(mockPod.metadata.namespace!)).toBeInTheDocument()
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

    const bare = { metadata: { name: 'r', namespace: 'default', creationTimestamp: '2026-01-01T00:00:00Z' } } as any

    it('DataCountCell falls back to binaryData, then to zero', () => {
        const { unmount } = render(<table><tbody><tr><DataCountCell resource={{ ...bare, binaryData: { blob: 'x' } }} style={style} /></tr></tbody></table>)
        expect(screen.getByText('1')).toBeInTheDocument()
        unmount()
        render(<table><tbody><tr><DataCountCell resource={bare} style={style} /></tr></tbody></table>)
        expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('SelectorCell falls back to a bare selector map and to <none>', () => {
        const { unmount } = render(<table><tbody><tr><SelectorCell resource={{ ...bare, spec: { selector: { app: 'svc' } } }} style={style} /></tr></tbody></table>)
        expect(screen.getByText('app=svc')).toBeInTheDocument()
        unmount()
        render(<table><tbody><tr><SelectorCell resource={bare} style={style} /></tr></tbody></table>)
        expect(screen.getByText('<none>')).toBeInTheDocument()
    })

    it('ContainersCell reads a workload template spec and falls back to <none>', () => {
        const workload = { ...bare, spec: { template: { spec: { containers: [{ name: 'tpl-c' }] } } } }
        const { unmount } = render(<table><tbody><tr><ContainersCell resource={workload} style={style} /></tr></tbody></table>)
        expect(screen.getByText('tpl-c')).toBeInTheDocument()
        unmount()
        render(<table><tbody><tr><ContainersCell resource={bare} style={style} /></tr></tbody></table>)
        expect(screen.getByText('<none>')).toBeInTheDocument()
    })

    it('ImagesCell reads images from template/bare specs and falls back to <none>', () => {
        const workload = { ...bare, spec: { template: { spec: { containers: [{ image: 'nginx:1.27' }] } } } }
        const { unmount: u1 } = render(<table><tbody><tr><ImagesCell resource={workload} style={style} /></tr></tbody></table>)
        expect(screen.getByText('nginx:1.27')).toBeInTheDocument()
        u1()
        const { unmount: u2 } = render(<table><tbody><tr><ImagesCell resource={{ ...bare, spec: { containers: [{ image: 'busybox' }] } }} style={style} /></tr></tbody></table>)
        expect(screen.getByText('busybox')).toBeInTheDocument()
        u2()
        render(<table><tbody><tr><ImagesCell resource={bare} style={style} /></tr></tbody></table>)
        expect(screen.getByText('<none>')).toBeInTheDocument()
    })
})


import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../utils'
import { RestartsCell, PodIPCell, NodeNameCell, NominatedNodeCell, ReadinessGatesCell } from '../../../../components/resource-tables/cell-renderers/PodCells'
import { mockPods } from '../../../fixtures/k8s-resources'

describe('PodCells', () => {
    const style = { width: '100px' }
    const mockPod = mockPods[0]

    it('RestartsCell renders restart count', () => {
         render(<table><tbody><tr><RestartsCell resource={mockPod} style={style} /></tr></tbody></table>)
         expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('PodIPCell renders IP', () => {
        render(<table><tbody><tr><PodIPCell resource={mockPod} style={style} /></tr></tbody></table>)
        expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
    })

    it('NodeNameCell renders node name', () => {
        render(<table><tbody><tr><NodeNameCell resource={mockPod} style={style} /></tr></tbody></table>)
        expect(screen.getByText('node-A')).toBeInTheDocument()
    })
})

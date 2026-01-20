
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../utils'
import { ServiceTypeCell, ClusterIPCell, ExternalIPCell, PortsCell } from '../../../../components/resource-tables/cell-renderers/NetworkCells'
import { mockServices } from '../../../fixtures/k8s-resources'

describe('NetworkCells', () => {
    const style = { width: '100px' }
    const mockService = mockServices[0]! // LoadBalancer
    const mockClusterIpService = mockServices[1]! // ClusterIP

    it('ServiceTypeCell renders type', () => {
        render(<table><tbody><tr><ServiceTypeCell resource={mockClusterIpService} style={style} /></tr></tbody></table>)
        expect(screen.getByText('ClusterIP')).toBeInTheDocument()
    })

    it('ClusterIPCell renders IP', () => {
        render(<table><tbody><tr><ClusterIPCell resource={mockService} style={style} /></tr></tbody></table>)
        expect(screen.getByText('10.96.0.1')).toBeInTheDocument()
    })

    it('PortsCell renders ports', () => {
        render(<table><tbody><tr><PortsCell resource={mockClusterIpService} resourceType="services" style={style} /></tr></tbody></table>)
        expect(screen.getByText('443/TCP')).toBeInTheDocument()
    })
})

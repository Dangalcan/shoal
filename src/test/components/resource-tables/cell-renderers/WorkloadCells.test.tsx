
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../test-utils'
import { ReadyCell, DesiredCell, CurrentCell, AvailableCell } from '../../../../components/resource-tables/cell-renderers/WorkloadCells'
import { mockDeployments } from '../../../fixtures/k8s-resources'

describe('WorkloadCells', () => {
    const style = { width: '100px' }
    const mockDeployment = mockDeployments[0]

    it('ReadyCell renders ready/total', () => {
        render(<table><tbody><tr><ReadyCell resource={mockDeployment} resourceType="deployments" style={style} /></tr></tbody></table>)
        // 2 ready out of 3 total? mockDeployments[0] has readyReplicas: 2, replicas: 3
        expect(screen.getByText('2 / 3')).toBeInTheDocument()
    })

    it('DesiredCell renders desired replicas', () => {
        // spec.replicas not set in mockDeployments[0] spec?
        // spec: { template: ..., selector: ... }
        // Wait, spec.replicas is MISSING in mockDeployments[0] in k8s-resources.ts!
        // It defaults to 0 in DesiredCell?
        // Let's check k8s-resources.ts Step 658
        render(<table><tbody><tr><DesiredCell resource={mockDeployment} resourceType="deployments" style={style} /></tr></tbody></table>)
        expect(screen.getByText('0')).toBeInTheDocument()
    })
    
    it('AvailableCell renders available replicas', () => {
        // availableReplicas: 1
        render(<table><tbody><tr><AvailableCell resource={mockDeployment} resourceType="deployments" style={style} /></tr></tbody></table>)
         expect(screen.getByText('1')).toBeInTheDocument()
    })
})

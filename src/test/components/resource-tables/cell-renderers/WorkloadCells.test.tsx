
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../utils'
import { 
    ReadyCell, 
    DesiredCell, 
    CurrentCell, 
    UpdatedCell,
    AvailableCell,
    CompletionsCell,
    DurationCell
} from '../../../../components/resource-tables/cell-renderers/WorkloadCells'
import { mockDeployments } from '../../../fixtures/k8s-resources'

describe('WorkloadCells', () => {
    const style = { width: '100px' }
    const mockDeployment = mockDeployments[0]!

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
        render(<table><tbody><tr><AvailableCell resource={mockDeployment} resourceType="deployments" style={style} /></tr></tbody></table>)
         expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('ReadyCell handles DaemonSets and ReplicaSets', () => {
        const mockRs = { status: { readyReplicas: 5 } } as any
        render(<table><tbody><tr><ReadyCell resource={mockRs} resourceType="replicasets" style={style} /></tr></tbody></table>)
        expect(screen.getByText('5')).toBeInTheDocument()

        const mockDs = { status: { numberReady: 3 } } as any
        render(<table><tbody><tr><ReadyCell resource={mockDs} resourceType="daemonsets" style={style} /></tr></tbody></table>)
        expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('DesiredCell handles DaemonSets', () => {
        const mockDs = { status: { desiredNumberScheduled: 4 } } as any
        render(<table><tbody><tr><DesiredCell resource={mockDs} resourceType="daemonsets" style={style} /></tr></tbody></table>)
        expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('CurrentCell renders current replicas (DaemonSet)', () => {
        const mockDs = { status: { currentNumberScheduled: 2 } } as any
        render(<table><tbody><tr><CurrentCell resource={mockDs} resourceType="daemonsets" style={style} /></tr></tbody></table>)
        expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('CurrentCell renders current replicas (Deployment)', () => {
        render(<table><tbody><tr><CurrentCell resource={mockDeployment} resourceType="deployments" style={style} /></tr></tbody></table>)
        expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('UpdatedCell renders updated replicas (DaemonSet)', () => {
        const mockDs = { status: { updatedNumberScheduled: 1 } } as any
        render(<table><tbody><tr><UpdatedCell resource={mockDs} resourceType="daemonsets" style={style} /></tr></tbody></table>)
        expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('UpdatedCell renders updated replicas (Deployment)', () => {
        const mockDep = { status: { updatedReplicas: 2 } } as any
        render(<table><tbody><tr><UpdatedCell resource={mockDep} resourceType="deployments" style={style} /></tr></tbody></table>)
        expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('CompletionsCell renders job completions', () => {
        const mockJob = { spec: { completions: 5 }, status: { succeeded: 3 } } as any
        render(<table><tbody><tr><CompletionsCell resource={mockJob} style={style} /></tr></tbody></table>)
        expect(screen.getByText('3 / 5')).toBeInTheDocument()
    })

    it('DurationCell renders running job duration', () => {
        const startTime = new Date(Date.now() - 10000).toISOString()
        const mockJob = { status: { startTime } } as any
        render(<table><tbody><tr><DurationCell resource={mockJob} style={style} /></tr></tbody></table>)
        expect(screen.getByText(/10s|9s|11s/)).toBeInTheDocument()
    })

    it('DurationCell renders finished job duration', () => {
        const startTime = new Date(Date.now() - 10000).toISOString()
        const completionTime = new Date(Date.now()).toISOString()
        const mockJobFinished = { status: { startTime, completionTime } } as any
        render(<table><tbody><tr><DurationCell resource={mockJobFinished} style={style} /></tr></tbody></table>)
        expect(screen.getByText(/10s|9s|11s/)).toBeInTheDocument()
    })
})

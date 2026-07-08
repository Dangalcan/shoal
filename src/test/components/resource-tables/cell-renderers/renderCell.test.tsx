
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

    const renderCol = (colId: string, resource: any, resourceType: any) =>
        render(
            <table><tbody><tr>
                {renderCell({ colId, resource, resourceType, style })}
            </tr></tbody></table>
        )

    const baseMeta = { metadata: { name: 'x', namespace: 'default' }, spec: {}, status: {} }

    it('renders cronjob cells', () => {
        renderCol('schedule', { ...baseMeta, spec: { schedule: '* * * * *' } }, 'cronjobs')
        renderCol('last-schedule', baseMeta, 'cronjobs')
    })

    it('renders workload desired/current cells', () => {
        renderCol('desired', { ...baseMeta, spec: { replicas: 3 } }, 'deployments')
        renderCol('current', { ...baseMeta, status: { replicas: 2 } }, 'deployments')
    })

    it('renders job cells', () => {
        renderCol('completions', { ...baseMeta, status: { succeeded: 1 }, spec: { completions: 3 } }, 'jobs')
        renderCol('duration', baseMeta, 'jobs')
    })

    it('renders storage PV cells', () => {
        renderCol('reclaim-policy', { ...baseMeta, spec: { persistentVolumeReclaimPolicy: 'Retain' } }, 'persistentvolume')
        renderCol('claim', baseMeta, 'persistentvolume')
    })

    it('renders storageclass cells', () => {
        renderCol('provisioner', { ...baseMeta, provisioner: 'kubernetes.io/aws-ebs' }, 'storageclass')
        renderCol('binding-mode', { ...baseMeta, volumeBindingMode: 'Immediate' }, 'storageclass')
        renderCol('allow-expansion', { ...baseMeta, allowVolumeExpansion: true }, 'storageclass')
    })

    it('generic fallback reads top-level and spec props', () => {
        renderCol('topLevelField', { ...baseMeta, topLevelField: 'top' }, 'pods') // line 215
        expect(screen.getByText('top')).toBeInTheDocument()
        renderCol('specField', { ...baseMeta, spec: { specField: 'inspec' } }, 'pods') // line 218
        expect(screen.getByText('inspec')).toBeInTheDocument()
    })

    it('generic fallback handles resource without spec/status', () => {
        // resource lacks spec/status → exercises the `|| {}` fallbacks (lines 210-211)
        renderCol('missing', { metadata: { name: 'y' } }, 'pods')
        expect(screen.getByText('-')).toBeInTheDocument()
    })
})

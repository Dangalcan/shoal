
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../utils'
import {
    HPAReferenceCell,
    SecretTypeCell,
    CronJobScheduleCell,
    CronJobLastScheduleCell,
    HPATargetsCell,
    MinPodsCell,
    MaxPodsCell,
    ReplicasCell,
} from '../../../../components/resource-tables/cell-renderers/OtherCells'

describe('OtherCells', () => {
    const style = { width: '100px' }

    it('HPAReferenceCell renders target ref', () => {
        const resource = { 
            metadata: { name: 'hpa', creationTimestamp: '' },
            spec: { scaleTargetRef: { kind: 'Deployment', name: 'app' } } 
        }
        render(<table><tbody><tr><HPAReferenceCell resource={resource as any} style={style} /></tr></tbody></table>)
        expect(screen.getByText('Deployment/app')).toBeInTheDocument()
    })

    it('SecretTypeCell renders type', () => {
        const resource = { 
            metadata: { name: 'secret', creationTimestamp: '' },
            type: 'Opaque' 
        }
        render(<table><tbody><tr><SecretTypeCell resource={resource as any} style={style} /></tr></tbody></table>)
        expect(screen.getByText('Opaque')).toBeInTheDocument()
    })

    it('CronJobScheduleCell renders schedule', () => {
        const resource = {
            metadata: { name: 'cronjob', creationTimestamp: '' },
            spec: { schedule: '*/1 * * * *' }
        }
        render(<table><tbody><tr><CronJobScheduleCell resource={resource as any} style={style} /></tr></tbody></table>)
        expect(screen.getByText('*/1 * * * *')).toBeInTheDocument()
    })

    it('CronJobScheduleCell falls back to "-" when schedule is missing', () => {
        render(<table><tbody><tr><CronJobScheduleCell resource={{ metadata: {}, spec: {} } as any} style={style} /></tr></tbody></table>)
        expect(screen.getByText('-')).toBeInTheDocument()
    })

    it('CronJobLastScheduleCell shows time, else Never', () => {
        const withTime = { metadata: {}, status: { lastScheduleTime: '2024-01-01T00:00:00Z' } } as any
        const { unmount } = render(<table><tbody><tr><CronJobLastScheduleCell resource={withTime} style={style} /></tr></tbody></table>)
        expect(screen.getByText('2024-01-01T00:00:00Z')).toBeInTheDocument()
        unmount()
        render(<table><tbody><tr><CronJobLastScheduleCell resource={{ metadata: {}, status: {} } as any} style={style} /></tr></tbody></table>)
        expect(screen.getByText('Never')).toBeInTheDocument()
    })

    it('HPATargetsCell shows <unknown> when metrics missing, value otherwise', () => {
        const bare = { metadata: {}, spec: {}, status: {} } as any
        const { unmount } = render(<table><tbody><tr><HPATargetsCell resource={bare} style={style} /></tr></tbody></table>)
        expect(screen.getByText('<unknown>')).toBeInTheDocument()
        unmount()
        const full = {
            metadata: {},
            spec: { metrics: [{ resource: { target: { averageUtilization: 80 } } }] },
            status: { currentMetrics: [{ resource: { current: { averageUtilization: 40 } } }] },
        } as any
        render(<table><tbody><tr><HPATargetsCell resource={full} style={style} /></tr></tbody></table>)
        expect(screen.getByText('40% / 80%')).toBeInTheDocument()
    })

    it('MinPods/MaxPods/Replicas render values and "-" fallback', () => {
        const hpa = { metadata: {}, spec: { minReplicas: 1, maxReplicas: 5 }, status: { currentReplicas: 3 } } as any
        const empty = { metadata: {}, spec: {}, status: {} } as any

        const { unmount: u1 } = render(<table><tbody><tr><MinPodsCell resource={hpa} style={style} /></tr></tbody></table>)
        expect(screen.getByText('1')).toBeInTheDocument()
        u1()
        const { unmount: u2 } = render(<table><tbody><tr><MaxPodsCell resource={hpa} style={style} /></tr></tbody></table>)
        expect(screen.getByText('5')).toBeInTheDocument()
        u2()
        const { unmount: u3 } = render(<table><tbody><tr><ReplicasCell resource={hpa} style={style} /></tr></tbody></table>)
        expect(screen.getByText('3')).toBeInTheDocument()
        u3()

        const { unmount: u4 } = render(<table><tbody><tr><MinPodsCell resource={empty} style={style} /></tr></tbody></table>)
        expect(screen.getByText('-')).toBeInTheDocument()
        u4()
        const { unmount: u5 } = render(<table><tbody><tr><MaxPodsCell resource={empty} style={style} /></tr></tbody></table>)
        expect(screen.getByText('-')).toBeInTheDocument()
        u5()
        render(<table><tbody><tr><ReplicasCell resource={empty} style={style} /></tr></tbody></table>)
        expect(screen.getByText('-')).toBeInTheDocument()
    })

    it('HPAReferenceCell and SecretTypeCell fall back to "-"', () => {
        const { unmount } = render(<table><tbody><tr><HPAReferenceCell resource={{ metadata: {}, spec: {} } as any} style={style} /></tr></tbody></table>)
        expect(screen.getByText('-')).toBeInTheDocument()
        unmount()
        render(<table><tbody><tr><SecretTypeCell resource={{ metadata: {} } as any} style={style} /></tr></tbody></table>)
        expect(screen.getByText('-')).toBeInTheDocument()
    })
})

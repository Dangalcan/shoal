
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../utils'
import { HPAReferenceCell, SecretTypeCell, CronJobScheduleCell } from '../../../../components/resource-tables/cell-renderers/OtherCells'

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
})

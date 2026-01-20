
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../utils'
import { HPAReferenceCell, SecretTypeCell, CronJobScheduleCell } from '../../../../components/resource-tables/cell-renderers/OtherCells'

describe('OtherCells', () => {
    const style = { width: '100px' }

    it('HPAReferenceCell renders target ref', () => {
        const resource = { spec: { scaleTargetRef: { kind: 'Deployment', name: 'app' } } }
        render(<table><tbody><tr><HPAReferenceCell resource={resource} style={style} /></tr></tbody></table>)
        expect(screen.getByText('Deployment/app')).toBeInTheDocument()
    })

    it('SecretTypeCell renders type', () => {
        const resource = { type: 'Opaque' }
        render(<table><tbody><tr><SecretTypeCell resource={resource} style={style} /></tr></tbody></table>)
        expect(screen.getByText('Opaque')).toBeInTheDocument()
    })

    it('CronJobScheduleCell renders schedule', () => {
        const resource = { spec: { schedule: '*/1 * * * *' } }
        render(<table><tbody><tr><CronJobScheduleCell resource={resource} style={style} /></tr></tbody></table>)
        expect(screen.getByText('*/1 * * * *')).toBeInTheDocument()
    })
})

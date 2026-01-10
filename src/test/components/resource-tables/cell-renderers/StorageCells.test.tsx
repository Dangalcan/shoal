
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../test-utils'
import { CapacityCell, AccessModesCell, StorageClassCell, ClaimCell } from '../../../../components/resource-tables/cell-renderers/StorageCells'

describe('StorageCells', () => {
    const style = { width: '100px' }
    const mockPv = {
        kind: 'PersistentVolume',
        metadata: { name: 'pv-1' },
        spec: {
            capacity: { storage: '10Gi' },
            accessModes: ['ReadWriteOnce'],
            storageClassName: 'standard',
            claimRef: { namespace: 'default', name: 'pvc-1' }
        }
    } as any

    it('CapacityCell renders storage', () => {
        render(<table><tbody><tr><CapacityCell resource={mockPv} style={style} /></tr></tbody></table>)
        expect(screen.getByText('10Gi')).toBeInTheDocument()
    })

    it('AccessModesCell renders modes', () => {
        render(<table><tbody><tr><AccessModesCell resource={mockPv} style={style} /></tr></tbody></table>)
        expect(screen.getByText('ReadWriteOnce')).toBeInTheDocument()
    })

    it('StorageClassCell renders class name', () => {
        render(<table><tbody><tr><StorageClassCell resource={mockPv} style={style} /></tr></tbody></table>)
        expect(screen.getByText('standard')).toBeInTheDocument()
    })

    it('ClaimCell renders claim ref', () => {
        render(<table><tbody><tr><ClaimCell resource={mockPv} style={style} /></tr></tbody></table>)
        expect(screen.getByText('default/pvc-1')).toBeInTheDocument()
    })
})

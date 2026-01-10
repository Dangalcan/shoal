
import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../test-utils'
import { 
    CapacityCell, 
    AccessModesCell, 
    StorageClassCell, 
    ClaimCell, 
    VolumeModeCell, 
    ReclaimPolicyCell, 
    VolumeCell,
    ProvisionerCell,
    BindingModeCell,
    AllowExpansionCell,
    PVCSelectedNodeCell,
    VACCell
} from '../../../../components/resource-tables/cell-renderers/StorageCells'

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

    it('VolumeModeCell renders mode', () => {
        const mockPvc = { spec: { volumeMode: 'Block' } } as any
        render(<table><tbody><tr><VolumeModeCell resource={mockPvc} style={style} /></tr></tbody></table>)
        expect(screen.getByText('Block')).toBeInTheDocument()
    })

    it('ReclaimPolicyCell renders policy', () => {
        const mockPvPolicy = { spec: { persistentVolumeReclaimPolicy: 'Retain' } } as any
        render(<table><tbody><tr><ReclaimPolicyCell resource={mockPvPolicy} style={style} /></tr></tbody></table>)
        expect(screen.getByText('Retain')).toBeInTheDocument()
    })

    it('VolumeCell renders volume name', () => {
        const mockPvc = { spec: { volumeName: 'pv-1' } } as any
        render(<table><tbody><tr><VolumeCell resource={mockPvc} style={style} /></tr></tbody></table>)
        expect(screen.getByText('pv-1')).toBeInTheDocument()
    })

    it('ProvisionerCell renders provisioner', () => {
        const mockSc = { provisioner: 'kubernetes.io/aws-ebs' } as any
        render(<table><tbody><tr><ProvisionerCell resource={mockSc} style={style} /></tr></tbody></table>)
        expect(screen.getByText('kubernetes.io/aws-ebs')).toBeInTheDocument()
    })

    it('BindingModeCell renders mode', () => {
        const mockSc = { volumeBindingMode: 'WaitForFirstConsumer' } as any
        render(<table><tbody><tr><BindingModeCell resource={mockSc} style={style} /></tr></tbody></table>)
        expect(screen.getByText('WaitForFirstConsumer')).toBeInTheDocument()
    })

    it('AllowExpansionCell renders expansion', () => {
        const mockSc = { allowVolumeExpansion: true } as any
        render(<table><tbody><tr><AllowExpansionCell resource={mockSc} style={style} /></tr></tbody></table>)
        expect(screen.getByText('true')).toBeInTheDocument()
    })

    it('PVCSelectedNodeCell renders node', () => {
        const mockPvc = { metadata: { annotations: { 'volume.kubernetes.io/selected-node': 'node-1' } } } as any
        render(<table><tbody><tr><PVCSelectedNodeCell resource={mockPvc} style={style} /></tr></tbody></table>)
        expect(screen.getByText('node-1')).toBeInTheDocument()
    })

    it('VACCell renders VAC', () => {
        const mockPvc = { spec: { volumeAttributesClassName: 'vac-1' } } as any
        render(<table><tbody><tr><VACCell resource={mockPvc} style={style} /></tr></tbody></table>)
        expect(screen.getByText('vac-1')).toBeInTheDocument()
    })
})

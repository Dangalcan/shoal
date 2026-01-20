import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CapacityCell,
  AccessModesCell,
  StorageClassCell,
  VolumeModeCell,
  ReclaimPolicyCell,
  ClaimCell,
  VolumeCell,
  ProvisionerCell,
  BindingModeCell,
  AllowExpansionCell,
  PVCSelectedNodeCell,
  VACCell,
} from '../../../../components/resource-tables/cell-renderers/StorageCells';
import { K8sResource } from '../../../../types/k8s-types';

describe('StorageCells', () => {
  const emptyResource: K8sResource = {
    kind: 'PersistentVolume',
    apiVersion: 'v1',
    metadata: {
      name: 'test-pv',
      uid: '123',
      creationTimestamp: '2023-01-01T00:00:00Z',
    },
  } as any;

  const style = {};

  describe('CapacityCell', () => {
    it('should render status capacity', () => {
      const resource = { ...emptyResource, status: { capacity: { storage: '10Gi' } } };
      render(<CapacityCell resource={resource} style={style} />);
      expect(screen.getByText('10Gi')).toBeInTheDocument();
    });

    it('should render spec capacity if status missing', () => {
        const resource = { ...emptyResource, spec: { capacity: { storage: '5Gi' } } };
        render(<CapacityCell resource={resource} style={style} />);
        expect(screen.getByText('5Gi')).toBeInTheDocument();
    });

    it('should render <none> if missing', () => {
      render(<CapacityCell resource={emptyResource} style={style} />);
      expect(screen.getByText('<none>')).toBeInTheDocument();
    });
  });

  describe('AccessModesCell', () => {
    it('should render modes', () => {
      const resource = { ...emptyResource, spec: { accessModes: ['RWO', 'ROX'] } };
      render(<AccessModesCell resource={resource} style={style} />);
      expect(screen.getByText('RWO, ROX')).toBeInTheDocument();
    });

    it('should render <none> if missing', () => {
      render(<AccessModesCell resource={emptyResource} style={style} />);
      expect(screen.getByText('<none>')).toBeInTheDocument();
    });
  });

  describe('StorageClassCell', () => {
      it('should render storage class', () => {
          const resource = { ...emptyResource, spec: { storageClassName: 'standard' } };
          render(<StorageClassCell resource={resource} style={style} />);
          expect(screen.getByText('standard')).toBeInTheDocument();
      });

      it('should render <none> if missing', () => {
          render(<StorageClassCell resource={emptyResource} style={style} />);
          expect(screen.getByText('<none>')).toBeInTheDocument();
      });
  });

  describe('VolumeModeCell', () => {
      it('should render volume mode', () => {
          const resource = { ...emptyResource, spec: { volumeMode: 'Block' } };
          render(<VolumeModeCell resource={resource} style={style} />);
          expect(screen.getByText('Block')).toBeInTheDocument();
      });

      it('should fallback to Filesystem', () => {
          render(<VolumeModeCell resource={emptyResource} style={style} />);
          expect(screen.getByText('Filesystem')).toBeInTheDocument();
      });
  });

  describe('ReclaimPolicyCell', () => {
      it('should render reclaim policy from spec', () => {
          const resource = { ...emptyResource, spec: { persistentVolumeReclaimPolicy: 'Retain' } };
          render(<ReclaimPolicyCell resource={resource} style={style} />);
          expect(screen.getByText('Retain')).toBeInTheDocument();
      });

      it('should render reclaim policy from root', () => {
          const resource = { ...emptyResource, reclaimPolicy: 'Recycle' } as any;
          render(<ReclaimPolicyCell resource={resource} style={style} />);
          expect(screen.getByText('Recycle')).toBeInTheDocument();
      });

      it('should fallback to Delete', () => {
          render(<ReclaimPolicyCell resource={emptyResource} style={style} />);
          expect(screen.getByText('Delete')).toBeInTheDocument();
      });
  });

  describe('ClaimCell', () => {
      it('should render claim ref', () => {
          const resource = { 
              ...emptyResource, 
              spec: { claimRef: { namespace: 'default', name: 'my-claim' } } 
          };
          render(<ClaimCell resource={resource} style={style} />);
          expect(screen.getByText('default/my-claim')).toBeInTheDocument();
      });

      it('should render <none> if missing', () => {
          render(<ClaimCell resource={emptyResource} style={style} />);
          expect(screen.getByText('<none>')).toBeInTheDocument();
      });
  });

  describe('VolumeCell', () => {
      it('should render volume name', () => {
          const resource = { ...emptyResource, spec: { volumeName: 'pv-123' } };
          render(<VolumeCell resource={resource} style={style} />);
          expect(screen.getByText('pv-123')).toBeInTheDocument();
      });

        it('should render <none> if missing', () => {
            render(<VolumeCell resource={emptyResource} style={style} />);
            expect(screen.getByText('<none>')).toBeInTheDocument();
        });
  });

  describe('ProvisionerCell', () => {
      it('should render provisioner', () => {
          const resource = { ...emptyResource, provisioner: 'driver.k8s.io' } as any;
          render(<ProvisionerCell resource={resource} style={style} />);
          expect(screen.getByText('driver.k8s.io')).toBeInTheDocument();
      });

      it('should render <none> if missing', () => {
          render(<ProvisionerCell resource={emptyResource} style={style} />);
          expect(screen.getByText('<none>')).toBeInTheDocument();
      });
  });

    describe('BindingModeCell', () => {
        it('should render binding mode', () => {
            const resource = { ...emptyResource, volumeBindingMode: 'WaitForFirstConsumer' } as any;
            render(<BindingModeCell resource={resource} style={style} />);
            expect(screen.getByText('WaitForFirstConsumer')).toBeInTheDocument();
        });

        it('should render <none> if missing', () => {
            render(<BindingModeCell resource={emptyResource} style={style} />);
            expect(screen.getByText('<none>')).toBeInTheDocument();
        });
    });

    describe('AllowExpansionCell', () => {
        it('should render true', () => {
            const resource = { ...emptyResource, allowVolumeExpansion: true } as any;
            render(<AllowExpansionCell resource={resource} style={style} />);
            expect(screen.getByText('true')).toBeInTheDocument();
        });

        it('should render false', () => {
            const resource = { ...emptyResource, allowVolumeExpansion: false } as any;
            render(<AllowExpansionCell resource={resource} style={style} />);
            expect(screen.getByText('false')).toBeInTheDocument();
        });

        it('should default to false', () => {
             render(<AllowExpansionCell resource={emptyResource} style={style} />);
             expect(screen.getByText('false')).toBeInTheDocument();
        });
    });

    describe('PVCSelectedNodeCell', () => {
        it('should render selected node from annotation', () => {
            const resource = { 
                ...emptyResource, 
                metadata: { ...emptyResource.metadata, annotations: { 'volume.kubernetes.io/selected-node': 'node-1' } } 
            };
            render(<PVCSelectedNodeCell resource={resource} style={style} />);
            expect(screen.getByText('node-1')).toBeInTheDocument();
        });

        it('should render <none> if missing', () => {
            render(<PVCSelectedNodeCell resource={emptyResource} style={style} />);
            expect(screen.getByText('<none>')).toBeInTheDocument();
        });
    });

    describe('VACCell', () => {
        it('should render volume attributes class', () => {
             const resource = { ...emptyResource, spec: { volumeAttributesClassName: 'fast' } };
             render(<VACCell resource={resource} style={style} />);
             expect(screen.getByText('fast')).toBeInTheDocument();
        });

        it('should render <none> if missing', () => {
            render(<VACCell resource={emptyResource} style={style} />);
            expect(screen.getByText('<none>')).toBeInTheDocument();
        });
    });
});

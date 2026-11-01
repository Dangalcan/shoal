import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../utils';
import { renderCell } from '../../../../components/resource-tables/cell-renderers/renderCell';
import { mockPods, mockNodes } from '../../../fixtures/k8s-resources';
import { render as rtlRender } from '@testing-library/react';
import {
  COLUMN_DEFINITIONS,
  type ResourceType,
} from '../../../../lib/resources/resource-definitions';
import { getFieldColumn } from '../../../../lib/resources/field-columns';
import type { K8sResource } from '../../../../types/k8s-types';

describe('renderCell', () => {
  const style = { width: '100px' };
  const mockPod = mockPods[0]!;
  const mockNode = mockNodes[0]!;

  it('sanity check inputs', () => {
    expect(mockPods).toBeDefined();
    expect(mockPods.length).toBeGreaterThan(0);
    expect(mockPod).toBeDefined();
  });

  it('renders common cells', () => {
    // namespace
    render(
      <table>
        <tbody>
          <tr>
            {renderCell({
              colId: 'namespace',
              resource: mockPod,
              resourceType: 'pods',
              style,
            })}
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText(mockPod.metadata.namespace!)).toBeInTheDocument();
  });

  it('renders pod specific cells', () => {
    // restarts
    render(
      <table>
        <tbody>
          <tr>
            {renderCell({
              colId: 'restarts',
              resource: mockPod,
              resourceType: 'pods',
              style,
            })}
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders node specific cells', () => {
    // roles
    render(
      <table>
        <tbody>
          <tr>
            {renderCell({
              colId: 'roles',
              resource: mockNode,
              resourceType: 'nodes',
              style,
            })}
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('master')).toBeInTheDocument();
  });

  it('renders fallback for unknown columns', () => {
    // generic property from metadata/status/spec
    const customRes = { ...mockPod, status: { customField: 'customValue' } };
    render(
      <table>
        <tbody>
          <tr>
            {renderCell({
              colId: 'customField',
              resource: customRes,
              resourceType: 'pods',
              style,
            })}
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('customValue')).toBeInTheDocument();
  });

  it('renders placeholder for missing data', () => {
    render(
      <table>
        <tbody>
          <tr>
            {renderCell({
              colId: 'nonExistent',
              resource: mockPod,
              resourceType: 'pods',
              style,
            })}
          </tr>
        </tbody>
      </table>
    );
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  const renderCol = (colId: string, resource: any, resourceType: any) =>
    render(
      <table>
        <tbody>
          <tr>{renderCell({ colId, resource, resourceType, style })}</tr>
        </tbody>
      </table>
    );

  const baseMeta = {
    metadata: { name: 'x', namespace: 'default' },
    spec: {},
    status: {},
  };

  it('renders cronjob cells', () => {
    renderCol(
      'schedule',
      { ...baseMeta, spec: { schedule: '* * * * *' } },
      'cronjobs'
    );
    renderCol('last-schedule', baseMeta, 'cronjobs');
  });

  it('renders workload desired/current cells', () => {
    renderCol('desired', { ...baseMeta, spec: { replicas: 3 } }, 'deployments');
    renderCol(
      'current',
      { ...baseMeta, status: { replicas: 2 } },
      'deployments'
    );
  });

  it('renders job cells', () => {
    renderCol(
      'completions',
      { ...baseMeta, status: { succeeded: 1 }, spec: { completions: 3 } },
      'jobs'
    );
    renderCol('duration', baseMeta, 'jobs');
  });

  it('renders storage PV cells', () => {
    renderCol(
      'reclaim-policy',
      { ...baseMeta, spec: { persistentVolumeReclaimPolicy: 'Retain' } },
      'persistentvolume'
    );
    renderCol('claim', baseMeta, 'persistentvolume');
  });

  it('renders storageclass cells', () => {
    renderCol(
      'provisioner',
      { ...baseMeta, provisioner: 'kubernetes.io/aws-ebs' },
      'storageclass'
    );
    renderCol(
      'binding-mode',
      { ...baseMeta, volumeBindingMode: 'Immediate' },
      'storageclass'
    );
    renderCol(
      'allow-expansion',
      { ...baseMeta, allowVolumeExpansion: true },
      'storageclass'
    );
  });

  it('generic fallback reads top-level and spec props', () => {
    renderCol('topLevelField', { ...baseMeta, topLevelField: 'top' }, 'pods'); // line 215
    expect(screen.getByText('top')).toBeInTheDocument();
    renderCol(
      'specField',
      { ...baseMeta, spec: { specField: 'inspec' } },
      'pods'
    ); // line 218
    expect(screen.getByText('inspec')).toBeInTheDocument();
  });

  describe('every defined column', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    const columns = Object.entries(COLUMN_DEFINITIONS).flatMap(
      ([resourceType, defs]) =>
        defs
          .filter((def) => def.id !== 'name')
          .map((def) => ({ resourceType, colId: def.id }))
    );

    it.each(columns)(
      '$resourceType/$colId renders one cell for a bare resource',
      ({ resourceType, colId }) => {
        // Every configured column has a cell component or a field column:
        // none may reach the generic fallback, which warns in development.
        vi.stubEnv('DEV', true);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        rtlRender(
          <table>
            <tbody>
              <tr>
                {renderCell({
                  colId,
                  resource: {
                    metadata: {
                      name: 'bare',
                      namespace: 'default',
                      creationTimestamp: '2026-01-01T00:00:00Z',
                    },
                  },
                  resourceType: resourceType as ResourceType,
                  style,
                })}
              </tr>
            </tbody>
          </table>
        );

        expect(screen.getAllByRole('cell')).toHaveLength(1);
        expect(warn).not.toHaveBeenCalled();
      }
    );

    // The field columns read typed fields only: an object or a list where
    // they expect text never reaches the cell.
    const fieldColumns = columns.filter(({ resourceType, colId }) =>
      getFieldColumn(resourceType as ResourceType, colId)
    );

    it('serves the columns without a cell component', () => {
      expect(fieldColumns).not.toHaveLength(0);
    });

    it.each(fieldColumns)(
      '$resourceType/$colId never prints an object named like the column',
      ({ resourceType, colId }) => {
        const nested = { kind: 'Nested', items: [{ a: 1 }] };
        rtlRender(
          <table>
            <tbody>
              <tr>
                {renderCell({
                  colId,
                  resource: {
                    metadata: { name: 'odd', creationTimestamp: '' },
                    spec: { [colId]: nested },
                    status: { [colId]: [nested] },
                    [colId]: nested,
                  } as K8sResource,
                  resourceType: resourceType as ResourceType,
                  style,
                })}
              </tr>
            </tbody>
          </table>
        );

        expect(screen.getByRole('cell').textContent).not.toContain('[object');
      }
    );
  });

  describe('field columns', () => {
    const fieldText = (
      colId: string,
      resourceType: ResourceType,
      fields: Record<string, unknown>,
      metadata: Record<string, unknown> = {}
    ) => {
      rtlRender(
        <table>
          <tbody>
            <tr>
              {renderCell({
                colId,
                resource: {
                  metadata: {
                    name: 'r',
                    creationTimestamp: '2026-01-01T00:00:00Z',
                    ...metadata,
                  },
                  ...fields,
                } as K8sResource,
                resourceType,
                style,
              })}
            </tr>
          </tbody>
        </table>
      );
      return screen.getByRole('cell');
    };

    it('shows the event object as kind/name', () => {
      const cell = fieldText('object', 'events', {
        involvedObject: { kind: 'Pod', name: 'coredns-5d78c9869d-x2x7v' },
      });
      expect(cell).toHaveTextContent('pod/coredns-5d78c9869d-x2x7v');
      expect(cell).toHaveStyle({ width: '100px' });
    });

    it('shows a suspended cron job as True', () => {
      expect(
        fieldText('suspend', 'cronjobs', { spec: { suspend: true } })
      ).toHaveTextContent('True');
    });

    it('cuts a long endpoint list like kubectl', () => {
      const cell = fieldText('endpoints', 'endpoints', {
        subsets: [
          {
            addresses: [{ ip: '10.0.0.1' }, { ip: '10.0.0.2' }],
            ports: [{ port: 80 }, { port: 443 }],
          },
        ],
      });
      expect(cell).toHaveTextContent(
        '10.0.0.1:80,10.0.0.2:80,10.0.0.1:443 + 1 more...'
      );
    });

    it('shows an unavailable API service with its reason', () => {
      const cell = fieldText('available', 'apiservice', {
        status: {
          conditions: [
            { type: 'Available', status: 'False', reason: 'MissingEndpoints' },
          ],
        },
      });
      expect(cell).toHaveTextContent('False (MissingEndpoints)');
    });

    it('shows the pod security level of a namespace with its version', () => {
      const cell = fieldText(
        'enforce',
        'podsecurityadmission',
        { spec: { finalizers: ['kubernetes'] } },
        {
          labels: {
            'pod-security.kubernetes.io/enforce': 'baseline',
            'pod-security.kubernetes.io/enforce-version': 'v1.31',
          },
        }
      );
      expect(cell).toHaveTextContent('baseline (v1.31)');
    });

    it('shows a missing field as -', () => {
      expect(fieldText('holder', 'lease', { spec: {} })).toHaveTextContent(
        /^-$/
      );
    });
  });

  describe('generic fallback', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('shows - instead of an object or a list, and warns', () => {
      vi.stubEnv('DEV', true);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderCol(
        'future',
        { ...baseMeta, future: { a: 1 }, spec: { future: [1, 2] } },
        'pods'
      );
      expect(screen.getByText('-')).toBeInTheDocument();
      expect(screen.queryByText(/\[object/)).not.toBeInTheDocument();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('No renderer for column "future"')
      );
    });

    it('takes the first primitive of resource, spec and status', () => {
      renderCol(
        'future',
        { ...baseMeta, future: { a: 1 }, status: { future: 42 } },
        'pods'
      );
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('shows booleans like kubectl', () => {
      renderCol('future', { ...baseMeta, spec: { future: false } }, 'pods');
      expect(screen.getByText('False')).toBeInTheDocument();
    });
  });

  describe('unknown column warning', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('warns about a column without renderer in development', () => {
      vi.stubEnv('DEV', true);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderCol('mystery', baseMeta, 'pods');
      expect(screen.getByText('-')).toBeInTheDocument();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('No renderer for column "mystery"')
      );
    });

    it('stays silent about a column without renderer in production', () => {
      vi.stubEnv('DEV', false);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      renderCol('mystery', baseMeta, 'pods');
      expect(screen.getByText('-')).toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('generic fallback handles resource without spec/status', () => {
    // resource lacks spec/status → exercises the `|| {}` fallbacks (lines 210-211)
    renderCol('missing', { metadata: { name: 'y' } }, 'pods');
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});

import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../utils';
import { renderCell } from '../../../../components/resource-tables/cell-renderers/renderCell';
import { mockPods, mockNodes } from '../../../fixtures/k8s-resources';
import { render as rtlRender } from '@testing-library/react';
import {
  COLUMN_DEFINITIONS,
  type ResourceType,
} from '../../../../lib/resources/resource-definitions';

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
        // Columns without a dedicated renderer warn in development; that
        // gap is reported separately, so only the cell itself is checked.
        vi.spyOn(console, 'warn').mockImplementation(() => {});
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
      }
    );
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

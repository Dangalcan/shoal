import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../utils';
import {
  NameCell,
  StatusBadge,
  TextCell,
} from '../../../components/resource-tables/ResourceCells';

const inRow = (cell: ReactElement) => (
  <table>
    <tbody>
      <tr>{cell}</tr>
    </tbody>
  </table>
);

describe('TextCell', () => {
  it.each([
    [undefined, 'table-cell-text'],
    ['default', 'table-cell-text'],
    ['mono', 'table-cell-text-mono'],
    ['muted', 'table-cell-text-muted'],
  ] as const)('variant %s uses the %s class', (variant, className) => {
    render(inRow(<TextCell content="value" variant={variant} />));
    const cell = screen.getByRole('cell', { name: 'value' });
    expect(cell).toHaveClass(`table-cell ${className}`, { exact: true });
  });
});

describe('StatusBadge', () => {
  it.each([
    ['pods', 'Running', 'status-badge-success'],
    ['pvc', 'Bound', 'status-badge-success'],
    ['nodes', 'Ready', 'status-badge-success'],
    ['nodes', 'NotReady', 'status-badge-error'],
    ['pods', 'Pending', 'status-badge-other'],
    ['other', 'Complete', 'status-badge-other'],
  ] as const)('%s status %s uses %s', (type, status, className) => {
    render(<StatusBadge status={status} type={type} />);
    expect(screen.getByText(status)).toHaveClass(`status-badge ${className}`, {
      exact: true,
    });
  });
});

describe('NameCell', () => {
  it('renders the name as a log button when a log handler is given', () => {
    const onLogClick = vi.fn();
    render(
      inRow(<NameCell name="web-1" onLogClick={onLogClick} actions={{}} />)
    );

    fireEvent.click(screen.getByRole('button', { name: 'web-1' }));
    expect(onLogClick).toHaveBeenCalledTimes(1);
  });

  it('renders the name as plain text without a log handler', () => {
    render(inRow(<NameCell name="web-1" actions={{}} />));

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('cell', { name: 'web-1' })).toHaveAttribute(
      'title',
      'web-1'
    );
  });

  it('shows every action whose handler and flag are set and wires it', () => {
    const handlers = {
      onDescribe: vi.fn(),
      onYaml: vi.fn(),
      onRestart: vi.fn(),
      onScale: vi.fn(),
      onLogs: vi.fn(),
      onExec: vi.fn(),
      onForward: vi.fn(),
      onDelete: vi.fn(),
    };
    render(
      inRow(
        <NameCell
          name="web-1"
          actions={{
            ...handlers,
            showRestart: true,
            showScale: true,
            showLogs: true,
            showExec: true,
            showForward: true,
          }}
          extraActions={<button>Plugin action</button>}
        />
      )
    );

    const titles: [string, keyof typeof handlers][] = [
      ['Describe Resource', 'onDescribe'],
      ['View YAML', 'onYaml'],
      ['Rollout Restart', 'onRestart'],
      ['Scale Replicas', 'onScale'],
      ['View Logs', 'onLogs'],
      ['Open Shell', 'onExec'],
      ['Forward Port', 'onForward'],
      ['Delete Resource', 'onDelete'],
    ];
    for (const [title, handler] of titles) {
      fireEvent.click(screen.getByTitle(title));
      expect(handlers[handler]).toHaveBeenCalledTimes(1);
    }
    expect(
      screen.getByRole('button', { name: 'Plugin action' })
    ).toBeInTheDocument();
  });

  it('hides flagged actions whose flag is off or handler is missing', () => {
    render(
      inRow(
        <NameCell
          name="web-1"
          actions={{
            onRestart: vi.fn(),
            onScale: vi.fn(),
            onLogs: vi.fn(),
            onExec: vi.fn(),
            onForward: vi.fn(),
            showRestart: false,
            showScale: false,
            showLogs: false,
            showExec: false,
            showForward: false,
          }}
        />
      )
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides flagged actions without a handler even when the flag is on', () => {
    render(
      inRow(
        <NameCell
          name="web-1"
          actions={{
            showRestart: true,
            showScale: true,
            showLogs: true,
            showExec: true,
            showForward: true,
          }}
        />
      )
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});

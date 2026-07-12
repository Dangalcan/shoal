import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { load, loadAll } from 'js-yaml';
import { ExampleTemplatesModal } from '../../../features/manifests/ExampleTemplatesModal';
import { EXAMPLE_TEMPLATES } from '../../../features/manifests/example-templates';

describe('example-templates', () => {
  it('exposes a non-empty catalog with unique ids', () => {
    expect(EXAMPLE_TEMPLATES.length).toBeGreaterThan(0);
    const ids = EXAMPLE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(EXAMPLE_TEMPLATES.map((t) => [t.id, t] as const))(
    'template %s is valid Kubernetes YAML',
    (_id, template) => {
      const docs = loadAll(template.content) as Array<Record<string, unknown>>;
      expect(docs.length).toBeGreaterThan(0);
      for (const doc of docs) {
        expect(doc).toHaveProperty('apiVersion');
        expect(doc).toHaveProperty('kind');
        expect(doc).toHaveProperty('metadata');
      }
    }
  );

  it('every template has a name and description', () => {
    for (const template of EXAMPLE_TEMPLATES) {
      expect(template.name.trim()).not.toBe('');
      expect(template.description.trim()).not.toBe('');
    }
  });
});

describe('ExampleTemplatesModal', () => {
  it('renders every template in the catalog', () => {
    render(<ExampleTemplatesModal onClose={vi.fn()} onSelect={vi.fn()} />);

    for (const template of EXAMPLE_TEMPLATES) {
      expect(screen.getByText(template.name)).toBeInTheDocument();
    }
  });

  it('selecting a template calls onSelect with it and closes', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(<ExampleTemplatesModal onClose={onClose} onSelect={onSelect} />);

    const deployment = EXAMPLE_TEMPLATES.find((t) => t.id === 'deployment');
    fireEvent.click(screen.getByText('Deployment'));

    expect(onSelect).toHaveBeenCalledWith(deployment);
    expect(onClose).toHaveBeenCalled();
  });

  it('selected deployment template parses to a Deployment kind', () => {
    const deployment = EXAMPLE_TEMPLATES.find((t) => t.id === 'deployment');
    const doc = load(deployment!.content) as { kind: string };
    expect(doc.kind).toBe('Deployment');
  });

  it('cancel button closes without selecting', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(<ExampleTemplatesModal onClose={onClose} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

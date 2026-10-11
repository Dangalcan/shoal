import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PluginConfigurationForm } from '../../../components/plugins/PluginConfigurationForm';
import type {
  PluginConfigProperty,
  PluginConfigurationSchema,
} from '../../../../electron/types/plugin-types';

const schema: PluginConfigurationSchema = {
  title: 'Connection',
  properties: {
    url: {
      type: 'string',
      label: 'URL',
      required: true,
      placeholder: 'url',
      description: 'Where to send events',
      validation: { pattern: '^https://', message: 'Use an https URL' },
    },
    token: {
      type: 'string',
      label: 'Token',
      secret: true,
      placeholder: 'token',
    },
    notes: {
      type: 'string',
      label: 'Notes',
      multiline: true,
      placeholder: 'notes',
    },
    name: {
      type: 'string',
      label: 'Name',
      placeholder: 'name',
      validation: { pattern: '^[a-z]+$' },
    },
    retries: {
      type: 'number',
      label: 'Retries',
      min: 1,
      max: 5,
      placeholder: 'retries',
    },
    verbose: { type: 'boolean', label: 'Verbose logging' },
    level: {
      type: 'select',
      label: 'Level',
      enum: ['info', 'debug'],
      default: 'info',
    },
    tags: { type: 'array', label: 'Tags', required: true },
  },
};

function renderForm(initialValues: Record<string, unknown> = { tags: [] }) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(
    <PluginConfigurationForm
      schema={schema}
      initialValues={initialValues}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
  return { onSave, onCancel };
}

const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

describe('PluginConfigurationForm', () => {
  it('renders one control per field type', () => {
    renderForm();

    expect(screen.getByText('Connection')).toBeInTheDocument();
    expect(screen.getByText('Where to send events')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('token')).toHaveAttribute(
      'type',
      'password'
    );
    expect(screen.getByPlaceholderText('notes').tagName).toBe('TEXTAREA');
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Verbose logging' })
    ).not.toBeChecked();
    expect(screen.getByRole('combobox')).toHaveValue('info');
  });

  it('reports required fields and empty required lists', () => {
    const { onSave } = renderForm();
    save();

    expect(screen.getByText('URL is required')).toBeInTheDocument();
    expect(
      screen.getByText('Tags must have at least one item')
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('validates patterns, with the custom or the default message', () => {
    renderForm({ url: 'http://plain', name: 'Bad Name', tags: ['a'] });
    save();

    expect(screen.getByText('Use an https URL')).toBeInTheDocument();
    expect(screen.getByText('Name format is invalid')).toBeInTheDocument();
  });

  it.each([
    ['', 'Retries must be a number'],
    ['0', 'Retries must be at least 1'],
    ['9', 'Retries must be at most 5'],
  ])('validates the number %j', (input, message) => {
    renderForm({ url: 'https://ok', tags: ['a'] });
    const retries = screen.getByRole('spinbutton');
    fireEvent.change(retries, { target: { value: '3' } });
    fireEvent.change(retries, { target: { value: input } });
    // Submit the form directly: the browser's own min/max check would
    // otherwise block the click before the form's validation runs.
    fireEvent.submit(retries.closest('form') as HTMLFormElement);

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('clears a field error as soon as the field changes', () => {
    renderForm();
    save();
    expect(screen.getByText('URL is required')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('url'), {
      target: { value: 'https://x' },
    });
    expect(screen.queryByText('URL is required')).not.toBeInTheDocument();
  });

  it('edits every kind of field and saves the values', async () => {
    const { onSave } = renderForm({ tags: ['old'] });

    fireEvent.change(screen.getByPlaceholderText('url'), {
      target: { value: 'https://hooks' },
    });
    fireEvent.change(screen.getByPlaceholderText('token'), {
      target: { value: 's3cret' },
    });
    fireEvent.change(screen.getByPlaceholderText('notes'), {
      target: { value: 'line 1\nline 2' },
    });
    fireEvent.change(screen.getByPlaceholderText('name'), {
      target: { value: 'prod' },
    });
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Verbose logging' }));
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'debug' },
    });

    fireEvent.click(screen.getByRole('button', { name: '+ Add Item' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add Item' }));
    const items = screen.getAllByDisplayValue(/^(old|)$/);
    fireEvent.change(items[1], { target: { value: 'blue' } });
    // Remove the first ("old") and the empty last one.
    fireEvent.click(screen.getAllByRole('button', { name: '×' })[2]);
    fireEvent.click(screen.getAllByRole('button', { name: '×' })[0]);

    save();

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        url: 'https://hooks',
        token: 's3cret',
        notes: 'line 1\nline 2',
        name: 'prod',
        retries: 3,
        verbose: true,
        level: 'debug',
        tags: ['blue'],
      })
    );
  });

  it('shows a save error from the parent', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const onSave = vi.fn().mockRejectedValue(new Error('disk full'));
    render(
      <PluginConfigurationForm
        schema={{
          properties: {
            name: { type: 'string', label: 'Name', placeholder: 'name' },
          },
        }}
        initialValues={{}}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Plugin Settings')).toBeInTheDocument();
    save();

    expect(await screen.findByText('disk full')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeEnabled();
    consoleError.mockRestore();
  });

  it('cancels and flags unsupported field types', () => {
    const onCancel = vi.fn();
    const odd = {
      type: 'color',
      label: 'Colour',
    } as unknown as PluginConfigProperty;
    render(
      <PluginConfigurationForm
        schema={{ properties: { colour: odd } }}
        initialValues={{}}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    );

    expect(
      screen.getByText('Unsupported field type: color')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});


import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '../../test-utils'
import { ResourceRow } from '../../../components/resource-tables/ResourceRows'
import { mockPods } from '../../fixtures/k8s-resources'

// Mock NameCell to simplify testing and avoid deep rendering issues
vi.mock('../../../components/resource-tables/ResourceCells', () => ({
    NameCell: ({ name, actions }: any) => (
        <td>
            {name}
            <button onClick={actions.onDelete}>Delete</button>
            <button onClick={actions.onDescribe}>Describe</button>
        </td>
    )
}))

// Mock renderCell
vi.mock('../../../components/resource-tables/cell-renderers/cell-renderers/renderCell', () => ({
    renderCell: ({ colId }: any) => <td key={colId}>{colId}-content</td>
}))
vi.mock('../../../components/resource-tables/cell-renderers/renderCell', () => ({
    renderCell: ({ colId }: any) => <td key={colId}>{colId}-content</td>
}))

describe('ResourceRow', () => {
    const mockPod = mockPods[0]
    const defaultProps = {
        item: mockPod,
        activeTab: 'pods' as const,
        visibleColumns: ['name', 'status', 'age'],
        getColumnWidth: () => 100,
        onDescribe: vi.fn(),
        onYaml: vi.fn(),
        onRestart: vi.fn(),
        onLogs: vi.fn(),
        onDelete: vi.fn()
    }

    it('should render row with name cell', () => {
        render(
            <table>
                <tbody>
                    <ResourceRow {...defaultProps} />
                </tbody>
            </table>
        )
        expect(screen.getByText(mockPod.metadata.name)).toBeInTheDocument()
    })

    it('should call actions correctly', () => {
        render(
            <table>
                <tbody>
                    <ResourceRow {...defaultProps} />
                </tbody>
            </table>
        )
        
        fireEvent.click(screen.getByText('Delete'))
        expect(defaultProps.onDelete).toHaveBeenCalledWith(mockPod)

        fireEvent.click(screen.getByText('Describe'))
        expect(defaultProps.onDescribe).toHaveBeenCalledWith(mockPod)
    })
})

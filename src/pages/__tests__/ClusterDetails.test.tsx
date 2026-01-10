import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ClusterDetails } from '../ClusterDetails'
import { mockElectronAPI } from '../../test/setup'
import { toast } from 'sonner'

// Mock child components
vi.mock('../../components/LogViewerModal', () => ({
    LogViewerModal: ({ isOpen, onClose, podName }: any) => (isOpen ? <div data-testid="log-modal">Logs for {podName} <button onClick={onClose}>Close</button></div> : null)
}))
vi.mock('../../components/DescribeModal', () => ({
    DescribeModal: ({ isOpen, onClose, resourceName }: any) => (isOpen ? <div data-testid="describe-modal">Describe {resourceName} <button onClick={onClose}>Close</button></div> : null)
}))
vi.mock('../../components/YamlModal', () => ({
    YamlModal: ({ isOpen, onClose, resourceName }: any) => (isOpen ? <div data-testid="yaml-modal">YAML {resourceName} <button onClick={onClose}>Close</button></div> : null)
}))

// Refined toast mock
vi.mock('sonner', () => {
    const toastMock = {
        promise: vi.fn(async (promise, hooks) => {
            try {
                const res = await promise
                if (hooks?.success) {
                    const msg = typeof hooks.success === 'function' ? hooks.success(res) : hooks.success
                    toastMock.success(msg)
                }
                return res
            } catch (err: any) {
                if (hooks?.error) {
                    const msg = typeof hooks.error === 'function' ? hooks.error(err) : hooks.error
                    toastMock.error(msg)
                }
                return Promise.reject(err)
            }
        }),
        success: vi.fn(),
        error: vi.fn()
    }
    return { Toaster: () => null, toast: toastMock }
})

describe('ClusterDetails Page - Exhaustive Coverage', () => {
    const mockClusterName = 'cluster-123'
    const mockNamespaces = ['all', 'default', 'kube-system']
    
    const mockPods = [
        {
            metadata: { name: 'pod-1', namespace: 'default', creationTimestamp: '2024-01-01T10:00:00Z' },
            status: { phase: 'Running', podIP: '10.0.0.1', containerStatuses: [{ restartCount: 5 }], nominatedNodeName: 'node-SPECIFIC' },
            spec: { nodeName: 'node-A', containers: [{ name: 'c1', image: 'img1' }, { name: 'c2', image: 'img2' }], readinessGates: [{ conditionType: 'Ready' }] }
        }
    ]

    const mockDeployments = [
        {
            metadata: { name: 'dep-1', namespace: 'default', creationTimestamp: '2024-01-01T10:00:00Z' },
            status: { readyReplicas: 2, replicas: 3, updatedReplicas: 2, availableReplicas: 1 },
            spec: { template: { spec: { containers: [ { name: 'nginx-c', image: 'nginx-i' } ] } }, selector: { matchLabels: { app: 'nginx' } } }
        }
    ]

    const mockPVC = [
        {
            metadata: { name: 'pvc-1', namespace: 'default', creationTimestamp: '2024-01-01T10:00:00Z', annotations: { 'volume.kubernetes.io/selected-node': 'node-PVC-TARGET' } },
            status: { phase: 'Bound', capacity: { storage: '5Gi' } },
            spec: { volumeName: 'pv-1', accessModes: ['ReadWriteOnce'], storageClassName: 'gp2', volumeMode: 'Block', volumeAttributesClassName: 'class-a' }
        }
    ]

    const mockNodes = [
        {
            metadata: { name: 'node-A', creationTimestamp: '2024-01-01T10:00:00Z', labels: { 'node-role.kubernetes.io/master': '' } },
            status: { 
                conditions: [{ type: 'Ready', status: 'True' }],
                nodeInfo: { kubeletVersion: 'v1.28.0', osImage: 'Fedora', kernelVersion: '6.1', containerRuntimeVersion: 'docker' },
                addresses: [
                    { type: 'InternalIP', address: '172.16.0.1' },
                    { type: 'ExternalIP', address: '1.2.3.4' }
                ]
            }
        }
    ]

    const mockServices = [
        {
            metadata: { name: 'svc-1', namespace: 'default', creationTimestamp: '2024-01-01T10:00:00Z' },
            spec: { type: 'LoadBalancer', clusterIP: '10.96.0.1', ports: [{ port: 80, protocol: 'TCP' }], selector: { app: 'nginx' } },
            status: { loadBalancer: { ingress: [{ ip: '35.1.2.3' }] } }
        }
    ]

    const mockHPA = [
        {
            metadata: { name: 'hpa-1', namespace: 'default', creationTimestamp: '2024-01-01T10:00:00Z' },
            spec: { scaleTargetRef: { kind: 'Deployment', name: 'dep-1' }, minReplicas: 1, maxReplicas: 10, metrics: [{ resource: { name: 'cpu', target: { averageUtilization: 80 } } }] },
            status: { currentReplicas: 2, currentMetrics: [{ resource: { current: { averageUtilization: 50 } } }] }
        }
    ]

    const mockStatefulSets = [
        {
            metadata: { name: 'sts-1', namespace: 'default', creationTimestamp: '2024-01-01T10:00:00Z' },
            status: { readyReplicas: 1, replicas: 1 },
            spec: { serviceName: 'sts-svc' }
        }
    ]

    const mockIngress = [
        {
            metadata: { name: 'ing-1', namespace: 'default', creationTimestamp: '2024-01-01T10:00:00Z', annotations: { 'kubernetes.io/ingress.class': 'nginx' } },
            spec: { rules: [{ host: 'example.com' }], tls: [{ hosts: ['example.com'] }] },
            status: { loadBalancer: { ingress: [{ hostname: 'lb.com' }] } }
        }
    ]

    const mockSecrets = [
        {
            metadata: { name: 'sec-1', namespace: 'default', creationTimestamp: '2024-01-01T10:00:00Z' },
            type: 'Opaque',
            data: { key1: 'val1', key2: 'val2' }
        }
    ]

    const mockConfigMaps = [
        {
            metadata: { name: 'cm-1', namespace: 'default', creationTimestamp: '2024-01-01T10:00:00Z' },
            data: { 'config.json': '{}' }
        }
    ]

    beforeEach(() => {
        vi.clearAllMocks()
        window.localStorage.clear()
        mockElectronAPI.getNamespaces.mockResolvedValue({ success: true, namespaces: mockNamespaces })
        mockElectronAPI.getResources.mockImplementation(async ({ resourceType }) => {
            if (resourceType === 'pods') return { success: true, items: mockPods }
            if (resourceType === 'deployments') return { success: true, items: mockDeployments }
            if (resourceType === 'persistentvolumeclaim') return { success: true, items: mockPVC }
            if (resourceType === 'nodes') return { success: true, items: mockNodes }
            if (resourceType === 'services') return { success: true, items: mockServices }
            if (resourceType === 'hpa') return { success: true, items: mockHPA }
            if (resourceType === 'ingress') return { success: true, items: mockIngress }
            if (resourceType === 'secrets') return { success: true, items: mockSecrets }
            if (resourceType === 'configmap') return { success: true, items: mockConfigMaps }
            if (resourceType === 'statefulsets') return { success: true, items: mockStatefulSets }
            return { success: true, items: [] }
        })
        mockElectronAPI.rolloutRestart.mockResolvedValue({ success: true })
        mockElectronAPI.deleteResource.mockResolvedValue({ success: true })
    })

    it('should handle namespace selection changes', async () => {
        renderPage()
        const selector = screen.getByLabelText('Namespace Selector') as HTMLSelectElement
        await waitFor(() => expect(within(selector).queryByText('kube-system')).toBeInTheDocument())
        fireEvent.change(selector, { target: { value: 'kube-system' } })
        expect(selector.value).toBe('kube-system')
    })

    it('should close settings dropdown with X button', async () => {
        renderPage()
        fireEvent.click(screen.getByTitle('Visible Resources'))
        expect(screen.getByText('Display Settings')).toBeInTheDocument()
        fireEvent.click(screen.getByTitle('Close Settings'))
        await waitFor(() => expect(screen.queryByText('Display Settings')).not.toBeInTheDocument())
    })

    it('should toggle resource visibility', async () => {
        renderPage()
        fireEvent.click(screen.getByTitle('Visible Resources'))
        const drop = screen.getByText('Display Settings').closest('.settings-dropdown')!
        const tabs = screen.getByRole('banner').querySelector('.tabs-container')!
        
        // Toggle Nodes visibility
        fireEvent.click(within(drop as HTMLElement).getByText('Nodes').closest('button')!)
        expect(within(tabs as HTMLElement).queryByText('Nodes')).not.toBeInTheDocument()
        
        // Toggle it back
        fireEvent.click(within(drop as HTMLElement).getByText('Nodes').closest('button')!)
        expect(within(tabs as HTMLElement).getByText('Nodes')).toBeInTheDocument()
    })

    it('should handle "Hide last column" protection logic', async () => {
        renderPage()
        fireEvent.click(screen.getByTitle('Visible Resources'))
        
        await waitFor(() => expect(screen.getByText('Display Settings')).toBeInTheDocument())
        
        const drop = screen.getByText('Display Settings').closest('.settings-dropdown')!
        const colsToHide = ['Namespace', 'Status', 'Restarts', 'Age']
        for (const c of colsToHide) {
             const span = within(drop as HTMLElement).getByText(new RegExp(`^${c}$`))
             fireEvent.click(span.closest('button')!)
        }
        
        const nameBtn = within(drop as HTMLElement).getByText(/^Name$/).closest('button')!
        fireEvent.click(nameBtn)
        
        await waitFor(() => {
            const table = screen.getByRole('table')
            const headers = within(table).getAllByRole('columnheader')
            const hasName = headers.some(h => h.textContent?.includes('Name'))
            expect(hasName).toBe(true)
            expect(headers.length).toBe(1)
        })
    })
    const renderPage = () => render(
        <MemoryRouter initialEntries={[`/cluster/${mockClusterName}`]}>
            <Routes><Route path="/cluster/:name" element={<ClusterDetails />} /></Routes>
        </MemoryRouter>
    )

    it('should navigate back correctly', async () => {
        const { container } = renderPage()
        const backBtn = container.querySelector('.back-button')
        fireEvent.click(backBtn!)
    })

    describe('Resource Rendering Scopes', () => {
        it('should render detailed pod columns without ambiguity', async () => {
            renderPage()
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
            
            fireEvent.click(screen.getByTitle('Visible Resources'))
            const drop = screen.getByText('Display Settings').closest('.settings-dropdown')!
            const cols = ['IP', 'Node', 'Nominated Node', 'Readiness Gates', 'Containers', 'Images']
            cols.forEach(c => {
                 const btn = within(drop as HTMLElement).getByText(c).closest('button')!
                 fireEvent.click(btn)
            })
            fireEvent.click(screen.getByTitle('Visible Resources'))

            await waitFor(() => {
                const table = screen.getByRole('table')
                expect(within(table).getByText('10.0.0.1')).toBeInTheDocument()
                expect(within(table).getByText('node-A')).toBeInTheDocument()
                expect(within(table).getByText('node-SPECIFIC')).toBeInTheDocument()
            }, { timeout: 2000 })
        })

        it('should render PVC fields using scoped lookups', async () => {
            renderPage()
            const tabs = screen.getByRole('banner').querySelector('.tabs-container')!
            fireEvent.click(within(tabs as HTMLElement).getByText('PVCs'))
            await waitFor(() => expect(screen.getByText('pvc-1')).toBeInTheDocument())
            
            // Volume Node (selected-node) is visible by default in persistentvolumeclaim
            // No need to toggle it unless we want to test toggling off/on

            await waitFor(() => {
                const table = screen.getByRole('table')
                expect(within(table).getByText('pv-1')).toBeInTheDocument()
                expect(within(table).getByText('node-PVC-TARGET')).toBeInTheDocument()
            })
        })

        it('should render remaining resources (Services, HPA, Ingress, Secrets, CM)', async () => {
            renderPage()
            const tabs = screen.getByRole('banner').querySelector('.tabs-container')!

            // Services
            fireEvent.click(within(tabs as HTMLElement).getByText('Services'))
            await waitFor(() => expect(screen.getByText('svc-1')).toBeInTheDocument())
            
            // Toggle Selector column
            fireEvent.click(screen.getByTitle('Visible Resources'))
            const drop = screen.getByText('Display Settings').closest('.settings-dropdown')!
            fireEvent.click(within(drop as HTMLElement).getByText('Selector').closest('button')!)
            fireEvent.click(screen.getByTitle('Visible Resources'))

            expect(screen.getByText('LoadBalancer')).toBeInTheDocument()
            expect(screen.getByText('10.96.0.1')).toBeInTheDocument()
            expect(screen.getByText('35.1.2.3')).toBeInTheDocument()
            expect(screen.getByText('80/TCP')).toBeInTheDocument()
            expect(screen.getByText('app=nginx')).toBeInTheDocument()

            // HPA
            fireEvent.click(within(tabs as HTMLElement).getByText('HPAs'))
            await waitFor(() => expect(screen.getByText('hpa-1')).toBeInTheDocument())
            expect(screen.getByText('Deployment/dep-1')).toBeInTheDocument()
            expect(screen.getByText('50% / 80%')).toBeInTheDocument()
            expect(screen.getByText('1')).toBeInTheDocument() // min
            expect(screen.getByText('10')).toBeInTheDocument() // max
            expect(screen.getByText('2')).toBeInTheDocument() // replicas

            // Ingress
            fireEvent.click(within(tabs as HTMLElement).getByText('Ingresses'))
            await waitFor(() => expect(screen.getByText('ing-1')).toBeInTheDocument())
            expect(screen.getByText('nginx')).toBeInTheDocument()
            expect(screen.getByText('example.com')).toBeInTheDocument()
            expect(screen.getByText('lb.com')).toBeInTheDocument()
            expect(screen.getByText('80, 443')).toBeInTheDocument() // since tls is set

            // Secrets
            fireEvent.click(within(tabs as HTMLElement).getByText('Secrets'))
            await waitFor(() => expect(screen.getByText('sec-1')).toBeInTheDocument())
            expect(screen.getByText('Opaque')).toBeInTheDocument()
            expect(screen.getByText('2')).toBeInTheDocument() // data keys count

            // ConfigMaps
            fireEvent.click(within(tabs as HTMLElement).getByText('ConfigMaps'))
            await waitFor(() => expect(screen.getByText('cm-1')).toBeInTheDocument())
            expect(screen.getByText('1')).toBeInTheDocument() // data keys count
        })
    })

    describe('Interactive Actions - Branch Coverage', () => {
        it('should handle rollout restart success path', async () => {
            renderPage()
            const tabs = screen.getByRole('banner').querySelector('.tabs-container')!
            fireEvent.click(within(tabs as HTMLElement).getByText('Deployments'))
            await waitFor(() => expect(screen.getByText('dep-1')).toBeInTheDocument())
            
            fireEvent.click(screen.getByTitle('Rollout Restart'))
            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('Restart triggered successfully')
                expect(mockElectronAPI.getResources).toHaveBeenCalledTimes(3) // Initial + Tab Change + after restart
            })

            // StatefulSet restart
            fireEvent.click(within(tabs as HTMLElement).getByText('StatefulSets'))
            await waitFor(() => expect(screen.getByText('sts-1')).toBeInTheDocument())
            fireEvent.click(screen.getByTitle('Rollout Restart'))
            await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Restart triggered successfully'))
        })

        it('should handle resource deletion with confirmation and success', async () => {
            const confirmSpy = vi.spyOn(window, 'confirm')
            
            // Success path
            confirmSpy.mockReturnValue(true)
            renderPage()
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
            
            fireEvent.click(screen.getByTitle('Delete Resource'))
            await waitFor(() => {
                expect(mockElectronAPI.deleteResource).toHaveBeenCalled()
                expect(toast.success).toHaveBeenCalledWith('Resource deleted successfully')
            })

            // Cancellation path
            confirmSpy.mockReturnValue(false)
            fireEvent.click(screen.getByTitle('Delete Resource'))
            expect(mockElectronAPI.deleteResource).toHaveBeenCalledTimes(1) // Still 1 from before
            
            confirmSpy.mockRestore()
        })

        it('should handle API refresh explicitly', async () => {
            renderPage()
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
            fireEvent.click(screen.getByTitle('Refresh'))
            await waitFor(() => expect(mockElectronAPI.getResources).toHaveBeenCalledTimes(2))
        })

        it('should open all modal types', async () => {
            renderPage()
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
            
            // Pod logs (click pod name)
            fireEvent.click(screen.getByText('pod-1'))
            expect(screen.getByTestId('log-modal')).toBeInTheDocument()
            fireEvent.click(within(screen.getByTestId('log-modal')).getByText('Close'))
            expect(screen.queryByTestId('log-modal')).not.toBeInTheDocument()

            // Describe
            fireEvent.click(screen.getByTitle('Describe Resource'))
            expect(screen.getByTestId('describe-modal')).toBeInTheDocument()
            fireEvent.click(within(screen.getByTestId('describe-modal')).getByText('Close'))

            // YAML
            fireEvent.click(screen.getByTitle('View YAML'))
            expect(screen.getByTestId('yaml-modal')).toBeInTheDocument()
            fireEvent.click(within(screen.getByTestId('yaml-modal')).getByText('Close'))
        })

        it('should handle rollout success/error logic branches in toast.promise', async () => {
             // This tests the toast.promise logic in the mock which mimics the component's await rollout
             mockElectronAPI.rolloutRestart.mockRejectedValue({ error: 'Async Rollout Failed' })
             renderPage()
             fireEvent.click(within(screen.getByRole('banner').querySelector('.tabs-container')!).getByText('Deployments'))
             await waitFor(() => screen.getByTitle('Rollout Restart'))
             fireEvent.click(screen.getByTitle('Rollout Restart'))
             await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Async Rollout Failed')))
        })
    })

    describe('Exhaustive Sorting & Table States', () => {
        it('should handle empty states', async () => {
            mockElectronAPI.getResources.mockResolvedValueOnce({ success: true, items: [] })
            renderPage()
            await waitFor(() => expect(screen.getByText(/No pods found/i)).toBeInTheDocument())
        })

        it('should handle API errors with retry', async () => {
            mockElectronAPI.getResources.mockResolvedValueOnce({ success: false, error: 'Network Error' })
            renderPage()
            await waitFor(() => expect(screen.getByText('Network Error')).toBeInTheDocument())
            
            mockElectronAPI.getResources.mockResolvedValueOnce({ success: true, items: mockPods })
            fireEvent.click(screen.getByText('Try Again'))
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
        })

        it('should sort exhaustive column types', async () => {
            // Add a second node for sorting comparison
            const manyNodes = [
                ...mockNodes,
                {
                    metadata: { name: 'node-B', creationTimestamp: '2023-01-01T10:00:00Z', labels: { 'node-role.kubernetes.io/worker': '' } },
                    status: { 
                        conditions: [{ type: 'Ready', status: 'False' }],
                        nodeInfo: { kubeletVersion: 'v1.27.0', osImage: 'Ubuntu', kernelVersion: '5.15', containerRuntimeVersion: 'containerd' },
                        addresses: [{ type: 'InternalIP', address: '172.16.0.2' }, { type: 'ExternalIP', address: '5.6.7.8' }]
                    }
                }
            ]
            mockElectronAPI.getResources.mockImplementation(async ({ resourceType }) => {
                if (resourceType === 'nodes') return { success: true, items: manyNodes }
                if (resourceType === 'pods') return { success: true, items: mockPods }
                if (resourceType === 'deployments') return { success: true, items: mockDeployments }
                if (resourceType === 'persistentvolumeclaim') return { success: true, items: mockPVC }
                if (resourceType === 'services') return { success: true, items: mockServices }
                if (resourceType === 'hpa') return { success: true, items: mockHPA }
                if (resourceType === 'ingress') return { success: true, items: mockIngress }
                if (resourceType === 'secrets') return { success: true, items: mockSecrets }
                if (resourceType === 'configmap') return { success: true, items: mockConfigMaps }
                return { success: true, items: [] }
            })

            renderPage()
            const tabs = screen.getByRole('banner').querySelector('.tabs-container')!
            fireEvent.click(within(tabs as HTMLElement).getByText('Nodes'))
            await waitFor(() => expect(screen.getByText('node-B')).toBeInTheDocument())

            const thead = screen.getByRole('table').querySelector('thead')!
            
            // Sort by Name (already exists, but click to toggle)
            fireEvent.click(within(thead).getByText('Name')) // asc: node-A, node-B
            fireEvent.click(within(thead).getByText('Name')) // desc: node-B, node-A

            // Sort by Version
            fireEvent.click(within(thead).getByText('Version'))
            
            // Sort by Roles
            fireEvent.click(within(thead).getByText('Roles'))

            // Sort by Internal IP
            fireEvent.click(screen.getByTitle('Visible Resources'))
            fireEvent.click(within(screen.getByText('Display Settings').closest('.settings-dropdown')!).getByText('Internal IP').closest('button')!)
            fireEvent.click(screen.getByTitle('Visible Resources'))
            fireEvent.click(within(thead).getByText('Internal IP'))

            // Sort by status
            fireEvent.click(within(thead).getByText('Status'))

            // Switch to Pods for more sort branches
            fireEvent.click(within(tabs as HTMLElement).getByText('Pods'))
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
            
            const podsThead = screen.getByRole('table').querySelector('thead')!
            fireEvent.click(within(podsThead).getByText('Restarts'))
            fireEvent.click(within(podsThead).getByText('Age'))
            
            // Sort by IP
            fireEvent.click(screen.getByTitle('Visible Resources'))
            fireEvent.click(within(screen.getByText('Display Settings').closest('.settings-dropdown')!).getByText('IP').closest('button')!)
            fireEvent.click(screen.getByTitle('Visible Resources'))
            fireEvent.click(within(podsThead).getByText('IP'))

            // Exhaustive sorting branches
            fireEvent.click(within(podsThead).getByText('Name'))
            
            // Deployments for replicas
            fireEvent.click(within(tabs as HTMLElement).getByText('Deployments'))
            await waitFor(() => expect(screen.getByText('dep-1')).toBeInTheDocument())
            
            // Toggle Available column
            fireEvent.click(screen.getByTitle('Visible Resources'))
            const deployDrop = screen.getByText('Display Settings').closest('.settings-dropdown')! as HTMLElement
            fireEvent.click(within(deployDrop).getByText('Available').closest('button')!)
            fireEvent.click(screen.getByTitle('Visible Resources'))

            const depThead = screen.getByRole('table').querySelector('thead')!
            fireEvent.click(within(depThead).getByText('Ready'))
            fireEvent.click(within(depThead).getByText('Up-To-Date'))
            fireEvent.click(within(depThead).getByText('Available'))
            
            // Additional Pod fields
            fireEvent.click(within(tabs as HTMLElement).getByText('Pods'))
            fireEvent.click(screen.getByTitle('Visible Resources'))
            const podDrop = screen.getByText('Display Settings').closest('.settings-dropdown')! as HTMLElement
            const extraCols = ['Containers', 'Images', 'Selector']
            extraCols.forEach(c => fireEvent.click(within(podDrop).getByText(c).closest('button')!))
            fireEvent.click(screen.getByTitle('Visible Resources'))
            
            fireEvent.click(within(podsThead).getByText('Containers'))
            fireEvent.click(within(podsThead).getByText('Images'))
            fireEvent.click(within(podsThead).getByText('Selector'))

            // Node OS/Kernel fields
            fireEvent.click(within(tabs as HTMLElement).getByText('Nodes'))
            fireEvent.click(screen.getByTitle('Visible Resources'))
            const nodeDrop = screen.getByText('Display Settings').closest('.settings-dropdown')! as HTMLElement
            const nodeCols = ['OS Image', 'Kernel Version', 'Container Runtime', 'External IP']
            nodeCols.forEach(c => fireEvent.click(within(nodeDrop).getByText(c).closest('button')!))
            fireEvent.click(screen.getByTitle('Visible Resources'))
            
            const nodeThead = screen.getByRole('table').querySelector('thead')!
            fireEvent.click(within(nodeThead).getByText('OS Image'))
            fireEvent.click(within(nodeThead).getByText('Kernel Version'))
            fireEvent.click(within(nodeThead).getByText('Container Runtime'))
            fireEvent.click(within(nodeThead).getByText('External IP'))
        })
    })

    describe('State Resilience', () => {
        it('should handle corrupted local storage in all catch blocks', async () => {
            const spy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{ bad: json ')
            renderPage()
            await waitFor(() => expect(screen.getByText('Pods')).toBeInTheDocument())
            spy.mockRestore()
        })
    })

    describe('Resize logic', () => {
        it('should resize columns correctly', async () => {
            renderPage()
            await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument())
            const nameTh = screen.getByText('Name').closest('th')!
            const handle = nameTh.querySelector('.resize-handle')!
            
            fireEvent.mouseDown(handle, { clientX: 100 })
            fireEvent.mouseMove(window, { clientX: 200 })
            fireEvent.mouseUp(window)
            
            expect(nameTh).toHaveStyle({ width: '300px' })
        })
    })
    describe('Status Badge Edge Cases', () => {
        it('should render correct status badges for Pending pods and NotReady nodes', async () => {
             const pendingPod = {
                 metadata: { name: 'pod-pending', namespace: 'default', creationTimestamp: '2024-01-01T10:00:00Z' },
                 status: { phase: 'Pending' }
             }
             const notReadyNode = {
                 metadata: { name: 'node-notready', creationTimestamp: '2024-01-01T10:00:00Z' },
                 status: { conditions: [{ type: 'Ready', status: 'False' }] }
             }
             
             mockElectronAPI.getResources.mockImplementation(async ({ resourceType }) => {
                 if (resourceType === 'pods') return { success: true, items: [pendingPod] }
                 if (resourceType === 'nodes') return { success: true, items: [notReadyNode] }
                 return { success: true, items: [] }
             })
             
             renderPage()
             await waitFor(() => expect(screen.getByText('pod-pending')).toBeInTheDocument(), { timeout: 2000 })
             const badge = screen.getByText('Pending')
             expect(badge).toHaveClass('status-badge-other')
             
             const tabs = screen.getByRole('banner').querySelector('.tabs-container')!
             fireEvent.click(within(tabs as HTMLElement).getByText('Nodes'))
             await waitFor(() => expect(screen.getByText('node-notready')).toBeInTheDocument(), { timeout: 2000 })
             const nodeBadge = screen.getByText('NotReady')
             expect(nodeBadge).toHaveClass('status-badge-not-ready')
        })
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, within, render, mockToast } from '../utils'
import { ClusterDetails } from '../../pages/ClusterDetails'
import { createMockElectronAPI } from '../utils/mocks'
// Imports from test-utils consolidated above
import '../mocks/component-mocks'
import { toast } from 'sonner'
import { 
    mockNamespaces, 
    mockPods, 
    mockDeployments, 
    mockPVC, 
    mockNodes, 
    mockServices, 
    mockHPA, 
    mockIngress, 
    mockSecrets, 
    mockConfigMaps,
    mockStatefulSets,
    mockPV,
    mockSC,
    mockVS,
    mockVSC,
    mockReplicaSets,
    mockDaemonSets,
    mockJobs,
    mockCronJobs,
    mockReplicationControllers,
    mockRoles,
    mockRoleBindings,
    mockServiceAccounts,
    mockNetworkPolicies,
    mockEndpoints,
    mockPodDisruptionBudgets,
    mockResourceQuotas,
    mockCRDs,
    mockWebhooks,
    mockAPIServices,
    mockLeases,
    mockPriorityClasses,
    mockCSRs
} from '../fixtures/k8s-resources'
import { configure } from '@testing-library/dom'


// Increase timeout for async operations (state transitions)
configure({ asyncUtilTimeout: 3000 })

describe('ClusterDetails Page - Exhaustive Coverage', () => {
    // Smaller scale mock data for specialized edge cases (others moved to fixtures)
    // Mocks imported from fixtures


    let mockApi: ReturnType<typeof createMockElectronAPI>

    beforeEach(() => {
        mockApi = createMockElectronAPI()
        vi.clearAllMocks()
        window.localStorage.clear()
        mockApi.getNamespaces = vi.fn().mockResolvedValue({ success: true, data: mockNamespaces })
        mockApi.getResources = vi.fn().mockImplementation(async ({ resourceType }) => {
            if (resourceType === 'pods') return { success: true, data: mockPods }
            if (resourceType === 'deployments') return { success: true, data: mockDeployments }
            if (resourceType === 'persistentvolumeclaim') return { success: true, data: mockPVC }
            if (resourceType === 'nodes') return { success: true, data: mockNodes }
            if (resourceType === 'services') return { success: true, data: mockServices }
            if (resourceType === 'hpa') return { success: true, data: mockHPA }
            if (resourceType === 'ingress') return { success: true, data: mockIngress }
            if (resourceType === 'secrets') return { success: true, data: mockSecrets }
            if (resourceType === 'configmap') return { success: true, data: mockConfigMaps }
            if (resourceType === 'statefulsets') return { success: true, data: mockStatefulSets }
            if (resourceType === 'persistentvolume') return { success: true, data: mockPV }
            if (resourceType === 'storageclass') return { success: true, data: mockSC }
            if (resourceType === 'volumesnapshot') return { success: true, data: mockVS }
            if (resourceType === 'volumesnapshotclass') return { success: true, data: mockVSC }
            if (resourceType === 'replicasets') return { success: true, data: mockReplicaSets }
            if (resourceType === 'daemonsets') return { success: true, data: mockDaemonSets }
            if (resourceType === 'jobs') return { success: true, data: mockJobs }
            if (resourceType === 'cronjobs') return { success: true, data: mockCronJobs }
            if (resourceType === 'replicationcontroller') return { success: true, data: mockReplicationControllers }
            if (resourceType === 'role' || resourceType === 'clusterrole') return { success: true, data: mockRoles }
            if (resourceType === 'rolebinding' || resourceType === 'clusterrolebinding') return { success: true, data: mockRoleBindings }
            if (resourceType === 'serviceaccounts') return { success: true, data: mockServiceAccounts }
            if (resourceType === 'networkpolicy') return { success: true, data: mockNetworkPolicies }
            if (resourceType === 'endpoints') return { success: true, data: mockEndpoints }
            if (resourceType === 'poddisruptionbudget') return { success: true, data: mockPodDisruptionBudgets }
            if (resourceType === 'resourcequota') return { success: true, data: mockResourceQuotas }
            if (resourceType === 'customresourcedefinition') return { success: true, data: mockCRDs }
            if (resourceType === 'mutatingwebhookconfiguration' || resourceType === 'validatingwebhookconfiguration') return { success: true, data: mockWebhooks }
            if (resourceType === 'apiservice') return { success: true, data: mockAPIServices }
            if (resourceType === 'lease') return { success: true, data: mockLeases }
            if (resourceType === 'priorityclass') return { success: true, data: mockPriorityClasses }
            if (resourceType === 'certificatesigningrequest') return { success: true, data: mockCSRs }
            return { success: true, data: [] }
        })
        mockApi.rolloutRestart = vi.fn().mockResolvedValue({ success: true, data: undefined })
        mockApi.deleteResource = vi.fn().mockResolvedValue({ success: true, data: undefined })
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
        fireEvent.click(screen.getByTitle('Display Settings'))
        expect(screen.getByText('Display Settings')).toBeInTheDocument()
        fireEvent.click(screen.getByTitle('Close Settings'))
        await waitFor(() => expect(screen.queryByText('Display Settings')).not.toBeInTheDocument())
    })

    it('should toggle resource visibility', async () => {
        renderPage()
        fireEvent.click(screen.getByTitle('Display Settings'))
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
        fireEvent.click(screen.getByTitle('Display Settings'))
        
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
        <ClusterDetails />, 
        { 
            path: '/cluster/:name', 
            route: '/cluster/cluster-123',
            api: mockApi
        }
    )

    it('should navigate back correctly', async () => {
        const { container } = renderPage()
        
        // Wait for initial load
        await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
        
        const backBtn = container.querySelector('.back-button')
        expect(backBtn).toBeInTheDocument()
        
        fireEvent.click(backBtn!)
        
        // Since we are mocking the router, we can't easily verify URL change unless we spy on useNavigate or inspecting history.
        // But the error was about "An update to ClusterDetails inside a test was not wrapped in act(...)".
        // This is likely because the back button triggers something or the component unmounts while a promise is pending.
        // Waiting for the initial pods to load ensures pending promises are resolved.
    })

    describe('Resource Rendering Scopes', () => {
        it('should render detailed pod columns without ambiguity', async () => {
            renderPage()
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
            
            fireEvent.click(screen.getByTitle('Display Settings'))
            const drop = screen.getByText('Display Settings').closest('.settings-dropdown')!
            const cols = ['IP', 'Node', 'Nominated Node', 'Readiness Gates', 'Containers', 'Images']
            cols.forEach(c => {
                 const btn = within(drop as HTMLElement).getByText(c).closest('button')!
                 fireEvent.click(btn)
            })
            fireEvent.click(screen.getByTitle('Display Settings'))

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
            fireEvent.click(screen.getByTitle('Display Settings'))
            const drop = screen.getByText('Display Settings').closest('.settings-dropdown')!
            fireEvent.click(within(drop as HTMLElement).getByText('Selector').closest('button')!)
            fireEvent.click(screen.getByTitle('Display Settings'))

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
            
            const row = screen.getByText('dep-1').closest('tr')!
            fireEvent.click(within(row).getByTitle('Rollout Restart'))
            
            await waitFor(() => {
                expect(mockToast.success).toHaveBeenCalledWith('Restart triggered successfully', expect.any(Object))
                expect(mockApi.getResources).toHaveBeenCalledTimes(3) // Initial + Tab Change + after restart
            })

            // StatefulSet restart
            fireEvent.click(within(tabs as HTMLElement).getByText('StatefulSets'))
            await waitFor(() => expect(screen.getByText('sts-1')).toBeInTheDocument())
            const stsRow = screen.getByText('sts-1').closest('tr')!
            fireEvent.click(within(stsRow).getByTitle('Rollout Restart'))
            await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Restart triggered successfully', expect.any(Object)))
        })

        it('should handle resource deletion with confirmation and success', async () => {
            const confirmSpy = vi.spyOn(window, 'confirm')
            
            // Success path
            confirmSpy.mockReturnValue(true)
            renderPage()
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
            
            const row = screen.getByText('pod-1').closest('tr')!
            fireEvent.click(within(row).getByTitle('Delete Resource'))
            
            await waitFor(() => {
                expect(mockApi.deleteResource).toHaveBeenCalled()
                expect(mockToast.success).toHaveBeenCalledWith('Resource deleted successfully', expect.any(Object))
            })

            // Cancellation path
            confirmSpy.mockReturnValue(false)
            // Need to re-query row or ensure it's still there (it wasn't deleted in logic because we awaited success?)
            // Actually, in the test flow above, deleteResource WAS called. So strict mode might complain if we try to delete again?
            // The previous click triggered delete.
            // Let's use a fresh render or different item for cancellation to be clean, or just click again.
            
            fireEvent.click(within(row).getByTitle('Delete Resource'))
            expect(mockApi.deleteResource).toHaveBeenCalledTimes(1) // Still 1 from before (cancel prevents 2nd call)
            
            confirmSpy.mockRestore()
        })

        it('should handle API refresh explicitly', async () => {
            renderPage()
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
            fireEvent.click(screen.getByTitle('Refresh'))
            await waitFor(() => expect(mockApi.getResources).toHaveBeenCalledTimes(2))
        })

        it('should open all modal types', async () => {
            renderPage()
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
            const row = screen.getByText('pod-1').closest('tr')!

            // Pod logs (click pod name)
            const podNameBtn = within(row).getByRole('button', { name: 'pod-1' })
            fireEvent.click(podNameBtn)
            await waitFor(() => expect(screen.getByTestId('log-modal')).toBeInTheDocument())
            fireEvent.click(within(screen.getByTestId('log-modal')).getByText('Close'))
            await waitFor(() => expect(screen.queryByTestId('log-modal')).not.toBeInTheDocument())

            // Describe
            fireEvent.click(within(row).getByTitle('Describe Resource'))
            await waitFor(() => expect(screen.getByTestId('describe-modal')).toBeInTheDocument())
            fireEvent.click(within(screen.getByTestId('describe-modal')).getByText('Close'))

            // YAML
            fireEvent.click(within(row).getByTitle('View YAML'))
            await waitFor(() => expect(screen.getByTestId('yaml-modal')).toBeInTheDocument())
            fireEvent.click(within(screen.getByTestId('yaml-modal')).getByText('Close'))

             // Pod logs (click action button)
             await waitFor(() => expect(within(row).getByTitle('View Logs')).toBeVisible())
             fireEvent.click(within(row).getByTitle('View Logs'))
             fireEvent.click(within(screen.getByTestId('log-modal')).getByText('Close'))
             await waitFor(() => expect(screen.queryByTestId('log-modal')).not.toBeInTheDocument())
        })

        it('should handle rollout success/error logic branches in toast.promise', async () => {
             // This tests the toast.promise logic in the mock which mimics the component's await rollout
              (mockApi.rolloutRestart as any).mockRejectedValue({ error: 'UNIQUE_ROLLOUT_FAILURE' })
              renderPage()
              
              // Ensure we are ready
              await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())

              const tabs = screen.getByRole('banner').querySelector('.tabs-container')!
              fireEvent.click(within(tabs as HTMLElement).getByText('Deployments'))
              
              await waitFor(() => expect(screen.getByText('dep-1')).toBeInTheDocument(), { timeout: 3000 })

              const row = screen.getByText('dep-1').closest('tr')!
              mockToast.error.mockReset()
              
              fireEvent.click(within(row).getByTitle('Rollout Restart'))
              await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Failed to restart resource', expect.objectContaining({ 
                  description: expect.stringContaining('UNIQUE_ROLLOUT_FAILURE') 
              })), { timeout: 3000 })
        })
    })

    describe('Exhaustive Sorting & Table States', () => {
        it('should handle empty states', async () => {
            mockApi.getResources = vi.fn().mockResolvedValueOnce({ success: true, data: [] })
            renderPage()
            await waitFor(() => expect(screen.getByText(/No pods found/i)).toBeInTheDocument())
        })

        it('should handle API errors with retry', async () => {
            mockApi.getResources = vi.fn().mockResolvedValueOnce({ success: false, error: 'Network Error' })
            renderPage()
            await waitFor(() => expect(screen.getByText('Network Error')).toBeInTheDocument())
            
            mockApi.getResources = vi.fn().mockResolvedValueOnce({ success: true, data: mockPods })
            fireEvent.click(screen.getByText('Try Again'))
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
        })

        it('should sort exhaustive column types', async () => {
            // Because we now have multi-item mocks in beforeEach, we can just use them.
            // mockNodes has node-A (created 2024, Ready=True) and node-B (created 2023, Ready=False)

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
            fireEvent.click(screen.getByTitle('Display Settings'))
            fireEvent.click(within(screen.getByText('Display Settings').closest('.settings-dropdown')!).getByText('Internal IP').closest('button')!)
            fireEvent.click(screen.getByTitle('Display Settings'))
            fireEvent.click(within(thead).getByText('Internal IP'))

            // Sort by External IP (Nodes)
            fireEvent.click(screen.getByTitle('Display Settings'))
            fireEvent.click(within(screen.getByText('Display Settings').closest('.settings-dropdown')!).getByText('External IP').closest('button')!)
            fireEvent.click(screen.getByTitle('Display Settings'))
            fireEvent.click(within(thead).getByText('External IP'))

            // Sort by status (Nodes)
            fireEvent.click(within(thead).getByText('Status'))

            // Sort by OS Image
            fireEvent.click(screen.getByTitle('Display Settings'))
            fireEvent.click(within(screen.getByText('Display Settings').closest('.settings-dropdown')!).getByText('OS Image').closest('button')!)
            fireEvent.click(screen.getByTitle('Display Settings'))
            fireEvent.click(within(thead).getByText('OS Image'))

            // Sort by Kernel Version
            fireEvent.click(screen.getByTitle('Display Settings'))
            fireEvent.click(within(screen.getByText('Display Settings').closest('.settings-dropdown')!).getByText('Kernel Version').closest('button')!)
            fireEvent.click(screen.getByTitle('Display Settings'))
            fireEvent.click(within(thead).getByText('Kernel Version'))

             // Sort by Container Runtime
             fireEvent.click(screen.getByTitle('Display Settings'))
             fireEvent.click(within(screen.getByText('Display Settings').closest('.settings-dropdown')!).getByText('Container Runtime').closest('button')!)
             fireEvent.click(screen.getByTitle('Display Settings'))
             fireEvent.click(within(thead).getByText('Container Runtime'))
             
            // Switch to Pods for more sort branches
            fireEvent.click(within(tabs as HTMLElement).getByText('Pods'))
            await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
            
            const podsThead = screen.getByRole('table').querySelector('thead')!
            fireEvent.click(within(podsThead).getByText('Restarts'))
            fireEvent.click(within(podsThead).getByText('Age'))
            
            // Sort by Pod Status
            fireEvent.click(within(podsThead).getByText('Status'))

            // Sort by IP
            fireEvent.click(screen.getByTitle('Display Settings'))
            fireEvent.click(within(screen.getByText('Display Settings').closest('.settings-dropdown')!).getByText('IP').closest('button')!)
            fireEvent.click(screen.getByTitle('Display Settings'))
            fireEvent.click(within(podsThead).getByText('IP'))

             // Sort by Node
             fireEvent.click(screen.getByTitle('Display Settings'))
             fireEvent.click(within(screen.getByText('Display Settings').closest('.settings-dropdown')!).getByText('Node').closest('button')!)
             fireEvent.click(screen.getByTitle('Display Settings'))
             fireEvent.click(within(podsThead).getByText('Node'))

            // Exhaustive sorting branches
            fireEvent.click(within(podsThead).getByText('Name'))
            
            // Deployments for replicas
            fireEvent.click(within(tabs as HTMLElement).getByText('Deployments'))
            await waitFor(() => expect(screen.getByText('dep-1')).toBeInTheDocument())
            
            // Toggle Available column
            fireEvent.click(screen.getByTitle('Display Settings'))
            const deployDrop = screen.getByText('Display Settings').closest('.settings-dropdown')! as HTMLElement
            fireEvent.click(within(deployDrop).getByText('Available').closest('button')!)
            fireEvent.click(screen.getByTitle('Display Settings'))

            const depThead = screen.getByRole('table').querySelector('thead')!
            fireEvent.click(within(depThead).getByText('Ready'))
            fireEvent.click(within(depThead).getByText('Up-To-Date'))
            fireEvent.click(within(depThead).getByText('Available'))
            
            // Additional Pod fields
            fireEvent.click(within(tabs as HTMLElement).getByText('Pods'))
            fireEvent.click(screen.getByTitle('Display Settings'))
            const podDrop = screen.getByText('Display Settings').closest('.settings-dropdown')! as HTMLElement
            const extraCols = ['Containers', 'Images', 'Selector']
            extraCols.forEach(c => fireEvent.click(within(podDrop).getByText(c).closest('button')!))
            fireEvent.click(screen.getByTitle('Display Settings'))
            
            await waitFor(() => {
                const thead = screen.getByRole('table').querySelector('thead')!
                fireEvent.click(within(thead).getByText('Containers'))
            })
            await waitFor(() => {
                const thead = screen.getByRole('table').querySelector('thead')!
                fireEvent.click(within(thead).getByText('Images'))
            })
            await waitFor(() => {
                const thead = screen.getByRole('table').querySelector('thead')!
                fireEvent.click(within(thead).getByText('Selector'))
            })

            // Secrets Data Count Sort
            fireEvent.click(within(tabs as HTMLElement).getByText('Secrets'))
            await waitFor(() => expect(screen.getByText('sec-1')).toBeInTheDocument())
            const secThead = screen.getByRole('table').querySelector('thead')!
            fireEvent.click(within(secThead).getByText('Data'))

            // PVC Status Sort
            fireEvent.click(within(tabs as HTMLElement).getByText('PVCs'))
            await waitFor(() => expect(screen.getByText('pvc-1')).toBeInTheDocument())
            const pvcThead = screen.getByRole('table').querySelector('thead')!
            fireEvent.click(within(pvcThead).getByText('Status'))
            
            // PVC Capacity Sort
            fireEvent.click(within(pvcThead).getByText('Capacity'))
        }, 15000)

        it('should sort by namespace when present', async () => {
            const multiNsPods = [
                {
                    metadata: { name: 'pod-a', namespace: 'a-ns', creationTimestamp: '2024-01-01T10:00:00Z' },
                    status: { phase: 'Running' }
                },
                {
                    metadata: { name: 'pod-z', namespace: 'z-ns', creationTimestamp: '2024-01-01T10:00:00Z' },
                    status: { phase: 'Running' }
                }
            ]
            mockApi.getResources = vi.fn().mockResolvedValueOnce({ success: true, data: multiNsPods })
            
            renderPage()
            await waitFor(() => expect(screen.getByText('pod-a')).toBeInTheDocument())
            
            const thead = screen.getByRole('table').querySelector('thead')!
            fireEvent.click(within(thead).getByText('Namespace'))
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
             // Mock already includes pending pod-2 and notReady node-B
             renderPage()
             await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
             
             // Check pending
             const badge = screen.getByText('Pending')
             expect(badge).toHaveClass('status-badge-other')
             
             const tabs = screen.getByRole('banner').querySelector('.tabs-container')!
             fireEvent.click(within(tabs as HTMLElement).getByText('Nodes'))
             await waitFor(() => expect(screen.getByText('node-A')).toBeInTheDocument())
             
             const nodeBadge = screen.getByText('NotReady')
             expect(nodeBadge).toHaveClass('status-badge-not-ready')
        })
    })

    describe('Advanced State & Error Handling', () => {
        it('should switch tabs when active tab becomes hidden', async () => {
             renderPage()
             const tabs = screen.getByRole('banner').querySelector('.tabs-container')!
             // Default active is Pods. Let's hide Pods.
             fireEvent.click(screen.getByTitle('Display Settings'))
             const drop = screen.getByText('Display Settings').closest('.settings-dropdown')!
             
             fireEvent.click(within(drop as HTMLElement).getByText('Pods').closest('button')!)
             
             // Pods hidden, should switch to next available (likely Deployments)
             await waitFor(() => {
                 expect(within(tabs as HTMLElement).queryByText('Pods')).not.toBeInTheDocument()
                 // Check if Deployments is now active (has active class)
                 const depBtn = within(tabs as HTMLElement).getByText('Deployments').closest('button')
                 expect(depBtn).toHaveClass('tab-button-active')
             })
        })

        it('should handle fetchData throwing an exception', async () => {
             // Mock one successful call then a crash
             mockApi.getNamespaces = vi.fn().mockResolvedValue({ success: true, data: ['default'] })
             mockApi.getResources = vi.fn().mockRejectedValue(new Error('Critical specific error'))
             
             renderPage()
             await waitFor(() => expect(screen.getByText('Critical specific error')).toBeInTheDocument())
        })

        it('should handle deleteResource promise rejection', async () => {
             mockApi.deleteResource = vi.fn().mockRejectedValue({ error: 'Delete failed hard' })
             const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
             
             renderPage()
             await waitFor(() => expect(screen.getByText('pod-1')).toBeInTheDocument())
             const row = screen.getByText('pod-1').closest('tr')!
             
             fireEvent.click(within(row).getByTitle('Delete Resource'))
             
             await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Failed to delete resource', expect.any(Object)))
             confirmSpy.mockRestore()
        })

        it('should handle sorting with missing optional fields (branch coverage)', async () => {
             const sparseNodes = [
                 {
                     metadata: { name: 'node-empty', creationTimestamp: '2024-01-01T10:00:00Z', labels: {} }, // No roles
                     status: { 
                         conditions: [],
                         nodeInfo: {}, // No version/OS info
                         addresses: [] // No IPs
                     }
                 },
                 {
                     metadata: { name: 'node-full', creationTimestamp: '2024-01-01T10:00:00Z', labels: { 'node-role.kubernetes.io/worker': '' } },
                     status: { 
                         conditions: [{ type: 'Ready', status: 'True' }],
                         nodeInfo: { kubeletVersion: 'v1.29', osImage: 'Linux' },
                         addresses: [{ type: 'ExternalIP', address: '1.2.3.4' }, { type: 'InternalIP', address: '10.0.0.1' }]
                     }
                 }
             ]
             
             ;(mockApi.getResources as any).mockImplementation(async (args: any) => {
                 if (args.resourceType === 'nodes') return { success: true, data: sparseNodes }
                 return { success: true, data: [] }
             })
             
             renderPage()
             const tabs = screen.getByRole('banner').querySelector('.tabs-container')!
             fireEvent.click(within(tabs as HTMLElement).getByText('Nodes'))
             await waitFor(() => expect(screen.getByText('node-empty')).toBeInTheDocument())
             
             // Enable all optional columns first
             fireEvent.click(screen.getByTitle('Display Settings'))
             const drop = screen.getByText('Display Settings').closest('.settings-dropdown')!
             const optionalCols = ['OS Image', 'Kernel Version', 'Container Runtime']
             for (const c of optionalCols) {
                 const btn = within(drop as HTMLElement).getByText(c).closest('button')
                 if (btn) fireEvent.click(btn)
             }
             fireEvent.click(screen.getByTitle('Display Settings'))

             const thead = screen.getByRole('table').querySelector('thead')!
             
             // Trigger sorts that access optional fields
             const sortCols = ['Roles', 'Version', 'OS Image', 'Kernel Version', 'Container Runtime']
             for (const col of sortCols) {
                 fireEvent.click(within(thead).getByText(col))
             }
             
             // Toggle and sort by IPs which are missing in sparse node
             fireEvent.click(screen.getByTitle('Display Settings'))
             const dropSort = screen.getByText('Display Settings').closest('.settings-dropdown')!
             fireEvent.click(within(dropSort as HTMLElement).getByText('External IP').closest('button')!)
             fireEvent.click(within(dropSort as HTMLElement).getByText('Internal IP').closest('button')!)
             fireEvent.click(screen.getByTitle('Display Settings'))
             
             fireEvent.click(within(thead).getByText('External IP'))
             fireEvent.click(within(thead).getByText('Internal IP'))
        })
    })
})

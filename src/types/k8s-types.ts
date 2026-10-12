/**
 * TypeScript type definitions for Kubernetes resources
 * This file provides strong typing for K8s API objects to replace 'any' usage
 */

// ============================================================================
// Base Types
// ============================================================================

export interface K8sMetadata {
  name: string;
  namespace?: string;
  uid?: string;
  resourceVersion?: string;
  creationTimestamp: string;
  deletionTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  ownerReferences?: OwnerReference[];
}

export interface OwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
  controller?: boolean;
  blockOwnerDeletion?: boolean;
}

export interface K8sResource<TSpec = unknown, TStatus = unknown> {
  apiVersion?: string;
  kind?: string;
  metadata: K8sMetadata;
  spec?: TSpec;
  status?: TStatus;
}

// ============================================================================
// Pod Types
// ============================================================================

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  image: string;
  imageID?: string;
  state?: ContainerState;
  lastState?: ContainerState;
}

export interface ContainerState {
  waiting?: { reason?: string; message?: string };
  running?: { startedAt?: string };
  terminated?: { exitCode?: number; reason?: string; message?: string };
}

export interface Container {
  name: string;
  image: string;
  ports?: ContainerPort[];
  env?: EnvVar[];
  resources?: ResourceRequirements;
  volumeMounts?: VolumeMount[];
}

export interface ContainerPort {
  name?: string;
  containerPort: number;
  protocol?: string;
}

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: EnvVarSource;
}

export interface EnvVarSource {
  fieldRef?: { fieldPath: string };
  secretKeyRef?: { name: string; key: string };
  configMapKeyRef?: { name: string; key: string };
}

export interface ResourceRequirements {
  limits?: Record<string, string>;
  requests?: Record<string, string>;
}

export interface VolumeMount {
  name: string;
  mountPath: string;
  readOnly?: boolean;
}

export interface PodCondition {
  type: string;
  status: string;
  lastProbeTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface PodSpec {
  containers: Container[];
  initContainers?: Container[];
  volumes?: Volume[];
  restartPolicy?: string;
  nodeName?: string;
  serviceAccountName?: string;
  nodeSelector?: Record<string, string>;
  tolerations?: Toleration[];
  readinessGates?: ReadinessGate[];
}

export interface Volume {
  name: string;
  emptyDir?: object;
  hostPath?: { path: string; type?: string };
  persistentVolumeClaim?: { claimName: string };
  configMap?: { name: string };
  secret?: { secretName: string };
}

export interface Toleration {
  key?: string;
  operator?: string;
  value?: string;
  effect?: string;
}

export interface ReadinessGate {
  conditionType: string;
}

export interface PodStatus {
  phase: string;
  conditions?: PodCondition[];
  podIP?: string;
  hostIP?: string;
  startTime?: string;
  containerStatuses?: ContainerStatus[];
  initContainerStatuses?: ContainerStatus[];
  nominatedNodeName?: string;
}

export interface Pod extends K8sResource<PodSpec, PodStatus> {}

// ============================================================================
// Deployment Types
// ============================================================================

export interface LabelSelector {
  matchLabels?: Record<string, string>;
  matchExpressions?: LabelSelectorRequirement[];
}

export interface LabelSelectorRequirement {
  key: string;
  operator: string;
  values?: string[];
}

export interface DeploymentSpec {
  replicas?: number;
  selector: LabelSelector;
  template: PodTemplateSpec;
  strategy?: DeploymentStrategy;
  minReadySeconds?: number;
  revisionHistoryLimit?: number;
  paused?: boolean;
  progressDeadlineSeconds?: number;
}

export interface PodTemplateSpec {
  metadata?: Partial<K8sMetadata>;
  spec?: PodSpec;
}

export interface DeploymentStrategy {
  type?: string;
  rollingUpdate?: RollingUpdateDeployment;
}

export interface RollingUpdateDeployment {
  maxUnavailable?: number | string;
  maxSurge?: number | string;
}

export interface DeploymentStatus {
  observedGeneration?: number;
  replicas?: number;
  updatedReplicas?: number;
  readyReplicas?: number;
  availableReplicas?: number;
  unavailableReplicas?: number;
  conditions?: DeploymentCondition[];
}

export interface DeploymentCondition {
  type: string;
  status: string;
  lastUpdateTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface Deployment extends K8sResource<
  DeploymentSpec,
  DeploymentStatus
> {}

// ============================================================================
// Service Types
// ============================================================================

export interface ServiceSpec {
  type?: string;
  selector?: Record<string, string>;
  ports?: ServicePort[];
  clusterIP?: string;
  externalIPs?: string[];
  sessionAffinity?: string;
  loadBalancerIP?: string;
  loadBalancerSourceRanges?: string[];
  externalName?: string;
}

export interface ServicePort {
  name?: string;
  protocol?: string;
  port: number;
  targetPort?: number | string;
  nodePort?: number;
}

export interface ServiceStatus {
  loadBalancer?: LoadBalancerStatus;
}

export interface LoadBalancerStatus {
  ingress?: LoadBalancerIngress[];
}

export interface LoadBalancerIngress {
  ip?: string;
  hostname?: string;
}

export interface Service extends K8sResource<ServiceSpec, ServiceStatus> {}

// ============================================================================
// StatefulSet Types
// ============================================================================

export interface StatefulSetSpec {
  serviceName: string;
  replicas?: number;
  selector: LabelSelector;
  template: PodTemplateSpec;
  volumeClaimTemplates?: PersistentVolumeClaim[];
  updateStrategy?: StatefulSetUpdateStrategy;
}

export interface StatefulSetUpdateStrategy {
  type?: string;
  rollingUpdate?: RollingUpdateStatefulSetStrategy;
}

export interface RollingUpdateStatefulSetStrategy {
  partition?: number;
}

export interface StatefulSetStatus {
  observedGeneration?: number;
  replicas?: number;
  readyReplicas?: number;
  currentReplicas?: number;
  updatedReplicas?: number;
  currentRevision?: string;
  updateRevision?: string;
}

export interface StatefulSet extends K8sResource<
  StatefulSetSpec,
  StatefulSetStatus
> {}

// ============================================================================
// DaemonSet Types
// ============================================================================

export interface DaemonSetSpec {
  selector: LabelSelector;
  template: PodTemplateSpec;
  updateStrategy?: DaemonSetUpdateStrategy;
  minReadySeconds?: number;
}

export interface DaemonSetUpdateStrategy {
  type?: string;
  rollingUpdate?: RollingUpdateDaemonSet;
}

export interface RollingUpdateDaemonSet {
  maxUnavailable?: number | string;
}

export interface DaemonSetStatus {
  currentNumberScheduled?: number;
  numberMisscheduled?: number;
  desiredNumberScheduled?: number;
  numberReady?: number;
  observedGeneration?: number;
  updatedNumberScheduled?: number;
  numberAvailable?: number;
  numberUnavailable?: number;
}

export interface DaemonSet extends K8sResource<
  DaemonSetSpec,
  DaemonSetStatus
> {}

// ============================================================================
// ReplicaSet Types
// ============================================================================

export interface ReplicaSetSpec {
  replicas?: number;
  selector: LabelSelector;
  template?: PodTemplateSpec;
}

export interface ReplicaSetStatus {
  replicas?: number;
  fullyLabeledReplicas?: number;
  readyReplicas?: number;
  availableReplicas?: number;
  observedGeneration?: number;
}

export interface ReplicaSet extends K8sResource<
  ReplicaSetSpec,
  ReplicaSetStatus
> {}

// ============================================================================
// Job Types
// ============================================================================

export interface JobSpec {
  parallelism?: number;
  completions?: number;
  activeDeadlineSeconds?: number;
  backoffLimit?: number;
  selector?: LabelSelector;
  template: PodTemplateSpec;
  ttlSecondsAfterFinished?: number;
}

export interface JobStatus {
  conditions?: JobCondition[];
  startTime?: string;
  completionTime?: string;
  active?: number;
  succeeded?: number;
  failed?: number;
}

export interface JobCondition {
  type: string;
  status: string;
  lastProbeTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface Job extends K8sResource<JobSpec, JobStatus> {}

// ============================================================================
// CronJob Types
// ============================================================================

export interface CronJobSpec {
  schedule: string;
  timeZone?: string;
  startingDeadlineSeconds?: number;
  concurrencyPolicy?: string;
  suspend?: boolean;
  jobTemplate: JobTemplateSpec;
  successfulJobsHistoryLimit?: number;
  failedJobsHistoryLimit?: number;
}

export interface JobTemplateSpec {
  metadata?: Partial<K8sMetadata>;
  spec?: JobSpec;
}

export interface CronJobStatus {
  active?: ObjectReference[];
  lastScheduleTime?: string;
  lastSuccessfulTime?: string;
}

export interface ObjectReference {
  kind?: string;
  namespace?: string;
  name?: string;
  uid?: string;
  apiVersion?: string;
  resourceVersion?: string;
}

export interface CronJob extends K8sResource<CronJobSpec, CronJobStatus> {}

// ============================================================================
// PersistentVolume & PersistentVolumeClaim Types
// ============================================================================

export interface PersistentVolumeSpec {
  capacity?: Record<string, string>;
  accessModes?: string[];
  persistentVolumeReclaimPolicy?: string;
  storageClassName?: string;
  volumeMode?: string;
  claimRef?: ObjectReference;
  mountOptions?: string[];
}

export interface PersistentVolumeStatus {
  phase?: string;
  message?: string;
  reason?: string;
}

export interface PersistentVolume extends K8sResource<
  PersistentVolumeSpec,
  PersistentVolumeStatus
> {}

export interface PersistentVolumeClaimSpec {
  accessModes?: string[];
  resources?: ResourceRequirements;
  volumeName?: string;
  storageClassName?: string;
  volumeMode?: string;
  selector?: LabelSelector;
}

export interface PersistentVolumeClaimStatus {
  phase?: string;
  accessModes?: string[];
  capacity?: Record<string, string>;
}

export interface PersistentVolumeClaim extends K8sResource<
  PersistentVolumeClaimSpec,
  PersistentVolumeClaimStatus
> {}

// ============================================================================
// Node Types
// ============================================================================

export interface NodeSpec {
  podCIDR?: string;
  providerID?: string;
  unschedulable?: boolean;
  taints?: Taint[];
}

export interface Taint {
  key: string;
  value?: string;
  effect: string;
}

export interface NodeStatus {
  capacity?: Record<string, string>;
  allocatable?: Record<string, string>;
  phase?: string;
  conditions?: NodeCondition[];
  addresses?: NodeAddress[];
  nodeInfo?: NodeSystemInfo;
}

export interface NodeCondition {
  type: string;
  status: string;
  lastHeartbeatTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface NodeAddress {
  type: string;
  address: string;
}

export interface NodeSystemInfo {
  machineID?: string;
  systemUUID?: string;
  bootID?: string;
  kernelVersion?: string;
  osImage?: string;
  containerRuntimeVersion?: string;
  kubeletVersion?: string;
  kubeProxyVersion?: string;
  operatingSystem?: string;
  architecture?: string;
}

export interface Node extends K8sResource<NodeSpec, NodeStatus> {}

// ============================================================================
// ConfigMap & Secret Types
// ============================================================================

export interface ConfigMap extends K8sResource {
  data?: Record<string, string>;
  binaryData?: Record<string, string>;
}

export interface Secret extends K8sResource {
  type?: string;
  data?: Record<string, string>;
  stringData?: Record<string, string>;
}

// ============================================================================
// Ingress Types
// ============================================================================

export interface IngressSpec {
  ingressClassName?: string;
  defaultBackend?: IngressBackend;
  tls?: IngressTLS[];
  rules?: IngressRule[];
}

export interface IngressBackend {
  service?: IngressServiceBackend;
  resource?: TypedLocalObjectReference;
}

export interface IngressServiceBackend {
  name: string;
  port?: ServiceBackendPort;
}

export interface ServiceBackendPort {
  name?: string;
  number?: number;
}

export interface TypedLocalObjectReference {
  apiGroup?: string;
  kind: string;
  name: string;
}

export interface IngressTLS {
  hosts?: string[];
  secretName?: string;
}

export interface IngressRule {
  host?: string;
  http?: HTTPIngressRuleValue;
}

export interface HTTPIngressRuleValue {
  paths: HTTPIngressPath[];
}

export interface HTTPIngressPath {
  path?: string;
  pathType?: string;
  backend: IngressBackend;
}

export interface IngressStatus {
  loadBalancer?: LoadBalancerStatus;
}

export interface Ingress extends K8sResource<IngressSpec, IngressStatus> {}

// ============================================================================
// HorizontalPodAutoscaler Types
// ============================================================================

export interface HorizontalPodAutoscalerSpec {
  scaleTargetRef: CrossVersionObjectReference;
  minReplicas?: number;
  maxReplicas: number;
  targetCPUUtilizationPercentage?: number;
  metrics?: MetricSpec[];
}

export interface CrossVersionObjectReference {
  kind: string;
  name: string;
  apiVersion?: string;
}

export interface MetricSpec {
  type: string;
  object?: ObjectMetricSource;
  pods?: PodsMetricSource;
  resource?: ResourceMetricSource;
  external?: ExternalMetricSource;
}

export interface ObjectMetricSource {
  target: MetricTarget;
  metric: MetricIdentifier;
  describedObject: CrossVersionObjectReference;
}

export interface PodsMetricSource {
  metric: MetricIdentifier;
  target: MetricTarget;
}

export interface ResourceMetricSource {
  name: string;
  target: MetricTarget;
}

export interface ExternalMetricSource {
  metric: MetricIdentifier;
  target: MetricTarget;
}

export interface MetricTarget {
  type: string;
  value?: string;
  averageValue?: string;
  averageUtilization?: number;
}

export interface MetricIdentifier {
  name: string;
  selector?: LabelSelector;
}

export interface HorizontalPodAutoscalerStatus {
  observedGeneration?: number;
  lastScaleTime?: string;
  currentReplicas: number;
  desiredReplicas: number;
  currentMetrics?: MetricStatus[];
  conditions?: HorizontalPodAutoscalerCondition[];
  currentCPUUtilizationPercentage?: number;
}

export interface MetricStatus {
  type: string;
  object?: ObjectMetricStatus;
  pods?: PodsMetricStatus;
  resource?: ResourceMetricStatus;
  external?: ExternalMetricStatus;
}

export interface ObjectMetricStatus {
  metric: MetricIdentifier;
  current: MetricValueStatus;
  describedObject: CrossVersionObjectReference;
}

export interface PodsMetricStatus {
  metric: MetricIdentifier;
  current: MetricValueStatus;
}

export interface ResourceMetricStatus {
  name: string;
  current: MetricValueStatus;
}

export interface ExternalMetricStatus {
  metric: MetricIdentifier;
  current: MetricValueStatus;
}

export interface MetricValueStatus {
  value?: string;
  averageValue?: string;
  averageUtilization?: number;
}

export interface HorizontalPodAutoscalerCondition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface HorizontalPodAutoscaler extends K8sResource<
  HorizontalPodAutoscalerSpec,
  HorizontalPodAutoscalerStatus
> {}

// ============================================================================
// Generic/Other Resource Types
// ============================================================================

export interface GenericResource extends K8sResource<
  Record<string, unknown>,
  Record<string, unknown>
> {}

// Type union for all specific resource types
export type AnyK8sResource =
  | Pod
  | Deployment
  | Service
  | StatefulSet
  | DaemonSet
  | ReplicaSet
  | Job
  | CronJob
  | PersistentVolume
  | PersistentVolumeClaim
  | Node
  | ConfigMap
  | Secret
  | Ingress
  | HorizontalPodAutoscaler
  | GenericResource;

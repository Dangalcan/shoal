export interface ExampleTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
}

export const EXAMPLE_TEMPLATES: ExampleTemplate[] = [
  {
    id: 'deployment',
    name: 'Deployment',
    description:
      'Nginx deployment with 2 replicas, resource limits and a liveness probe.',
    content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 250m
              memory: 256Mi
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
`,
  },
  {
    id: 'service',
    name: 'Service (ClusterIP)',
    description: 'Exposes a set of pods internally on port 80.',
    content: `apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  type: ClusterIP
  selector:
    app: nginx
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
`,
  },
  {
    id: 'configmap',
    name: 'ConfigMap',
    description:
      'Key-value configuration data consumable as env vars or files.',
    content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  APP_MODE: production
  LOG_LEVEL: info
  config.yaml: |
    server:
      port: 8080
`,
  },
  {
    id: 'secret',
    name: 'Secret',
    description: 'Opaque secret with stringData (values are placeholders).',
    content: `apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque
stringData:
  DB_USER: change-me
  DB_PASSWORD: change-me
`,
  },
  {
    id: 'ingress',
    name: 'Ingress',
    description: 'Routes HTTP traffic for a hostname to a backend service.',
    content: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nginx-service
                port:
                  number: 80
`,
  },
  {
    id: 'pvc',
    name: 'PersistentVolumeClaim',
    description: 'Requests 1Gi of storage with ReadWriteOnce access.',
    content: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
`,
  },
  {
    id: 'cronjob',
    name: 'CronJob',
    description: 'Runs a busybox job every 5 minutes.',
    content: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: hello-cron
spec:
  schedule: '*/5 * * * *'
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: hello
              image: busybox:1.36
              command: ['sh', '-c', 'date; echo Hello from Kubernetes']
`,
  },
  {
    id: 'namespace',
    name: 'Namespace',
    description: 'Isolated namespace with an environment label.',
    content: `apiVersion: v1
kind: Namespace
metadata:
  name: my-namespace
  labels:
    environment: development
`,
  },
];

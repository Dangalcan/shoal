(function () {
  var { React, K8sUI, pluginUIRegistry, LucideIcons } = window;
  var { useState, useEffect, useMemo } = React;
  var { Card, Badge, Spinner, Button, Animate } = K8sUI;
  var {
    Activity,
    Server,
    Box,
    RefreshCw,
    Search,
    ShieldCheck,
    Zap,
    AlertCircle,
  } = LucideIcons;

  function ResourceMonitorPage() {
    const [pods, setPods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshCount, setRefreshCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentContext, setCurrentContext] = useState(null);

    const fetchPods = async () => {
      try {
        setLoading(true);
        setError(null);

        const contextRes = await window.electron.getCurrentContext();
        if (!contextRes.success)
          throw new Error(contextRes.error || 'Failed to get context');

        const context = contextRes.data;
        setCurrentContext(context);

        const result = await window.electron.getPods(context);
        if (result.success) {
          setPods(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message || 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchPods();
      const interval = setInterval(() => setRefreshCount((c) => c + 1), 30000);
      return () => clearInterval(interval);
    }, [refreshCount]);

    const filteredPods = useMemo(() => {
      return pods.filter(
        (pod) =>
          pod.metadata.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pod.metadata.namespace
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }, [pods, searchTerm]);

    const stats = useMemo(
      () => ({
        total: pods.length,
        running: pods.filter((p) => p.status.phase === 'Running').length,
        pending: pods.filter((p) => p.status.phase === 'Pending').length,
        failed: pods.filter(
          (p) => p.status.phase === 'Failed' || p.status.phase === 'Error'
        ).length,
      }),
      [pods]
    );

    if (loading && pods.length === 0) {
      return React.createElement(
        'div',
        {
          className:
            'flex flex-col items-center justify-center h-full space-y-6 resource-monitor-container',
        },
        [
          React.createElement(
            'div',
            { key: 'loader-box', className: 'relative' },
            [
              React.createElement(Spinner, { key: 'spinner', size: 'large' }),
              React.createElement('div', {
                key: 'pulse',
                className:
                  'absolute inset-0 bg-primary/20 rounded-full animate-ping',
              }),
            ]
          ),
          React.createElement(
            'div',
            { key: 'text-box', className: 'text-center' },
            [
              React.createElement(
                'h3',
                { key: 't1', className: 'text-lg font-bold' },
                'Initializing Pulse Engine'
              ),
              React.createElement(
                'p',
                { key: 't2', className: 'text-secondary text-sm' },
                'Fetching real-time pod telemetry...'
              ),
            ]
          ),
        ]
      );
    }

    return React.createElement(
      'div',
      {
        className: 'space-y-6 h-full flex flex-col resource-monitor-container',
      },
      [
        // --- Open a sandboxed modal (renders in its own iframe) ---
        React.createElement(
          Button,
          {
            key: 'open-details',
            'data-testid': 'rm-open-details',
            variant: 'secondary',
            size: 'sm',
            onClick: () =>
              window.k8sPlugin.ui.showModal('rm-details', {
                total: stats.total,
                running: stats.running,
              }),
          },
          'Cluster Details'
        ),
        // --- Stats Row ---
        React.createElement(
          'div',
          {
            key: 'stats-row',
            className: 'grid grid-cols-1 md:grid-cols-4 gap-6',
          },
          [
            {
              label: 'Total Nodes',
              val: stats.total,
              icon: Box,
              color: '#3b82f6',
              bg: 'rgba(59, 130, 246, 0.1)',
            },
            {
              label: 'Running',
              val: stats.running,
              icon: ShieldCheck,
              color: '#10b981',
              bg: 'rgba(16, 185, 129, 0.1)',
              pulse: true,
            },
            {
              label: 'Pending',
              val: stats.pending,
              icon: Zap,
              color: '#f59e0b',
              bg: 'rgba(245, 158, 11, 0.1)',
            },
            {
              label: 'Unhealthy',
              val: stats.failed,
              icon: AlertCircle,
              color: '#ef4444',
              bg: 'rgba(239, 68, 68, 0.1)',
            },
          ].map((s, i) =>
            React.createElement(
              Card,
              { key: i, className: 'pm-glass-card group' },
              React.createElement(
                'div',
                { className: 'p-4 flex items-center gap-4' },
                [
                  React.createElement(
                    'div',
                    {
                      key: 'icon',
                      className: 'pm-stat-icon-group transition-colors',
                      style: { color: s.color, backgroundColor: s.bg },
                    },
                    React.createElement(s.icon, { size: 22 })
                  ),
                  React.createElement('div', { key: 'label-box' }, [
                    React.createElement(
                      'p',
                      {
                        className:
                          'text-[10px] uppercase font-black text-secondary/60 tracking-widest',
                      },
                      s.label
                    ),
                    React.createElement(
                      'div',
                      { className: 'flex items-center gap-2' },
                      [
                        React.createElement(
                          'span',
                          { className: 'text-2xl font-black' },
                          s.val || 0
                        ),
                        s.pulse &&
                          React.createElement('div', {
                            className: 'pm-status-indicator',
                            style: { backgroundColor: s.color },
                          }),
                      ]
                    ),
                  ]),
                ]
              )
            )
          )
        ),

        // --- Modern Toolbar ---
        React.createElement(
          'div',
          {
            key: 'toolbar',
            className:
              'pm-toolbar flex flex-wrap gap-4 items-center justify-between',
          },
          [
            React.createElement(
              'div',
              { key: 'search', className: 'relative flex-1 max-w-lg' },
              [
                React.createElement(Search, {
                  className:
                    'absolute left-4 top-1/2 -translate-y-1/2 text-secondary/50',
                  size: 18,
                }),
                React.createElement('input', {
                  className:
                    'pm-search-input w-full pl-12 pr-4 py-3 outline-none transition-all',
                  placeholder: 'Search by pod name, namespace, or status...',
                  value: searchTerm,
                  onChange: (e) => setSearchTerm(e.target.value),
                }),
              ]
            ),
            React.createElement(
              'div',
              { key: 'actions', className: 'flex items-center gap-3' },
              [
                React.createElement(
                  'div',
                  {
                    key: 'ctx',
                    className:
                      'hidden sm:flex items-center gap-2 px-4 py-2 bg-secondary/30 rounded-full text-xs font-bold text-secondary border border-border',
                  },
                  [
                    React.createElement(Server, { size: 14 }),
                    currentContext || '---',
                  ]
                ),
                React.createElement(
                  Button,
                  {
                    variant: 'primary',
                    size: 'md',
                    onClick: () => setRefreshCount((c) => c + 1),
                    disabled: loading,
                    className:
                      'rounded-full px-6 font-bold shadow-lg shadow-primary/30 transition-all hover:scale-105 active:scale-95',
                  },
                  [
                    React.createElement(RefreshCw, {
                      key: 'icon',
                      size: 16,
                      className: loading ? 'animate-spin' : '',
                    }),
                    React.createElement(
                      'span',
                      { key: 'text', className: 'ml-2' },
                      'Refresh'
                    ),
                  ]
                ),
              ]
            ),
          ]
        ),

        // --- Error UI ---
        error &&
          React.createElement(
            Animate,
            { key: 'err', type: 'fade' },
            React.createElement(
              'div',
              {
                className:
                  'p-4 bg-error/10 border border-error/20 text-error rounded-2xl flex items-center gap-3 font-bold text-sm',
              },
              [React.createElement(AlertCircle, { size: 20 }), error]
            )
          ),

        // --- Ultra Pod Grid ---
        React.createElement(
          'div',
          { key: 'grid-container', className: 'flex-1' },
          filteredPods.length > 0
            ? React.createElement(
                'div',
                {
                  className:
                    'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-8',
                },
                filteredPods.map((pod, idx) => {
                  const statusColor =
                    pod.status.phase === 'Running'
                      ? '#10b981'
                      : pod.status.phase === 'Pending'
                        ? '#f59e0b'
                        : '#ef4444';
                  return React.createElement(
                    Animate,
                    {
                      key: pod.metadata.uid,
                      type: 'slide-up',
                      delay: idx * 30,
                    },
                    React.createElement(
                      Card,
                      {
                        className: 'pm-pod-card h-full group',
                        style: { '--status-color': statusColor },
                      },
                      [
                        React.createElement(
                          'div',
                          { key: 'pad', className: 'p-5 space-y-5' },
                          [
                            // Card Header
                            React.createElement(
                              'div',
                              {
                                key: 'h',
                                className:
                                  'flex justify-between items-start gap-3',
                              },
                              [
                                React.createElement(
                                  'div',
                                  {
                                    key: 'titles',
                                    className: 'flex-1 min-w-0',
                                  },
                                  [
                                    React.createElement(
                                      'h4',
                                      {
                                        className:
                                          'font-black text-sm text-secondary tracking-tight truncate mb-0.5',
                                        title: pod.metadata.name,
                                      },
                                      pod.metadata.name
                                    ),
                                    React.createElement(
                                      'div',
                                      {
                                        className: 'flex items-center gap-1.5',
                                      },
                                      [
                                        React.createElement(
                                          'span',
                                          {
                                            className:
                                              'text-[10px] font-bold text-muted uppercase bg-secondary/40 px-1.5 rounded',
                                          },
                                          pod.metadata.namespace
                                        ),
                                      ]
                                    ),
                                  ]
                                ),
                                React.createElement(
                                  Badge,
                                  {
                                    key: 'b',
                                    variant:
                                      pod.status.phase === 'Running'
                                        ? 'success'
                                        : pod.status.phase === 'Pending'
                                          ? 'warning'
                                          : 'error',
                                    className:
                                      'rounded-full px-3 py-1 font-black text-[10px] uppercase shadow-sm',
                                  },
                                  pod.status.phase
                                ),
                              ]
                            ),

                            // Details Grid
                            React.createElement(
                              'div',
                              {
                                key: 'd',
                                className:
                                  'grid grid-cols-2 gap-4 bg-secondary/20 p-3 rounded-2xl',
                              },
                              [
                                React.createElement('div', { key: 'ip-box' }, [
                                  React.createElement(
                                    'p',
                                    {
                                      className:
                                        'text-[9px] font-black text-muted uppercase tracking-tighter',
                                    },
                                    'Network IP'
                                  ),
                                  React.createElement(
                                    'p',
                                    {
                                      className: 'font-mono text-xs font-bold',
                                    },
                                    pod.status.podIP || '---'
                                  ),
                                ]),
                                React.createElement('div', { key: 'rs' }, [
                                  React.createElement(
                                    'p',
                                    {
                                      className:
                                        'text-[9px] font-black text-muted uppercase tracking-tighter',
                                    },
                                    'Restarts'
                                  ),
                                  React.createElement(
                                    'p',
                                    { className: 'font-bold text-xs' },
                                    pod.status.containerStatuses?.reduce(
                                      (acc, s) => acc + s.restartCount,
                                      0
                                    ) || 0
                                  ),
                                ]),
                              ]
                            ),

                            // Footer / Readiness
                            React.createElement(
                              'div',
                              {
                                key: 'f',
                                className:
                                  'flex items-center justify-between pt-2',
                              },
                              [
                                React.createElement(
                                  'div',
                                  {
                                    key: 'r',
                                    className: 'flex items-center gap-2',
                                  },
                                  [
                                    React.createElement(
                                      'span',
                                      {
                                        className:
                                          'text-[10px] font-black text-muted uppercase',
                                      },
                                      'Continuity'
                                    ),
                                    React.createElement(
                                      'div',
                                      { className: 'flex gap-1' },
                                      (pod.status.containerStatuses || []).map(
                                        (s, i) =>
                                          React.createElement('div', {
                                            key: i,
                                            className: `h-1.5 w-4 rounded-full transition-all ${s.ready ? 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-error shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`,
                                            title: `${s.name}: ${s.ready ? 'Online' : 'Offline'}`,
                                          })
                                      )
                                    ),
                                  ]
                                ),
                                React.createElement(
                                  'div',
                                  {
                                    key: 'act',
                                    className:
                                      'text-primary/50 group-hover:text-primary transition-colors',
                                  },
                                  React.createElement(Activity, { size: 14 })
                                ),
                              ]
                            ),
                          ]
                        ),
                      ]
                    )
                  );
                })
              )
            : !loading &&
                React.createElement(
                  'div',
                  {
                    className:
                      'h-80 flex flex-col items-center justify-center text-secondary pm-glass-card m-4 border-2 border-dashed border-border/20',
                  },
                  [
                    React.createElement(Box, {
                      key: 'icon',
                      size: 64,
                      className: 'mb-6 opacity-5',
                    }),
                    React.createElement(
                      'h3',
                      { key: 't', className: 'text-xl font-black mb-2' },
                      searchTerm ? 'No Results Found' : 'Clean Slate'
                    ),
                    React.createElement(
                      'p',
                      {
                        key: 'st',
                        className: 'text-sm mb-6 max-w-xs text-center',
                      },
                      'No pods match your criteria. Expand your search or refresh the cluster state.'
                    ),
                    searchTerm &&
                      React.createElement(
                        Button,
                        {
                          key: 'btn',
                          variant: 'secondary',
                          size: 'sm',
                          className: 'rounded-full px-8',
                          onClick: () => setSearchTerm(''),
                        },
                        'Clear Filters'
                      ),
                  ]
                )
        ),
      ]
    );
  }

  // --- Dynamic Widget ---

  function PodCountWidget() {
    const [stats, setStats] = useState({ total: 0, running: 0 });

    useEffect(() => {
      const update = async () => {
        try {
          const ctxRes = await window.electron.getCurrentContext();
          if (!ctxRes.success)
            throw new Error(ctxRes.error || 'Failed to get current context');
          const res = await window.electron.getPods(ctxRes.data);
          if (!res.success) throw new Error(res.error || 'Failed to get pods');
          const pods = Array.isArray(res.data) ? res.data : [];
          setStats({
            total: pods.length,
            // Guard status/phase: pods can momentarily lack a status.phase, and
            // one missing field must not throw and blank the whole widget.
            running: pods.filter((p) => p?.status?.phase === 'Running').length,
          });
        } catch (err) {
          console.error('[Resource Monitor] widget update failed:', err);
        }
      };
      update();
      const inv = setInterval(update, 15000);
      return () => clearInterval(inv);
    }, []);

    return React.createElement(
      'div',
      { className: 'flex items-center gap-4 p-2' },
      [
        React.createElement(
          'div',
          {
            key: 'icon-box',
            className:
              'relative p-3 bg-primary/10 rounded-2xl text-primary transition-transform hover:scale-110',
          },
          [
            React.createElement(Activity, { size: 24 }),
            stats.running < stats.total &&
              React.createElement('div', {
                key: 'alert',
                className:
                  'absolute -top-1 -right-1 h-3.5 w-3.5 bg-error rounded-full border-2 border-primary shadow-lg animate-pulse',
              }),
          ]
        ),
        React.createElement(
          'div',
          { key: 'info', className: 'flex flex-col' },
          [
            React.createElement(
              'div',
              { key: 'nums', className: 'flex items-baseline gap-1.5' },
              [
                React.createElement(
                  'span',
                  {
                    className:
                      'text-2xl font-black text-primary leading-none tracking-tight',
                  },
                  stats.running
                ),
                React.createElement(
                  'span',
                  { className: 'text-xs font-bold text-secondary/30' },
                  `/ ${stats.total}`
                ),
              ]
            ),
            React.createElement(
              'span',
              {
                className:
                  'text-[9px] uppercase font-black tracking-widest text-secondary/60',
              },
              'Cluster Health'
            ),
          ]
        ),
      ]
    );
  }

  // --- Sandboxed modal: rendered in its own iframe, receives props +
  // an injected onClose from the host. No host-realm code execution. ---
  function ClusterDetailsModal(props) {
    return React.createElement(
      'div',
      {
        className: 'p-6 space-y-4',
        'data-testid': 'rm-details-modal',
      },
      [
        React.createElement(
          'h2',
          { key: 'h', className: 'text-lg font-bold text-primary' },
          'Cluster Details'
        ),
        React.createElement(
          'p',
          { key: 'p', className: 'text-secondary' },
          `Running ${props.running ?? 0} of ${props.total ?? 0} pods.`
        ),
        React.createElement(
          Button,
          {
            key: 'close',
            'data-testid': 'rm-details-close',
            variant: 'secondary',
            size: 'sm',
            onClick: () => props.onClose && props.onClose(),
          },
          'Close'
        ),
      ]
    );
  }

  // Global Registration
  pluginUIRegistry.registerPage({
    id: 'resource-monitor',
    component: ResourceMonitorPage,
  });
  pluginUIRegistry.registerWidget({
    id: 'pod-monitor-widget',
    pluginId: 'resource-monitor',
    title: 'Live Pulse',
    size: 'small',
    component: PodCountWidget,
  });
  pluginUIRegistry.registerModal({
    id: 'rm-details',
    component: ClusterDetailsModal,
  });

  console.log('[Resource Monitor] Premium extensions active');
})();

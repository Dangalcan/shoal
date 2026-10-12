(function () {
  /**
   * Namespace Watcher — Renderer
   *
   * Full-page namespace dashboard: list all namespaces with status, age, labels,
   * phase timeline, and quick resource counts (pods, deployments, services).
   *
   * Data comes from the host through window.k8sPlugin.kubernetes (resolves
   * with plain data, throws on failure). Settings (showSystemNamespaces,
   * refreshInterval) come from window.k8sPlugin.settings.get().
   */

  var { React, K8sUI, pluginUIRegistry, LucideIcons } = window;
  var { useState, useEffect, useCallback, useMemo, useRef } = React;

  /** A resource list from the host, or [] when the call fails. */
  const listResources = (args) =>
    window.k8sPlugin.kubernetes
      .getResources(args)
      .then((list) => (Array.isArray(list) ? list : []))
      .catch(() => []);

  /** Same, but null on failure so the UI can show "unknown" instead of 0. */
  const listResourcesOrNull = (args) =>
    window.k8sPlugin.kubernetes
      .getResources(args)
      .then((list) => (Array.isArray(list) ? list : []))
      .catch(() => null);
  var { Card, Badge, Spinner, Button, Animate } = K8sUI;
  var {
    Eye,
    RefreshCw,
    Search,
    Layers,
    Box,
    Globe,
    Clock,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Server,
    Activity,
    ChevronDown,
    ChevronUp,
    Shield,
    Tag,
  } = LucideIcons;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function ageString(ts) {
    if (!ts) return '—';
    const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d`;
    return `${Math.floor(days / 30)}mo`;
  }

  function phaseVariant(phase) {
    if (phase === 'Active') return 'success';
    if (phase === 'Terminating') return 'warning';
    return 'default';
  }

  function phaseIcon(phase) {
    if (phase === 'Active')
      return React.createElement(CheckCircle2, { size: 14, color: '#10b981' });
    if (phase === 'Terminating')
      return React.createElement(AlertTriangle, { size: 14, color: '#f59e0b' });
    return React.createElement(XCircle, { size: 14, color: '#6b7280' });
  }

  const SYSTEM_PREFIXES = ['kube-', 'openshift-'];
  const SYSTEM_EXACT = new Set([
    'default',
    'kube-system',
    'kube-public',
    'kube-node-lease',
  ]);

  function isSystemNamespace(name) {
    if (SYSTEM_EXACT.has(name)) return true;
    return SYSTEM_PREFIXES.some((p) => name.startsWith(p));
  }

  // ---------------------------------------------------------------------------
  // Sub-components
  // ---------------------------------------------------------------------------

  function StatCard({ label, value, icon, color = '#3b82f6', sub }) {
    return React.createElement(
      'div',
      { className: 'nw-stat-card' },
      React.createElement(
        'div',
        {
          className: 'nw-stat-icon',
          style: { background: `${color}22`, color },
        },
        icon
      ),
      React.createElement(
        'div',
        { className: 'nw-stat-body' },
        React.createElement('div', { className: 'nw-stat-value' }, value),
        React.createElement('div', { className: 'nw-stat-label' }, label),
        sub
          ? React.createElement('div', { className: 'nw-stat-sub' }, sub)
          : null
      )
    );
  }

  function LabelChips({ labels }) {
    if (!labels || Object.keys(labels).length === 0) return null;
    const entries = Object.entries(labels).slice(0, 4);
    const overflow = Object.keys(labels).length - 4;
    return React.createElement(
      'div',
      { className: 'nw-label-chips' },
      entries.map(([k, v]) =>
        React.createElement(
          'span',
          { key: `${k}=${v}`, className: 'nw-label-chip', title: `${k}=${v}` },
          `${k}=${v}`
        )
      ),
      overflow > 0
        ? React.createElement(
            'span',
            { className: 'nw-label-chip nw-label-chip--more' },
            `+${overflow}`
          )
        : null
    );
  }

  function NamespaceRow({ ns, expanded, onToggle, resourceCounts, context }) {
    const name = ns.metadata?.name ?? '—';
    const phase = ns.status?.phase ?? 'Unknown';
    const created = ns.metadata?.creationTimestamp;
    const labels = ns.metadata?.labels ?? {};
    const annotations = ns.metadata?.annotations ?? {};
    const counts = resourceCounts[name] ?? {};
    const system = isSystemNamespace(name);

    // ResourceQuotas + LimitRanges are fetched lazily on first expand
    const [governance, setGovernance] = useState(null); // {quotas, limitRanges} | null
    const [governanceLoading, setGovernanceLoading] = useState(false);

    useEffect(() => {
      if (!expanded || governance || governanceLoading || !context || !name)
        return;
      setGovernanceLoading(true);
      Promise.all([
        listResources({
          contextName: context,
          resourceType: 'resourcequotas',
          namespace: name,
        }),
        listResources({
          contextName: context,
          resourceType: 'limitranges',
          namespace: name,
        }),
      ])
        .then(([quotas, limitRanges]) => {
          setGovernance({ quotas, limitRanges });
        })
        .finally(() => setGovernanceLoading(false));
    }, [expanded, governance, governanceLoading, context, name]);

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'tr',
        {
          className: `nw-row ${expanded ? 'nw-row--expanded' : ''}`,
          onClick: onToggle,
          style: { cursor: 'pointer' },
        },
        React.createElement(
          'td',
          { className: 'nw-cell nw-cell--name' },
          React.createElement(
            'div',
            { className: 'nw-name-wrap' },
            expanded
              ? React.createElement(ChevronUp, {
                  size: 14,
                  className: 'nw-chevron',
                })
              : React.createElement(ChevronDown, {
                  size: 14,
                  className: 'nw-chevron',
                }),
            React.createElement('span', { className: 'nw-ns-name' }, name),
            system
              ? React.createElement(
                  'span',
                  { className: 'nw-badge-system', title: 'System namespace' },
                  'system'
                )
              : null
          )
        ),
        React.createElement(
          'td',
          { className: 'nw-cell' },
          React.createElement(
            'div',
            { className: 'nw-phase' },
            phaseIcon(phase),
            React.createElement('span', null, phase)
          )
        ),
        React.createElement(
          'td',
          { className: 'nw-cell nw-cell--num' },
          counts.pods ?? '—'
        ),
        React.createElement(
          'td',
          { className: 'nw-cell nw-cell--num' },
          counts.deployments ?? '—'
        ),
        React.createElement(
          'td',
          { className: 'nw-cell nw-cell--num' },
          counts.services ?? '—'
        ),
        React.createElement(
          'td',
          { className: 'nw-cell nw-cell--age' },
          React.createElement(Clock, { size: 12, className: 'nw-icon-inline' }),
          ageString(created)
        )
      ),
      expanded
        ? React.createElement(
            'tr',
            { className: 'nw-detail-row' },
            React.createElement(
              'td',
              { colSpan: 6, className: 'nw-detail-cell' },
              React.createElement(
                'div',
                { className: 'nw-detail-body' },
                React.createElement(
                  'div',
                  { className: 'nw-detail-section' },
                  React.createElement(
                    'div',
                    { className: 'nw-detail-title' },
                    React.createElement(Tag, { size: 12 }),
                    'Labels'
                  ),
                  Object.keys(labels).length > 0
                    ? React.createElement(LabelChips, { labels })
                    : React.createElement(
                        'span',
                        { className: 'nw-detail-empty' },
                        'No labels'
                      )
                ),
                React.createElement(
                  'div',
                  { className: 'nw-detail-section' },
                  React.createElement(
                    'div',
                    { className: 'nw-detail-title' },
                    React.createElement(Shield, { size: 12 }),
                    'Annotations'
                  ),
                  Object.keys(annotations).length > 0
                    ? React.createElement(
                        'div',
                        { className: 'nw-annotations' },
                        Object.entries(annotations)
                          .slice(0, 6)
                          .map(([k, v]) =>
                            React.createElement(
                              'div',
                              { key: k, className: 'nw-annotation-row' },
                              React.createElement(
                                'span',
                                { className: 'nw-annot-key' },
                                k
                              ),
                              React.createElement(
                                'span',
                                { className: 'nw-annot-val' },
                                v
                              )
                            )
                          )
                      )
                    : React.createElement(
                        'span',
                        { className: 'nw-detail-empty' },
                        'No annotations'
                      )
                ),
                React.createElement(
                  'div',
                  { className: 'nw-detail-section' },
                  React.createElement(
                    'div',
                    { className: 'nw-detail-title' },
                    React.createElement(Clock, { size: 12 }),
                    'Created'
                  ),
                  React.createElement(
                    'span',
                    { className: 'nw-detail-empty' },
                    created ? new Date(created).toLocaleString() : '—'
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'nw-detail-section' },
                  React.createElement(
                    'div',
                    { className: 'nw-detail-title' },
                    React.createElement(Box, { size: 12 }),
                    'Resource Quotas & Limits'
                  ),
                  governanceLoading
                    ? React.createElement(Spinner, { size: 'small' })
                    : !governance ||
                        (governance.quotas.length === 0 &&
                          governance.limitRanges.length === 0)
                      ? React.createElement(
                          'span',
                          { className: 'nw-detail-empty' },
                          'No quotas or limit ranges'
                        )
                      : React.createElement(
                          'div',
                          { className: 'nw-governance' },
                          [
                            ...governance.quotas.map((q) =>
                              React.createElement(
                                'div',
                                {
                                  key: `q-${q.metadata?.name}`,
                                  className: 'nw-quota-block',
                                },
                                [
                                  React.createElement(
                                    'p',
                                    {
                                      key: 'name',
                                      className: 'nw-quota-name',
                                    },
                                    `Quota: ${q.metadata?.name}`
                                  ),
                                  ...Object.entries(
                                    q.status?.hard ?? q.spec?.hard ?? {}
                                  ).map(([k, v]) =>
                                    React.createElement(
                                      'div',
                                      {
                                        key: k,
                                        className: 'nw-quota-row',
                                      },
                                      [
                                        React.createElement(
                                          'span',
                                          {
                                            key: 'k',
                                            className: 'nw-annot-key',
                                          },
                                          k
                                        ),
                                        React.createElement(
                                          'span',
                                          {
                                            key: 'v',
                                            className: 'nw-annot-val',
                                          },
                                          q.status?.used?.[k] !== undefined
                                            ? `${q.status.used[k]} / ${v}`
                                            : String(v)
                                        ),
                                      ]
                                    )
                                  ),
                                ]
                              )
                            ),
                            ...governance.limitRanges.map((lr) =>
                              React.createElement(
                                'div',
                                {
                                  key: `lr-${lr.metadata?.name}`,
                                  className: 'nw-quota-block',
                                },
                                [
                                  React.createElement(
                                    'p',
                                    {
                                      key: 'name',
                                      className: 'nw-quota-name',
                                    },
                                    `LimitRange: ${lr.metadata?.name}`
                                  ),
                                  ...(lr.spec?.limits ?? []).map((lim, i) =>
                                    React.createElement(
                                      'div',
                                      {
                                        key: i,
                                        className: 'nw-quota-row',
                                      },
                                      [
                                        React.createElement(
                                          'span',
                                          {
                                            key: 'k',
                                            className: 'nw-annot-key',
                                          },
                                          lim.type ?? 'Limit'
                                        ),
                                        React.createElement(
                                          'span',
                                          {
                                            key: 'v',
                                            className: 'nw-annot-val',
                                          },
                                          [
                                            'default',
                                            'defaultRequest',
                                            'max',
                                            'min',
                                          ]
                                            .filter((f) => lim[f])
                                            .map(
                                              (f) =>
                                                `${f}: cpu=${lim[f].cpu ?? '—'} mem=${lim[f].memory ?? '—'}`
                                            )
                                            .join(' · ') || '—'
                                        ),
                                      ]
                                    )
                                  ),
                                ]
                              )
                            ),
                          ]
                        )
                )
              )
            )
          )
        : null
    );
  }

  // ---------------------------------------------------------------------------
  // Main Page
  // ---------------------------------------------------------------------------

  function NamespaceWatcherPage() {
    const [namespaces, setNamespaces] = useState([]);
    const [resourceCounts, setResourceCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [countsLoading, setCountsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [showSystem, setShowSystem] = useState(false);
    const [expandedRow, setExpandedRow] = useState(null);
    const [lastSync, setLastSync] = useState(null);
    const [context, setContext] = useState(null);
    const intervalRef = useRef(null);

    const fetchData = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        const ctx = await window.k8sPlugin.kubernetes.getCurrentContext();
        setContext(ctx);

        const list = await window.k8sPlugin.kubernetes.getResources({
          contextName: ctx,
          resourceType: 'namespaces',
          namespace: 'all',
        });
        setNamespaces(Array.isArray(list) ? list : []);
        setLastSync(new Date().toISOString());
      } catch (err) {
        setError(err.message || 'Unexpected error');
      } finally {
        setLoading(false);
      }
    }, []);

    // Fetch resource counts for each namespace (pods, deployments, services)
    const fetchCounts = useCallback(async (nsList, ctx) => {
      if (!nsList.length || !ctx) return;
      setCountsLoading(true);
      try {
        const [pods, deployments, services] = await Promise.all([
          listResourcesOrNull({
            contextName: ctx,
            resourceType: 'pods',
            namespace: 'all',
          }),
          listResourcesOrNull({
            contextName: ctx,
            resourceType: 'deployments',
            namespace: 'all',
          }),
          listResourcesOrNull({
            contextName: ctx,
            resourceType: 'services',
            namespace: 'all',
          }),
        ]);

        const inNamespace = (list, name) =>
          list === null
            ? null
            : list.filter((r) => r.metadata?.namespace === name).length;
        const counts = {};
        for (const ns of nsList) {
          const name = ns.metadata?.name;
          if (!name) continue;
          counts[name] = {
            pods: inNamespace(pods, name),
            deployments: inNamespace(deployments, name),
            services: inNamespace(services, name),
          };
        }
        setResourceCounts(counts);
      } catch {
        // counts are optional — silently ignore
      } finally {
        setCountsLoading(false);
      }
    }, []);

    useEffect(() => {
      fetchData();
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [fetchData]);

    // Load settings and set up auto-refresh
    useEffect(() => {
      (async () => {
        try {
          const settings = (await window.k8sPlugin.settings.get()) ?? {};
          if (settings.showSystemNamespaces !== undefined) {
            setShowSystem(settings.showSystemNamespaces);
          }
          const refreshSecs = settings.refreshInterval ?? 30;
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(fetchData, refreshSecs * 1000);
        } catch {
          // settings optional
        }
      })();
    }, [fetchData]);

    // Fetch resource counts once namespaces and context are known
    useEffect(() => {
      if (namespaces.length > 0 && context) {
        fetchCounts(namespaces, context);
      }
    }, [namespaces, context, fetchCounts]);

    const filtered = useMemo(() => {
      let list = namespaces;
      if (!showSystem)
        list = list.filter((ns) => !isSystemNamespace(ns.metadata?.name ?? ''));
      if (search.trim()) {
        const q = search.toLowerCase();
        list = list.filter((ns) =>
          (ns.metadata?.name ?? '').toLowerCase().includes(q)
        );
      }
      return list;
    }, [namespaces, showSystem, search]);

    const stats = useMemo(() => {
      const total = namespaces.length;
      const active = namespaces.filter(
        (ns) => ns.status?.phase === 'Active'
      ).length;
      const terminating = namespaces.filter(
        (ns) => ns.status?.phase === 'Terminating'
      ).length;
      const system = namespaces.filter((ns) =>
        isSystemNamespace(ns.metadata?.name ?? '')
      ).length;
      return { total, active, terminating, system };
    }, [namespaces]);

    function toggleRow(name) {
      setExpandedRow((prev) => (prev === name ? null : name));
    }

    // --- Render ---

    if (loading && namespaces.length === 0) {
      return React.createElement(
        'div',
        { className: 'nw-container nw-loading-state' },
        React.createElement(Spinner, { size: 'large' }),
        React.createElement(
          'p',
          { className: 'nw-loading-text' },
          'Loading namespaces...'
        )
      );
    }

    if (error) {
      return React.createElement(
        'div',
        { className: 'nw-container nw-error-state' },
        React.createElement(AlertTriangle, { size: 40, color: '#ef4444' }),
        React.createElement('h3', null, 'Failed to load namespaces'),
        React.createElement('p', { className: 'nw-error-msg' }, error),
        React.createElement(
          Button,
          { onClick: fetchData, variant: 'secondary' },
          React.createElement(RefreshCw, { size: 14 }),
          ' Retry'
        )
      );
    }

    return React.createElement(
      'div',
      { className: 'nw-container' },

      // ── Top Bar ──────────────────────────────────────────────────────────────
      React.createElement(
        'div',
        { className: 'nw-topbar' },
        React.createElement(
          'div',
          { className: 'nw-topbar-left' },
          React.createElement(Eye, { size: 20, className: 'nw-title-icon' }),
          React.createElement(
            'h2',
            { className: 'nw-title' },
            'Namespace Watcher'
          ),
          context
            ? React.createElement(
                'span',
                { className: 'nw-context-badge' },
                React.createElement(Server, { size: 11 }),
                context
              )
            : null
        ),
        React.createElement(
          'div',
          { className: 'nw-topbar-right' },
          React.createElement(
            'div',
            { className: 'nw-search-wrap' },
            React.createElement(Search, {
              size: 14,
              className: 'nw-search-icon',
            }),
            React.createElement('input', {
              className: 'nw-search',
              placeholder: 'Search namespaces...',
              value: search,
              onChange: (e) => setSearch(e.target.value),
            })
          ),
          React.createElement(
            'button',
            {
              className: `nw-mini-btn ${showSystem ? 'nw-mini-btn--active' : ''}`,
              onClick: () => setShowSystem((v) => !v),
              title: 'Toggle system namespaces',
            },
            React.createElement(Shield, { size: 13 }),
            showSystem ? 'Hide System' : 'Show System'
          ),
          React.createElement(
            'button',
            {
              className: 'nw-mini-btn',
              onClick: fetchData,
              disabled: loading,
              title: 'Refresh',
            },
            React.createElement(RefreshCw, {
              size: 13,
              className: loading ? 'nw-spin' : '',
            }),
            'Refresh'
          )
        )
      ),

      // ── Stats Cards ──────────────────────────────────────────────────────────
      React.createElement(
        'div',
        { className: 'nw-stats-row' },
        React.createElement(StatCard, {
          label: 'Total',
          value: stats.total,
          icon: React.createElement(Layers, { size: 20 }),
          color: '#3b82f6',
          sub: `${filtered.length} shown`,
        }),
        React.createElement(StatCard, {
          label: 'Active',
          value: stats.active,
          icon: React.createElement(CheckCircle2, { size: 20 }),
          color: '#10b981',
        }),
        React.createElement(StatCard, {
          label: 'Terminating',
          value: stats.terminating,
          icon: React.createElement(AlertTriangle, { size: 20 }),
          color: stats.terminating > 0 ? '#f59e0b' : '#6b7280',
        }),
        React.createElement(StatCard, {
          label: 'System',
          value: stats.system,
          icon: React.createElement(Shield, { size: 20 }),
          color: '#8b5cf6',
        })
      ),

      // ── Table ────────────────────────────────────────────────────────────────
      React.createElement(
        'div',
        { className: 'nw-table-wrap' },
        React.createElement(
          'div',
          { className: 'nw-table-header-bar' },
          React.createElement(
            'span',
            { className: 'nw-table-count' },
            `${filtered.length} namespace${filtered.length !== 1 ? 's' : ''}`
          ),
          lastSync
            ? React.createElement(
                'span',
                { className: 'nw-last-sync' },
                React.createElement(Activity, { size: 11 }),
                `Last sync: ${new Date(lastSync).toLocaleTimeString()}`
              )
            : null,
          countsLoading
            ? React.createElement(
                'span',
                { className: 'nw-counts-loading' },
                React.createElement(Spinner, { size: 'small' }),
                'Loading counts...'
              )
            : null
        ),
        React.createElement(
          'div',
          { className: 'nw-table-scroll' },
          filtered.length === 0
            ? React.createElement(
                'div',
                { className: 'nw-empty' },
                React.createElement(Globe, { size: 36, color: '#475569' }),
                React.createElement(
                  'p',
                  null,
                  search
                    ? 'No namespaces match your search.'
                    : 'No namespaces found.'
                )
              )
            : React.createElement(
                'table',
                { className: 'nw-table' },
                React.createElement(
                  'thead',
                  null,
                  React.createElement(
                    'tr',
                    null,
                    React.createElement('th', { className: 'nw-th' }, 'Name'),
                    React.createElement('th', { className: 'nw-th' }, 'Phase'),
                    React.createElement(
                      'th',
                      { className: 'nw-th nw-th--num' },
                      'Pods'
                    ),
                    React.createElement(
                      'th',
                      { className: 'nw-th nw-th--num' },
                      'Deployments'
                    ),
                    React.createElement(
                      'th',
                      { className: 'nw-th nw-th--num' },
                      'Services'
                    ),
                    React.createElement(
                      'th',
                      { className: 'nw-th nw-th--age' },
                      'Age'
                    )
                  )
                ),
                React.createElement(
                  'tbody',
                  null,
                  filtered.map((ns) => {
                    const name = ns.metadata?.name;
                    return React.createElement(NamespaceRow, {
                      key: name,
                      ns,
                      expanded: expandedRow === name,
                      onToggle: () => toggleRow(name),
                      resourceCounts,
                      context,
                    });
                  })
                )
              )
        )
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------

  pluginUIRegistry.registerPage({
    id: 'namespace-watcher',
    component: NamespaceWatcherPage,
  });
})();

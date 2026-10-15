import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  Terminal,
  Search,
  X,
  Check,
  Copy,
  Radio,
  ArrowDownToLine,
  RotateCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { BaseModal } from './BaseModal';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { useApi } from '../../services/api-context';
import {
  appendLogLines,
  EMPTY_LOG_BUFFER,
  MAX_BUFFERED_LINES,
  useLogStream,
} from '../../features/logs/useLogStream';
import type {
  LogBuffer,
  LogStreamState,
} from '../../features/logs/useLogStream';

/** Distance from the bottom (px) that still counts as "at the bottom". */
const BOTTOM_SLACK_PX = 24;

interface LogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterName: string;
  podName: string;
  namespace: string;
  /** Container names of the pod; a picker appears when there is more than one. */
  containers?: string[];
}

function footerStatusText(
  follow: boolean,
  stream: LogStreamState,
  buffer: LogBuffer,
  tailLines: number
): string {
  let text: string;
  if (!follow) {
    text =
      buffer.source === 'stream'
        ? 'Follow stopped'
        : `Snapshot: last ${tailLines} lines`;
  } else if (stream.status === 'live') {
    text = 'Live: following new lines';
  } else if (stream.status === 'ended') {
    text = 'Stream ended';
  } else {
    text = 'Connecting to the log stream...';
  }
  if (buffer.truncated) {
    text += ` (last ${MAX_BUFFERED_LINES.toLocaleString('en-US')} lines kept)`;
  }
  return text;
}

function emptyText(
  searchQuery: string,
  follow: boolean,
  stream: LogStreamState
): string {
  if (searchQuery) return 'No matches found.';
  if (follow && stream.status === 'live') return 'Waiting for new lines...';
  if (follow && stream.status === 'connecting') return 'Connecting...';
  return 'No logs.';
}

export function LogViewerModal({
  isOpen,
  onClose,
  clusterName,
  podName,
  namespace,
  containers = [],
}: LogViewerModalProps) {
  const api = useApi();
  const [buffer, setBuffer] = useState<LogBuffer>(EMPTY_LOG_BUFFER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [container, setContainer] = useState<string | undefined>(undefined);
  const [tailLines] = useState(200);
  // Follow mode belongs to one pod: a different pod starts without it.
  const podKey = `${clusterName}/${namespace}/${podName}`;
  const [followKey, setFollowKey] = useState<string | null>(null);
  const follow = followKey === podKey;
  // Auto-scroll sticks to the bottom until the user scrolls up.
  const [pinned, setPinned] = useState(true);
  const pinnedRef = useRef(true);
  const followRef = useRef(follow);
  const scrollRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Snapshot fetches read the latest mode without re-running on toggles.
  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  // A different pod starts from a blank viewer: the previous pod's lines
  // must not show as the new pod's while its logs load.
  useEffect(() => {
    setBuffer(EMPTY_LOG_BUFFER);
    setError(null);
    setContainer(undefined);
    // Coming back to the followed pod later starts from a snapshot too.
    setFollowKey(null);
  }, [podName, namespace]);

  const pinToBottom = useCallback(() => {
    pinnedRef.current = true;
    setPinned(true);
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const { stream, reconnect } = useLogStream({
    enabled: isOpen && follow,
    contextName: clusterName,
    podName,
    namespace,
    container,
    onStarted: () => {
      setBuffer({ ...EMPTY_LOG_BUFFER, source: 'stream' });
      setError(null);
      pinToBottom();
    },
    onLines: (lines) => setBuffer((prev) => appendLogLines(prev, lines)),
  });

  const fetchLogs = useCallback(
    async (isAuto = false) => {
      if (!podName || !namespace || !clusterName) return;
      if (!isAuto) setLoading(true);
      setError(null);
      try {
        const result = await api.getLogs({
          contextName: clusterName,
          podName,
          namespace,
          tailLines,
          container,
        });
        // Follow was turned on meanwhile: the stream owns the lines now.
        if (followRef.current) return;
        if (result.success) {
          setBuffer({
            lines: (result.data || 'No logs found.').split('\n'),
            truncated: false,
            source: 'snapshot',
          });
        } else {
          setError(result.error);
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'An unexpected error occurred'
        );
      } finally {
        if (!isAuto) setLoading(false);
      }
    },
    [api, podName, namespace, clusterName, tailLines, container]
  );

  // Snapshot mode: fetch on open and when the pod or container changes.
  // While following, the stream supplies the lines instead.
  useEffect(() => {
    if (isOpen && !followRef.current) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  useEffect(() => {
    if (isOpen && autoRefresh && !follow) {
      refreshIntervalRef.current = setInterval(() => fetchLogs(true), 5000);
    } else {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [isOpen, autoRefresh, follow, fetchLogs]);

  const filteredLines = searchQuery
    ? buffer.lines.filter((line) =>
        line.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : buffer.lines;
  const filteredLogs = filteredLines.join('\n');

  // Keep the newest line in view unless the user scrolled up to read.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [filteredLogs]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SLACK_PX;
    if (atBottom !== pinnedRef.current) {
      pinnedRef.current = atBottom;
      setPinned(atBottom);
    }
  };

  const toggleFollow = () => {
    if (follow) {
      // Stop the stream and keep its lines on screen.
      setFollowKey(null);
      return;
    }
    setAutoRefresh(false);
    setFollowKey(podKey);
  };

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(filteredLogs);
      toast.success('Logs copied to the clipboard');
    } catch {
      toast.error('Could not copy the logs');
    }
  };

  const headerActions = (
    <div className="log-header-actions">
      {containers.length > 1 && (
        <select
          aria-label="Container"
          className="log-container-select"
          value={container ?? containers[0]}
          onChange={(e) => setContainer(e.target.value)}
        >
          {containers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}
      <div className="log-search-container">
        <Search size={14} className="log-search-icon" />
        <input
          type="text"
          placeholder="Filter logs..."
          aria-label="Filter logs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="log-search-input"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="search-clear">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="log-refresh-controls">
        <button
          onClick={toggleFollow}
          className={cn('auto-refresh-toggle', follow && 'active')}
          aria-pressed={follow}
          title="Stream new lines as the pod writes them (kubectl logs -f)"
        >
          <Radio size={14} />
          <span>Follow</span>
        </button>
        {!follow && (
          <>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn('auto-refresh-toggle', autoRefresh && 'active')}
              title="Auto-refresh (5s)"
            >
              {autoRefresh ? <Check size={14} /> : null}
              <span>Auto-refresh</span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchLogs()}
              loading={loading}
              title="Refresh Now"
            >
              <RefreshCw size={18} />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void copyLogs()}
          disabled={buffer.lines.length === 0}
          title="Copy logs"
        >
          <Copy size={18} />
        </Button>
      </div>
    </div>
  );

  const ended = follow && stream.status === 'ended';
  const footerContent = (
    <>
      <p
        className={cn(
          'modal-footer-info',
          ended ? 'log-footer-ended' : 'modal-footer-info-accent'
        )}
        data-testid="log-stream-status"
      >
        {follow && stream.status === 'live' && (
          <span className="log-live-dot" aria-hidden="true" />
        )}
        {footerStatusText(follow, stream, buffer, tailLines)}
      </p>
      <button onClick={onClose} className="close-footer-button">
        Close
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Logs: ${podName}`}
      subtitle={`NS: ${namespace} | Cluster: ${clusterName}`}
      icon={<Terminal size={18} />}
      headerActions={headerActions}
      footer={footerContent}
      className="log-modal"
      width="90%"
      maxWidth="1200px"
      data-testid="log-modal"
    >
      {!follow && loading && buffer.lines.length === 0 ? (
        <div className="state-container">
          <Loader2 className="spinner" size={32} />
          <p>Fetching logs...</p>
        </div>
      ) : !follow && error ? (
        <div className="state-container">
          <AlertCircle size={32} className="log-error-icon" />
          <p className="error-title">Failed to load logs</p>
          <p className="error-message">{error}</p>
        </div>
      ) : (
        <div className="log-viewer-body">
          {follow && stream.status === 'ended' && (
            <div className="log-stream-ended" role="status">
              <AlertCircle size={16} className="log-error-icon" />
              <div className="log-stream-ended__text">
                <strong>The log stream ended.</strong>
                <span className="log-stream-ended__reason">
                  {stream.reason}
                </span>
              </div>
              <button className="log-stream-ended__retry" onClick={reconnect}>
                <RotateCw size={14} />
                <span>Reconnect</span>
              </button>
            </div>
          )}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="log-content-text code-block"
            data-testid="log-content"
          >
            {filteredLogs || emptyText(searchQuery, follow, stream)}
          </div>
          {(follow || autoRefresh) && !pinned && (
            <button className="log-jump-latest" onClick={pinToBottom}>
              <ArrowDownToLine size={14} />
              <span>Auto-scroll paused: jump to latest</span>
            </button>
          )}
        </div>
      )}
    </BaseModal>
  );
}

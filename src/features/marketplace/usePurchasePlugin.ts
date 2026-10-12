import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApi } from '../../services/api-context';
import { usePlugins } from '../plugins/PluginProvider';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PurchaseOptions {
  /** Poll interval while waiting for payment (default 2s). */
  pollIntervalMs?: number;
  /** Max polls before giving up (default 90 ≈ 3 min at 2s). */
  maxPolls?: number;
}

/** Where a purchase currently is; 'idle' means no purchase in flight. */
export type PurchasePhase =
  'idle' | 'starting' | 'awaiting-payment' | 'activating';

class PurchaseCancelledError extends Error {
  constructor() {
    super('Purchase cancelled');
  }
}

class PurchaseTimeoutError extends Error {
  constructor() {
    super('Payment was not completed in time');
  }
}

/**
 * Orchestrates a paid-plugin purchase against the marketplace backend:
 * create a checkout session, open the payment page, poll until paid, then
 * activate the returned license and install the plugin.
 *
 * The user can abandon the wait with `cancelPurchase()` (the backend has no
 * cancel endpoint — the checkout session simply expires unpaid), and a poll
 * budget overrun surfaces as a distinct "payment timed out" error.
 */
export function usePurchasePlugin(
  pluginId: string,
  pluginName: string,
  options: PurchaseOptions = {}
) {
  const api = useApi();
  const { activateLicense, installPlugin } = usePlugins();
  const [phase, setPhase] = useState<PurchasePhase>('idle');
  // Ref guard so two synchronous clicks can't both start a purchase (state
  // updates are async and would let the second call through).
  const inFlight = useRef(false);
  const cancelled = useRef(false);

  const pollInterval = options.pollIntervalMs ?? 2000;
  const maxPolls = options.maxPolls ?? 90;
  const timeoutMinutes = Math.max(
    1,
    Math.round((pollInterval * maxPolls) / 60000)
  );

  // Sleep in short slices so a cancel takes effect quickly instead of after
  // a full poll interval.
  const sleepUnlessCancelled = async (ms: number) => {
    const step = 250;
    for (let waited = 0; waited < ms && !cancelled.current; waited += step) {
      await sleep(Math.min(step, ms - waited));
    }
  };

  const pollForLicense = async (sessionId: string): Promise<string> => {
    for (let i = 0; i < maxPolls; i++) {
      if (cancelled.current) throw new PurchaseCancelledError();
      const res = await api.getCheckoutStatus(sessionId);
      if (res.success && res.data?.status === 'paid' && res.data.licenseKey) {
        return res.data.licenseKey;
      }
      await sleepUnlessCancelled(pollInterval);
    }
    if (cancelled.current) throw new PurchaseCancelledError();
    throw new PurchaseTimeoutError();
  };

  /** Stop waiting for the payment; takes effect within one poll interval. */
  const cancelPurchase = () => {
    cancelled.current = true;
  };

  const handlePurchase = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    cancelled.current = false;
    setPhase('starting');
    const toastId = toast.loading(`Starting purchase for ${pluginName}...`);
    try {
      const checkout = await api.createCheckout(pluginId);
      if (!checkout.success) {
        throw new Error(checkout.error || 'Could not start checkout');
      }
      const { sessionId, url } = checkout.data;

      // Open the payment page in the user's browser.
      await api.openExternal(url);
      setPhase('awaiting-payment');
      toast.loading('Complete the payment in your browser...', { id: toastId });

      const licenseKey = await pollForLicense(sessionId);
      setPhase('activating');
      toast.loading(`Payment received. Activating ${pluginName}...`, {
        id: toastId,
      });

      await activateLicense(pluginId, licenseKey);
      await installPlugin(pluginId);
      toast.success(`${pluginName} purchased and installed!`, { id: toastId });
    } catch (err: unknown) {
      if (err instanceof PurchaseCancelledError) {
        toast.info(
          `Purchase of ${pluginName} cancelled. You have not been charged unless you completed the payment in the browser.`,
          { id: toastId }
        );
      } else if (err instanceof PurchaseTimeoutError) {
        toast.error(
          `Payment was not confirmed after ${timeoutMinutes} minute${timeoutMinutes === 1 ? '' : 's'}. If you completed it, contact support; otherwise try again.`,
          { id: toastId }
        );
      } else {
        const msg = err instanceof Error ? err.message : 'Purchase failed';
        toast.error(msg, { id: toastId });
      }
    } finally {
      inFlight.current = false;
      setPhase('idle');
    }
  };

  return {
    /** True from click until success/cancel/timeout/error. */
    purchasing: phase !== 'idle',
    /** True while the browser payment page is open and we are polling. */
    awaitingPayment: phase === 'awaiting-payment',
    phase,
    handlePurchase,
    cancelPurchase,
  };
}

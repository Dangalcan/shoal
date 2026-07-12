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

/**
 * Orchestrates a paid-plugin purchase against the marketplace backend:
 * create a checkout session, open the payment page, poll until paid, then
 * activate the returned license and install the plugin.
 */
export function usePurchasePlugin(
  pluginId: string,
  pluginName: string,
  options: PurchaseOptions = {}
) {
  const api = useApi();
  const { activateLicense, installPlugin } = usePlugins();
  const [purchasing, setPurchasing] = useState(false);
  // Ref guard so two synchronous clicks can't both start a purchase (state
  // updates are async and would let the second call through).
  const inFlight = useRef(false);

  const pollInterval = options.pollIntervalMs ?? 2000;
  const maxPolls = options.maxPolls ?? 90;

  const pollForLicense = async (sessionId: string): Promise<string> => {
    for (let i = 0; i < maxPolls; i++) {
      const res = await api.getCheckoutStatus(sessionId);
      if (res.success && res.data?.status === 'paid' && res.data.licenseKey) {
        return res.data.licenseKey;
      }
      await sleep(pollInterval);
    }
    throw new Error('Payment was not completed in time.');
  };

  const handlePurchase = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPurchasing(true);
    const toastId = toast.loading(`Starting purchase for ${pluginName}...`);
    try {
      const checkout = await api.createCheckout(pluginId);
      if (!checkout.success) {
        throw new Error(checkout.error || 'Could not start checkout');
      }
      const { sessionId, url } = checkout.data;

      // Open the payment page in the user's browser.
      await api.openExternal(url);
      toast.loading('Complete the payment in your browser...', { id: toastId });

      const licenseKey = await pollForLicense(sessionId);
      toast.loading(`Payment received. Activating ${pluginName}...`, {
        id: toastId,
      });

      await activateLicense(pluginId, licenseKey);
      await installPlugin(pluginId);
      toast.success(`${pluginName} purchased and installed!`, { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Purchase failed';
      toast.error(msg, { id: toastId });
    } finally {
      inFlight.current = false;
      setPurchasing(false);
    }
  };

  return { purchasing, handlePurchase };
}

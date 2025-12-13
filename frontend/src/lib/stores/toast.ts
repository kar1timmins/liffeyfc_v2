import { writable } from 'svelte/store';

export type ToastType = 'success' | 'info' | 'warning' | 'error';
export type Toast = {
  id: string;
  type: ToastType;
  message: string | null;
  ttl?: number;
  // Optional grouping key to avoid overlapping related toasts (e.g., contract deploys)
  group?: string;
  // Optional structured data for rich toasts (e.g., { campaignName, addresses: [{chain, address}] })
  data?: Record<string, any>;
};

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function add({
    message,
    type = 'info',
    ttl = 4000,
    group,
    data,
  }: {
    message: string | null;
    type?: ToastType;
    ttl?: number;
    group?: string;
    data?: Record<string, any>;
  }) {
    const id = Math.random().toString(36).slice(2, 9);
    const toast: Toast = { id, type, message, ttl, group, data };
    update((t) => {
      if (group) {
        // remove any existing toasts for this group (prevents overlapping contract toasts)
        t = t.filter((x) => x.group !== group);
      }
      return [...t, toast];
    });
    if (ttl && ttl > 0) {
      setTimeout(() => remove(id), ttl);
    }
    return id;
  }

  function remove(id: string) {
    update((t) => t.filter((x) => x.id !== id));
  }

  function clear() {
    update(() => []);
  }
  return { subscribe, add, remove, clear };
}

export const toastStore = createToastStore();
export default toastStore;

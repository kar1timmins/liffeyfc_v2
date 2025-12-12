import { writable } from 'svelte/store';

export type ToastType = 'success' | 'info' | 'warning' | 'error';
export type Toast = { id: string; type: ToastType; message: string | null; ttl?: number };

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function add({ message, type = 'info', ttl = 4000 }: { message: string | null; type?: ToastType; ttl?: number }) {
    const id = Math.random().toString(36).slice(2, 9);
    const toast: Toast = { id, type, message, ttl };
    update((t) => [...t, toast]);
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

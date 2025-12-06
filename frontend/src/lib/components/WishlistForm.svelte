<script lang="ts">
  import { Plus, X, Target, AlertCircle, Euro } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';
  import { toastStore } from '$lib/stores/toast';

  let {
    companyId,
    onItemAdded = () => {}
  }: {
    companyId: string;
    onItemAdded?: () => void;
  } = $props();

  let isFormOpen = $state(false);
  let isSubmitting = $state(false);

  let formData = $state({
    title: '',
    description: '',
    value: '',
    category: 'funding',
    priority: 'medium'
  });

  const categories = [
    { value: 'funding', label: '💰 Funding', icon: 'Funding' },
    { value: 'talent', label: '👥 Talent', icon: 'Talent' },
    { value: 'mentorship', label: '🎓 Mentorship', icon: 'Mentorship' },
    { value: 'partnerships', label: '🤝 Partnerships', icon: 'Partnerships' },
    { value: 'resources', label: '🛠️ Resources', icon: 'Resources' },
    { value: 'technology', label: '⚙️ Technology', icon: 'Technology' },
    { value: 'marketing', label: '📢 Marketing', icon: 'Marketing' },
    { value: 'other', label: '✨ Other', icon: 'Other' }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: 'badge-ghost' },
    { value: 'medium', label: 'Medium', color: 'badge-info' },
    { value: 'high', label: 'High', color: 'badge-warning' },
    { value: 'critical', label: 'Critical', color: 'badge-error' }
  ];

  function resetForm() {
    formData = {
      title: '',
      description: '',
      value: '',
      category: 'funding',
      priority: 'medium'
    };
  }

  function toggleForm() {
    isFormOpen = !isFormOpen;
    if (!isFormOpen) {
      resetForm();
    }
  }

  async function handleSubmit() {
    if (!formData.title.trim()) {
      toastStore.add({ message: 'Title is required', type: 'error' });
      return;
    }

    isSubmitting = true;

    try {
      const verified = await authStore.verify();
      if (!verified) {
        throw new Error('Please log in again');
      }

      const token = $authStore.accessToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const payload: any = {
        title: formData.title.trim(),
        category: formData.category,
        priority: formData.priority
      };

      if (formData.description.trim()) {
        payload.description = formData.description.trim();
      }

      if (formData.value && !isNaN(parseFloat(formData.value))) {
        payload.value = parseFloat(formData.value);
      }

      const response = await fetch(`${PUBLIC_API_URL}/companies/${companyId}/wishlist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        toastStore.add({ 
          message: '✨ Wishlist item added successfully!', 
          type: 'success',
          ttl: 3000 
        });
        resetForm();
        isFormOpen = false;
        onItemAdded();
      } else {
        toastStore.add({ 
          message: result.message || 'Failed to add wishlist item', 
          type: 'error' 
        });
      }
    } catch (err: any) {
      toastStore.add({ 
        message: err.message || 'An error occurred', 
        type: 'error' 
      });
    } finally {
      isSubmitting = false;
    }
  }

  function getCategoryLabel(value: string) {
    return categories.find(c => c.value === value)?.label || value;
  }
</script>

<div class="w-full">
  {#if !isFormOpen}
    <button
      class="btn btn-sm btn-outline gap-2 w-full"
      onclick={toggleForm}
    >
      <Plus class="w-4 h-4" />
      Add Wishlist Item
    </button>
  {:else}
    <div class="bg-gradient-to-br from-base-100 to-base-200 rounded-xl p-5 border border-base-300 shadow-md">
      <!-- Header -->
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-primary/20 rounded-lg">
            <Target class="w-4 h-4 text-primary" />
          </div>
          <h4 class="font-bold text-base">Add to Wishlist</h4>
        </div>
        <button
          class="btn btn-ghost btn-xs btn-circle"
          onclick={toggleForm}
          aria-label="Close form"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
        <!-- Title & Description Section -->
        <div class="space-y-3">
          <div class="form-control">
            <label class="label p-1" for="wishlist-title">
              <span class="label-text font-semibold text-sm">What are you looking for? *</span>
            </label>
            <input
              id="wishlist-title"
              type="text"
              bind:value={formData.title}
              placeholder="e.g., Seed funding round"
              class="input input-bordered input-sm focus:ring-2 focus:ring-primary"
              required
              disabled={isSubmitting}
            />
          </div>

          <div class="form-control">
            <label class="label p-1" for="wishlist-description">
              <span class="label-text font-semibold text-sm">Details</span>
              <span class="label-text-alt text-xs opacity-60">Provide context or specifics</span>
            </label>
            <textarea
              id="wishlist-description"
              bind:value={formData.description}
              placeholder="Describe what you need in detail..."
              class="textarea textarea-bordered textarea-sm h-16 resize-none focus:ring-2 focus:ring-primary"
              disabled={isSubmitting}
            ></textarea>
          </div>
        </div>

        <!-- Category & Priority Section -->
        <div class="divider my-3"></div>
        
        <div class="space-y-3">
          <h5 class="text-sm font-semibold">Category & Priority</h5>
          
          <div class="grid grid-cols-2 gap-3">
            <!-- Category -->
            <div class="form-control">
              <label class="label p-1" for="wishlist-category">
                <span class="label-text text-xs opacity-70">Type</span>
              </label>
              <select
                id="wishlist-category"
                bind:value={formData.category}
                class="select select-bordered select-sm focus:ring-2 focus:ring-primary"
                disabled={isSubmitting}
              >
                {#each categories as cat}
                  <option value={cat.value}>{cat.label}</option>
                {/each}
              </select>
            </div>

            <!-- Priority -->
            <div class="form-control">
              <label class="label p-1" for="wishlist-priority">
                <span class="label-text text-xs opacity-70">Priority</span>
              </label>
              <select
                id="wishlist-priority"
                bind:value={formData.priority}
                class="select select-bordered select-sm focus:ring-2 focus:ring-primary"
                disabled={isSubmitting}
              >
                {#each priorities as pri}
                  <option value={pri.value}>{pri.label}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <!-- Value Section -->
        <div class="divider my-3"></div>
        
        <div class="form-control">
          <label class="label p-1" for="wishlist-value">
            <span class="label-text font-semibold text-sm flex items-center gap-1">
              <Euro class="w-4 h-4 text-success" />
              Target Value
            </span>
            <span class="label-text-alt text-xs opacity-60">Amount needed in EUR</span>
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-lg opacity-60">€</span>
            <input
              id="wishlist-value"
              type="number"
              bind:value={formData.value}
              placeholder="50000"
              step="1000"
              min="0"
              class="input input-bordered input-sm pl-8 focus:ring-2 focus:ring-primary w-full"
              disabled={isSubmitting}
            />
          </div>
          {#if formData.value}
            <p class="text-xs opacity-60 mt-1">
              €{parseFloat(formData.value).toLocaleString('de-DE')}
            </p>
          {/if}
        </div>

        <!-- Action Buttons -->
        <div class="divider my-3"></div>
        
        <div class="flex gap-2 justify-end">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onclick={toggleForm}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-primary btn-sm gap-1"
            disabled={isSubmitting || !formData.title.trim()}
          >
            {#if isSubmitting}
              <span class="loading loading-spinner loading-xs"></span>
              Adding...
            {:else}
              <Plus class="w-4 h-4" />
              Add Item
            {/if}
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>

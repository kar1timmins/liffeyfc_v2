<script lang="ts">
  import { Plus, X } from 'lucide-svelte';
  import { PUBLIC_API_URL } from '$env/static/public';
  import { authStore } from '$lib/stores/auth';

  let {
    companyId,
    onItemAdded = () => {}
  }: {
    companyId: string;
    onItemAdded?: () => void;
  } = $props();

  let isFormOpen = $state(false);
  let isSubmitting = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);

  let formData = $state({
    title: '',
    description: '',
    value: '',
    category: 'other',
    priority: 'medium'
  });

  const categories = [
    { value: 'funding', label: 'Funding' },
    { value: 'talent', label: 'Talent' },
    { value: 'mentorship', label: 'Mentorship' },
    { value: 'partnerships', label: 'Partnerships' },
    { value: 'resources', label: 'Resources' },
    { value: 'technology', label: 'Technology' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'other', label: 'Other' }
  ];

  const priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ];

  function resetForm() {
    formData = {
      title: '',
      description: '',
      value: '',
      category: 'other',
      priority: 'medium'
    };
    error = null;
    success = false;
  }

  function toggleForm() {
    isFormOpen = !isFormOpen;
    if (!isFormOpen) {
      resetForm();
    }
  }

  async function handleSubmit() {
    if (!formData.title.trim()) {
      error = 'Title is required';
      return;
    }

    isSubmitting = true;
    error = null;
    success = false;

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
        success = true;
        setTimeout(() => {
          resetForm();
          isFormOpen = false;
          onItemAdded();
        }, 1500);
      } else {
        error = result.message || 'Failed to add wishlist item';
      }
    } catch (err: any) {
      error = err.message || 'An error occurred';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="my-6">
  {#if !isFormOpen}
    <button
      class="btn btn-primary btn-sm"
      onclick={toggleForm}
    >
      <Plus class="w-4 h-4" />
      Add Wishlist Item
    </button>
  {:else}
    <div class="glass-subtle rounded-xl p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">Add Wishlist Item</h3>
        <button
          class="btn btn-ghost btn-sm btn-circle"
          onclick={toggleForm}
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
        <!-- Title -->
        <div class="form-control">
          <label class="label" for="wishlist-title">
            <span class="label-text">Title *</span>
          </label>
          <input
            id="wishlist-title"
            type="text"
            bind:value={formData.title}
            placeholder="e.g., Looking for seed funding"
            class="input input-bordered w-full"
            required
          />
        </div>

        <!-- Description -->
        <div class="form-control">
          <label class="label" for="wishlist-description">
            <span class="label-text">Description</span>
          </label>
          <textarea
            id="wishlist-description"
            bind:value={formData.description}
            placeholder="Provide more details about what you're looking for..."
            class="textarea textarea-bordered h-24"
          ></textarea>
        </div>

        <!-- Value -->
        <div class="form-control">
          <label class="label" for="wishlist-value">
            <span class="label-text">Value (Optional)</span>
            <span class="label-text-alt">Estimated monetary value</span>
          </label>
          <input
            id="wishlist-value"
            type="number"
            bind:value={formData.value}
            placeholder="e.g., 50000"
            step="0.01"
            min="0"
            class="input input-bordered w-full"
          />
        </div>

        <!-- Category and Priority -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label" for="wishlist-category">
              <span class="label-text">Category</span>
            </label>
            <select
              id="wishlist-category"
              bind:value={formData.category}
              class="select select-bordered w-full"
            >
              {#each categories as cat}
                <option value={cat.value}>{cat.label}</option>
              {/each}
            </select>
          </div>

          <div class="form-control">
            <label class="label" for="wishlist-priority">
              <span class="label-text">Priority</span>
            </label>
            <select
              id="wishlist-priority"
              bind:value={formData.priority}
              class="select select-bordered w-full"
            >
              {#each priorities as pri}
                <option value={pri.value}>{pri.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Error Message -->
        {#if error}
          <div class="alert alert-error">
            <span class="text-sm">{error}</span>
          </div>
        {/if}

        <!-- Success Message -->
        {#if success}
          <div class="alert alert-success">
            <span class="text-sm">Wishlist item added successfully!</span>
          </div>
        {/if}

        <!-- Submit Button -->
        <div class="flex gap-2 justify-end">
          <button
            type="button"
            class="btn btn-ghost"
            onclick={toggleForm}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={isSubmitting || !formData.title.trim()}
          >
            {#if isSubmitting}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Plus class="w-4 h-4" />
            {/if}
            Add Item
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>

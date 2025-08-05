<script lang="ts">
  import { river } from '$lib/river';
  const transition = (node: Element, params = {}) => river(node, params);
</script>

<main in:transition out:transition class="min-h-screen bg-white border-4 border-accent overflow-hidden">
  <slot />
</main>
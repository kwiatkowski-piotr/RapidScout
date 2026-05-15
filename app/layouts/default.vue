<template>
  <div>
    <header class="flex justify-between items-center px-4 sm:px-8 py-4 border-b border-default">
      <div>
        <h1 class="text-xl font-bold">RapidScout</h1>
        <p class="text-sm text-muted">
          LSports Incidents.Extracted analyzer
        </p>
      </div>
    </header>
    <main class="px-4 sm:px-8 py-6 max-w-7xl mx-auto">
      <slot />
    </main>
  </div>
</template>

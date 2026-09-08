<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  title: string;
  value: string | number;
  unit?: string;
  subText?: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  icon?: Component;
}>();
</script>

<template>
  <div class="metric-card" :class="`variant-${variant || 'primary'}`">
    <div class="metric-content">
      <span class="metric-title">{{ title }}</span>
      <div class="metric-value-wrap">
        <span class="metric-value">{{ value }}</span>
        <span v-if="unit" class="metric-unit">{{ unit }}</span>
      </div>
      <span v-if="subText" class="metric-sub">{{ subText }}</span>
    </div>
    <div v-if="icon" class="metric-icon-wrap">
      <component :is="icon" :size="24" />
    </div>
  </div>
</template>

<style scoped>
.metric-card {
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s, box-shadow 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.metric-content {
  display: flex;
  flex-direction: column;
}

.metric-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.metric-value-wrap {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.metric-value {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
}

.metric-unit {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
}

.metric-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 4px;
}

.metric-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Variant styles */
.variant-primary .metric-icon-wrap { background: #dcfce7; color: #15803d; }
.variant-success .metric-icon-wrap { background: #d1fae5; color: #059669; }
.variant-warning .metric-icon-wrap { background: #fef3c7; color: #d97706; }
.variant-danger .metric-icon-wrap { background: #fee2e2; color: #dc2626; }
.variant-info .metric-icon-wrap { background: #e0f2fe; color: #0284c7; }
</style>

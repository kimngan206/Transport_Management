<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AdminLayout from '@/layouts/AdminLayout.vue';
import GlobalFeedbackModal from '@/components/common/GlobalFeedbackModal.vue';

const route = useRoute();
const isLoginPage = computed(() => route.path === '/login');
</script>

<template>
  <router-view v-if="isLoginPage" />
  <AdminLayout v-else />
  <GlobalFeedbackModal />
</template>

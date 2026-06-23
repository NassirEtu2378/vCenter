<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="modal-overlay"
      :class="overlayClass"
      :style="overlayStyle"
      @click.self="handleOverlayClick"
    >
      <div
        class="modal-panel"
        :class="panelClass"
        :style="panelStyle"
        role="dialog"
        aria-modal="true"
      >
        <header class="modal-header">
          <h3>{{ title }}</h3>
          <button type="button" class="close-button" @click="close">×</button>
        </header>

        <div class="modal-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { Teleport, computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: 'min(720px, 90%)' },
  height: { type: String, default: '200px' },
  maxHeight: { type: String, default: '320px' },
  zIndex: { type: Number, default: 60 },
  closeOnOverlayClick: { type: Boolean, default: true },
  overlayClass: { type: String, default: '' },
  panelClass: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const overlayStyle = computed(() => ({
  zIndex: props.zIndex,
}))

const panelStyle = computed(() => ({
  width: props.width,
  height: props.height,
  maxHeight: props.maxHeight,
}))

function close() {
  emit('close')
}

function handleOverlayClick() {
  if (props.closeOnOverlayClick) {
    close()
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-panel {
  background: #fff;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  height: 100px;
  max-height: 120px;
  overflow: hidden;
  box-shadow: 0 22px 44px rgba(0, 0, 0, 0.18);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
}

.close-button {
  background: transparent;
  border: none;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: auto;
  min-height: 0;
}

.modal-overlay.full-history-overlay {
  background: rgba(0, 0, 0, 0.32);
}

.modal-panel.full-history-panel {
  transform: translateY(-12px);
}
</style>

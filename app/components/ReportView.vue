<script setup lang="ts">
import type { Report } from '#shared/types/report'

defineProps<{
  report: Report
}>()

const { formatPrice, formatWeight, formatDateTime } = useFormatters()
</script>

<template>
  <div class="space-y-4">
    <section class="ui-card relative overflow-hidden px-4 py-5">
      <div class="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-brand/25 blur-2xl" />
      <p class="relative text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand">Итог дня</p>
      <p
        class="relative mt-1 text-[2rem] font-extrabold leading-none tracking-tight tabular-nums"
        :class="report.net_profit >= 0 ? 'text-ink' : 'text-danger'"
      >
        {{ formatPrice(report.net_profit) }}
      </p>
      <p class="relative mt-2 text-xs font-medium text-muted">
        Чистая прибыль · {{ formatPrice(report.price_per_kg) }}/кг · себест. {{ formatPrice(report.cost_per_kg) }}/кг
      </p>
    </section>

    <UiStatGrid
      :items="[
        { label: 'Доходы', value: formatPrice(report.income_total), tone: 'accent' },
        { label: 'Расходы', value: formatPrice(report.expense_total), tone: 'danger' },
        { label: 'Выручка груза', value: formatPrice(report.paid_revenue) },
        { label: 'Себест. груза', value: formatPrice(report.cargo_cost), tone: 'danger' },
      ]"
    />

    <section class="ui-card space-y-3 px-4 py-4">
      <h2 class="text-sm font-bold text-ink">Склад сегодня</h2>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between gap-3">
          <span class="text-muted">Записей / вес</span>
          <span class="font-extrabold tabular-nums text-ink">{{ report.goods_count }} · {{ formatWeight(report.total_weight) }}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-muted">Оплачено</span>
          <span class="font-extrabold tabular-nums text-success">{{ report.paid_count }} · {{ formatWeight(report.paid_weight) }} · {{ formatPrice(report.paid_revenue) }}</span>
        </div>
        <div class="flex justify-between gap-3 border-t border-white/50 pt-2">
          <span class="font-bold text-ink">Маржа груза</span>
          <span class="font-extrabold tabular-nums text-brand">{{ formatPrice(report.cargo_margin) }}</span>
        </div>
      </div>
    </section>

    <section class="ui-card space-y-3 px-4 py-4">
      <h2 class="text-sm font-bold text-ink">Остатки (неоплачено)</h2>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between gap-3">
          <span class="text-muted">Записей</span>
          <span class="font-extrabold tabular-nums text-ink">{{ report.unpaid_count }}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-muted">Вес</span>
          <span class="font-extrabold tabular-nums text-ink">{{ formatWeight(report.unpaid_weight) }}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-muted">Сумма долга</span>
          <span class="font-extrabold tabular-nums text-danger">{{ formatPrice(report.unpaid_revenue) }}</span>
        </div>
      </div>
    </section>

    <section class="ui-card space-y-3 px-4 py-4">
      <h2 class="text-sm font-bold text-ink">Прочие операции</h2>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between gap-3">
          <span class="text-muted">Доходы</span>
          <span class="font-extrabold tabular-nums text-success">+{{ formatPrice(report.other_income) }}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-muted">Расходы</span>
          <span class="font-extrabold tabular-nums text-danger">−{{ formatPrice(report.other_expense) }}</span>
        </div>
      </div>
    </section>

    <section v-if="report.note" class="ui-card space-y-2 px-4 py-4">
      <h2 class="text-sm font-bold text-ink">Комментарий</h2>
      <p class="whitespace-pre-wrap text-sm text-ink">{{ report.note }}</p>
    </section>

    <p class="px-1 text-center text-[11px] text-muted">
      Создан {{ formatDateTime(report.created_at) }}
      <template v-if="report.created_by"> · {{ report.created_by }}</template>
      · без изменений
    </p>
  </div>
</template>

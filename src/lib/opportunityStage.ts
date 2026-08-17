/**
 * Цвет-вариант статусного тега (DC-16 `StatusTag`, `.a3-tag`) для стадии
 * Opportunity. Общий источник для списка Opportunities (`OpportunityList`)
 * и карточки Opportunity (`OpportunityCard`): одна и та же стадия обязана
 * получать одно и то же визуальное состояние на обоих экранах — текст
 * остаётся носителем смысла (правило 8), цвет только поддерживает его.
 */
export const STAGE_TAG: Record<string, string> = {
  'neu aus HubSpot': 'a3-blue',
  'in Vorbereitung': 'a3-orange',
  'versendet': 'a3-green',
}

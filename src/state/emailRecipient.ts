/**
 * Validated recipient fixtures used by client-facing email flows.
 *
 * The recipient is sourced from the existing synthetic HubSpot opportunity
 * contract; this module does not create transport state or a capture surface.
 */
export type ValidatedRecipient = Readonly<{
  address: string
  source: 'HubSpot'
}>

export const DEMO_HUBSPOT_RECIPIENT: ValidatedRecipient = Object.freeze({
  address: 'kontakt@beispiel-entwickler.example',
  source: 'HubSpot',
})

export function recipientForOpportunity(opportunityId: string | null): ValidatedRecipient | null {
  return opportunityId === 'DEMO-0001' ? DEMO_HUBSPOT_RECIPIENT : null
}

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

/**
 * VR3-01: keyed to the two demonstration projects that exist now. The
 * previous single `DEMO-0001` key belonged to the retired eight-row
 * portfolio; leaving it would have made every client email flow report
 * "no validated recipient" for both shipped projects.
 */
export function recipientForOpportunity(opportunityId: string | null): ValidatedRecipient | null {
  return opportunityId === 'DEMO-HAPPY-01' || opportunityId === 'DEMO-COMPLEX-01'
    ? DEMO_HUBSPOT_RECIPIENT
    : null
}

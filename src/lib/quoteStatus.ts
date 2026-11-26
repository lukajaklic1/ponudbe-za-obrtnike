
// A quote moves through these statuses:
//   enquiry     the customer sent an enquiry in the configurator: the supplier still has to make the offer
//   draft       the supplier's own work in progress (also what an enquiry becomes while it is being edited)
//   issued      the offer is made and locked, not sent yet
//   sent        the supplier sent the offer
//   won / lost  final
// "Not an offer yet" and "the offer is with the customer" are what most screens need to know.

/** the supplier still has work to do before an offer exists: it is edited, not read */
export const isDraftLike = (s: string | null | undefined) => s === 'draft' || s === 'enquiry'
/** the customer has the offer or it is decided */
export const isSentLike = (s: string | null | undefined) => s === 'sent' || s === 'won' || s === 'lost'
/** a quote that may still be won or lost */
export const isOpenOffer = (s: string | null | undefined) => s === 'sent'


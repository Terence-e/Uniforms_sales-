/**
 * Bilingual labels for every printed document (A-FR-7.10).
 *
 * These are deliberately NOT in messages/{en,fr}.json, and that is the whole
 * point of this module. A next-intl message resolves to ONE language -- whichever
 * the seller happened to have the UI in -- and the requirement is the opposite:
 * both languages on the same sheet, one template, so nobody picks a language
 * while a queue is waiting and neither language community complains.
 *
 * So a bilingual label is not a translation. It is a constant string that
 * happens to contain a slash, and it belongs in code next to the layout it has
 * to fit inside.
 *
 * French first throughout, matching the spec's own examples ("Recu par /
 * Received by", "Eleve / Student") and the fact that the school operates in a
 * francophone region.
 *
 * Values that are NOT labels -- money, dates, the school name -- still format by
 * locale. Only the labels are doubled.
 */
export const L = {
  // --------------------------------------------------------------- headings
  receiptTitle: 'Reçu / Receipt',
  orderTitle: 'Commande / Order',
  orderCancelled: 'Commande annulée / Order cancelled',
  depositTitle: 'Bon de dépôt / Deposit slip',
  collectionTitle: 'Retiré / Collected',

  // ------------------------------------------------------------- references
  receiptNo: 'N° reçu / Receipt no',
  orderNo: 'N° commande / Order no',
  slipNo: 'N° bon / Slip no',
  colNo: 'N° retrait / Collection no',
  ordNo: 'N° commande / Order no',

  // ------------------------------------------------------------------ dates
  date: 'Date / Date',
  receivedAt: 'Reçu le / Received on',
  collectedAt: 'Retiré le / Collected on',
  orderedAt: 'Commandé le / Ordered on',
  expectedReady: 'Prêt le / Ready by',

  // ------------------------------------------------------------------ people
  customer: 'Parent / Parent',
  student: 'Élève / Student',
  class: 'Classe / Class',
  phone: 'Téléphone / Phone',
  recordedBy: 'Saisi par / Recorded by',
  receivedBy: 'Reçu par / Received by',
  collectedBy: 'Retiré par / Collected by',
  handedOverBy: 'Remis par / Handed over by',
  alterationReceivedBy: 'Reçu par / Received by',

  // ------------------------------------------------------------------- items
  description: 'Article / Item',
  quantity: 'Qté / Qty',
  unitPrice: 'P.U. / Unit price',
  amount: 'Montant / Amount',
  value: 'Valeur / Value',
  garment: 'Vêtement / Garment',
  workRequired: 'Travaux demandés / Work required',
  measurements: 'Mesures / Measurements',

  // ------------------------------------------------------------------- money
  subtotal: 'Sous-total / Subtotal',
  discount: 'Remise / Discount',
  /** A-FR-7.8 asks for the discount AND its reason. */
  discountReason: 'Motif de la remise / Reason for discount',
  total: 'Total / Total',
  paymentMethod: 'Mode de paiement / Payment method',
  paymentReference: 'Référence / Reference',
  dueOnReturn: 'À payer au retrait / Due on collection',
  paid: 'Payé / Paid',
  noCharge: 'Sans frais / No charge',
  alreadyPaid: 'Payé à la commande · Paid when ordered',

  // -------------------------------------------------------------- signatures
  sellerSignature: 'Signature du vendeur / Seller signature',
  parentSignature: 'Signature du parent / Parent signature',
  collectorSignature: 'Signature du retirant / Collector signature',

  // ----------------------------------------------------------------- notices
  notCollected: 'Pas encore retiré · Not yet collected',
  collected: 'Retiré · Collected',
  refunded: 'Remboursée · Refunded',
  garmentHeld: 'Vêtement confié à l\u2019école · Garment held by the school'
} as const;

/**
 * Footer notices, in both languages.
 *
 * Stacked as two lines rather than slash-joined like the labels: these are
 * sentences, not field names, and "Merci de votre achat / Thank you for your
 * purchase. Les articles... / Goods sold..." is unreadable.
 *
 * This is not decoration. The sale footer states the seven-day exchange window,
 * which is the shop's side of a bargain the parent may need to hold it to -- a
 * parent who reads only French must be able to read the terms they are being
 * given.
 */
export const NOTICES = {
  sale: {
    fr: 'Merci de votre achat. Les articles vendus sont échangeables sous 7 jours avec ce reçu.',
    en: 'Thank you for your purchase. Goods sold are exchangeable within 7 days with this receipt.'
  },
  order: {
    fr: 'Merci. Le vêtement reste en boutique jusqu’au retrait.',
    en: 'Thank you. The garment stays in the shop until collected.'
  },
  deposit: {
    fr: 'L’école conserve le vêtement décrit ci-dessus. Merci de présenter ce bon lors du retrait.',
    en: 'The school is holding the garment described above. Please present this slip when collecting it.'
  },
  collection: {
    fr: 'Ce bon atteste que les articles ci-dessus ont été remis.',
    en: 'This slip confirms the garments listed above were handed over.'
  }
} as const;

/**
 * Payment methods, bilingual. Kept beside the labels rather than read from
 * Sales.payment for the same reason: that namespace resolves to one language.
 *
 * MoMo and Orange Money are brand names and identical in both, but they are
 * spelled out here anyway so the table stays uniform and a future method cannot
 * quietly fall back to a monolingual string.
 */
export const PAYMENT_LABELS = {
  cash: 'Espèces / Cash',
  mobile_money: 'MoMo / MoMo',
  orange_money: 'Orange Money / Orange Money',
  bank_transfer: 'Virement / Bank transfer'
} as const;

/**
 * A5 halves the paper bill: two sheets fit one A4, which is what the shop
 * prints on (A-FR-7.11). A4 stays available because not every office printer
 * is willing to be told about A5 stock, and a receipt that will not come out of
 * the printer at all is worse than one that wastes half a page.
 */
export type PaperSize = 'A5' | 'A4';
export const PAPER_SIZES: readonly PaperSize[] = ['A5', 'A4'];

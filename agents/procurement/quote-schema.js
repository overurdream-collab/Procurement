const QUOTE_FIELDS = [
  'supplier','price','currency','cooling_load_kw','refrigeration_capacity_kw',
  'compressor_brand','compressor_model','evaporator_brand','evaporator_model',
  'daily_product_load','product_entry_temperature','pull_down_time','power_kwh_24h',
  'panel_type','panel_density','panel_thickness','floor_specification','fob_price',
  'fob_port','cbm','gross_weight','production_lead_time','warranty','payment_terms',
  'spare_parts','dealer_price','future_supply'
];

function normalizeQuote(input = {}) {
  const quote = Object.fromEntries(QUOTE_FIELDS.map(k => [k, input[k] ?? null]));
  quote.source_message_id = input.source_message_id ?? null;
  quote.source_attachments = input.source_attachments ?? [];
  quote.missing_fields = QUOTE_FIELDS.filter(k => quote[k] === null || quote[k] === '');
  quote.confidence = Number.isFinite(input.confidence) ? input.confidence : null;
  return quote;
}
module.exports = { QUOTE_FIELDS, normalizeQuote };

-- Query for N8N "Select rows from table" step
-- This gets all the data you need after Stripe payment, including external business and branch IDs

SELECT 
  pl.id as payment_link_id,
  pl.tenant_id,
  pl.stripe_session_id,
  pl.amount,
  pl.status as payment_status,
  pl.external_service_booking_id as phorest_booking_id,
  pl.booking_id,
  
  -- Booking details
  b.id as booking_internal_id,
  b.client_id,
  b.service_name,
  b.booking_date_time,
  b.status as booking_status,
  
  -- External Business ID (for Phorest API)
  tb.external_business_id as external_business_id,
  tb.business_name,
  
  -- External Branch ID (for Phorest API)  
  tbr.branch_id as external_branch_id,
  tbr.branch_name
  
FROM payment_links pl
LEFT JOIN bookings b ON pl.booking_id = b.id
LEFT JOIN tenant_businesses tb ON b.business_id = tb.id
LEFT JOIN tenant_branches tbr ON b.branch_id = tbr.id

WHERE pl.stripe_session_id = '{{ $json.data.object.id }}' -- From Stripe webhook
  AND pl.status = 'completed'
LIMIT 1;

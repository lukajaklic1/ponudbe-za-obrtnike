// Edge Function: notify-registration
// Called via pg_net from handle_onboarding trigger.
// Sends email to super admin when a new company registers.

const ADMIN_EMAIL = 'lukajaklic1@gmail.com'

Deno.serve(async (req) => {
  try {
    const { company_name, first_name, last_name, email } = await req.json()

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.error('RESEND_API_KEY not set')
      return new Response('missing api key', { status: 500 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Toolingdesk <noreply@toolingdesk.com>',
        to: ADMIN_EMAIL,
        subject: `Nova registracija: ${company_name}`,
        html: `
          <h2>Nova registracija na Toolingdesk</h2>
          <p><strong>Podjetje:</strong> ${company_name}</p>
          <p><strong>Kontakt:</strong> ${first_name} ${last_name} (${email})</p>
          <p><a href="https://toolingdesk.com/super-admin/companies">Odpri admin panel →</a></p>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response('email failed', { status: 500 })
    }

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response(String(e), { status: 500 })
  }
})

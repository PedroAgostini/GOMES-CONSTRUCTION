/* Gomes's Construction Inc. — lead delivery, shared by the home page, the insurance claims page and the roofing LP.
   Every lead goes to Web3Forms (the email) and to the lead webhook at the same time. The send counts as
   delivered when either one accepts it, so an outage on one side never loses a lead.
   Load it before main.js / lp.js; they call GomesLeads.send(form, data) and throw on failure. */
(() => {
  "use strict";
  const FORM_ID = "form01";
  const WEBHOOK = "https://ironwarden.eusouts.com/hooks/leads/NNtjC8YiYLku4SiCRfyR7NwCcPSoOyOasShe1f9u5qo";
  // Web3Forms plumbing and honeypots: needed by Web3Forms, not part of the lead
  const PLUMBING = ["access_key", "subject", "from_name", "botcheck", "website"];

  const post = async (url, body) => {
    // keepalive lets the request finish when the LP moves on to thank-you/
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out.success === false) throw new Error(out.message || out.detail || String(res.status));
    return out;
  };

  async function send(form, data) {
    const lead = { form_id: FORM_ID, ...data, page: data.page || location.href, submitted_at: new Date().toISOString() };
    PLUMBING.forEach((k) => delete lead[k]);
    const [email, hook] = await Promise.allSettled([post(form.action, data), post(WEBHOOK, lead)]);
    if (email.status === "rejected" && hook.status === "rejected") throw email.reason;
    return { email: email.status === "fulfilled", webhook: hook.status === "fulfilled" };
  }

  window.GomesLeads = { send, FORM_ID };
})();

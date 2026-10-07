/* Roofing LP: three-step estimate form (#form01), sent to Web3Forms, then redirected to thank-you/ */
(() => {
  const form = document.getElementById("form01");
  if (!form) return;

  const steps = [...form.querySelectorAll(".step")];
  const segs = [...form.querySelectorAll(".progress__seg")];
  const status = form.querySelector("[data-step-status]");
  const fail = form.querySelector("[data-fail]");
  const submit = form.querySelector("[data-submit]");
  let current = 0;

  const rules = {
    zip_code: (v) => /^\d{5}$/.test(v),
    service: (v) => v !== "",
    first_name: (v) => v.length > 0,
    last_name: (v) => v.length > 0,
    phone: (v) => v.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").length === 10,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),
    address: (v) => v.length > 3,
  };

  const check = (input) => {
    const ok = (rules[input.name] || (() => true))(input.value.trim());
    input.closest(".field").classList.toggle("is-invalid", !ok);
    input.setAttribute("aria-invalid", String(!ok));
    return ok;
  };

  const validStep = (i) => {
    const inputs = [...steps[i].querySelectorAll("input, select")];
    const bad = inputs.filter((el) => !check(el));
    if (bad.length) bad[0].focus();
    return bad.length === 0;
  };

  const show = (i, dir = 1) => {
    steps[current].hidden = true;
    steps[current].classList.remove("is-active", "is-back");
    current = i;
    const step = steps[current];
    step.hidden = false;
    step.classList.add("is-active");
    step.classList.toggle("is-back", dir < 0);
    segs.forEach((s, n) => s.classList.toggle("is-on", n <= current));
    status.textContent = `Step ${current + 1} of ${steps.length}`;
    step.querySelector("input, select").focus({ preventScroll: true });
  };

  form.addEventListener("click", (e) => {
    if (e.target.closest("[data-next]") && validStep(current)) show(current + 1, 1);
    if (e.target.closest("[data-back]")) show(current - 1, -1);
  });

  // Enter on steps 1 and 2 advances instead of submitting the whole form
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && current < steps.length - 1 && e.target.matches("input")) {
      e.preventDefault();
      if (validStep(current)) show(current + 1, 1);
    }
  });

  // re-check a field as soon as the visitor fixes it
  form.addEventListener("input", (e) => {
    const field = e.target.closest(".field");
    if (field && field.classList.contains("is-invalid")) check(e.target);
  });
  form.addEventListener("change", (e) => { if (e.target.matches("select")) check(e.target); });

  form.zip_code.addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 5); });

  // US phone mask: (774) 381-4481, a leading country code 1 is dropped
  const maskPhone = (v) => {
    let d = v.replace(/\D/g, "");
    if (d.length > 10 && d[0] === "1") d = d.slice(1);
    d = d.slice(0, 10);
    if (d.length < 4) return d.length ? `(${d}` : "";
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };
  form.phone.addEventListener("input", (e) => {
    const el = e.target;
    // let backspace remove the mask characters instead of fighting the cursor
    if (e.inputType === "deleteContentBackward" && /[)\s-]$/.test(el.value)) return;
    el.value = maskPhone(el.value);
  });

  const thankYouUrl = () => {
    const base = location.href.split(/[?#]/)[0].replace(/index\.html$/, "");
    return new URL("thank-you/", base.endsWith("/") ? base : base + "/").href;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (current < steps.length - 1) { if (validStep(current)) show(current + 1, 1); return; }
    if (!validStep(current)) return;

    fail.hidden = true;
    submit.disabled = true;
    submit.classList.add("is-sending");

    const data = Object.fromEntries(new FormData(form));
    data.name = `${data.first_name} ${data.last_name}`.trim();
    data.page = location.href;

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || res.status);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "lead_submit", form_id: "form01", service: data.service });
      location.href = thankYouUrl();
    } catch (err) {
      fail.hidden = false;
      submit.disabled = false;
      submit.classList.remove("is-sending");
    }
  });

  // every "estimate" CTA lands on the form and puts the cursor in the active step
  document.querySelectorAll("[data-to-form]").forEach((a) => {
    a.addEventListener("click", () => {
      setTimeout(() => steps[current].querySelector("input, select").focus({ preventScroll: true }), 450);
    });
  });
})();

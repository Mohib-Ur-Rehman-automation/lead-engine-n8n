// Builds the Custom Form Styling CSS for the L1 form (n8n Form Trigger > Options > Custom Form Styling).
// n8n strips HTML from this field and from descriptions (no class/style attributes), so every extra
// element on the page is drawn with CSS pseudo-elements and inline SVG backgrounds.
const fs = require('fs');
const uri = svg => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`;

const logo = (sun, ink) => uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M8 26 A12 12 0 0 1 32 26 Z" fill="${sun}"/><path d="M4 26H36" stroke="${ink}" stroke-width="2" stroke-linecap="round"/><path d="M20 6v4M9 11l2.8 2.8M31 11l-2.8 2.8" stroke="${sun}" stroke-width="2" stroke-linecap="round"/></svg>`);

// Decorative sun arc (illustration, not data): dots along a dashed arc, a sun near the top.
const arc = (rule, muted, hot, warm, cold, bg) => {
  const pts = [];
  const H = [6.6, 7.4, 8.3, 9.1, 9.8, 10.6, 11.5, 12.6, 13.4, 14.5, 15.3, 16.2, 17.1, 17.9, 18.8, 19.7, 20.6, 21.4];
  const T = ['c', 'w', 'h', 'w', 'c', 'h', 'w', 'w', 'h', 'c', 'w', 'h', 'w', 'c', 'h', 'w', 'c', 'w'];
  H.forEach((h, i) => {
    const a = Math.PI * (1 - (h - 6) / 16), r = 200 + ((i % 3) - 1) * 14;
    const x = (260 + r * Math.cos(a)).toFixed(1), y = (236 - r * Math.sin(a)).toFixed(1);
    const fill = T[i] === 'h' ? hot : T[i] === 'w' ? warm : cold, rad = T[i] === 'h' ? 7 : T[i] === 'w' ? 5.5 : 4;
    pts.push(`<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}" stroke="${bg}" stroke-width="3"/>`);
  });
  return uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 250"><line x1="20" y1="236" x2="500" y2="236" stroke="${rule}" stroke-width="1.5"/><path d="M60 236 A200 200 0 0 1 460 236" fill="none" stroke="${muted}" stroke-width="1.5" stroke-dasharray="2 8"/>${pts.join('')}</svg>`);
};

// Big sun for the thank-you card.
const bigSun = (sun, ink) => uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 70"><path d="M30 60 A30 30 0 0 1 90 60 Z" fill="${sun}"/><path d="M14 60H106" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><path d="M60 12v10M28 26l7 7M92 26l-7 7M14 44h9M97 44h9" stroke="${sun}" stroke-width="3" stroke-linecap="round"/></svg>`);

const L = { bg: '#F6F8F7', card: '#FFFFFF', ink: '#0F2624', muted: '#4E6260', rule: '#DFE6E4', accent: '#145A55', onAccent: '#FFFFFF', sun: '#E0A21B', hot: '#954F00', warm: '#CD7D00', cold: '#E3A257', field: '#FFFFFF', focus: 'rgba(20,90,85,.18)' };
const D = { bg: '#0F2624', card: '#153231', ink: '#EEF2EF', muted: '#9DB8B3', rule: '#24413F', accent: '#F5AC1F', onAccent: '#0F2624', sun: '#F5AC1F', hot: '#F5AC1F', warm: '#B8831C', cold: '#7A5F25', field: '#0F2624', focus: 'rgba(245,172,31,.22)' };

const vars = c => `
  --font-family: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-size-body: 16px; --font-size-label: 14px; --font-size-input: 16px; --font-size-header: 31px;
  --font-size-paragraph: 16px; --font-size-link: 14px; --font-size-error: 14px; --font-size-test-notice: 14px;
  --color-background: ${c.bg}; --color-card-bg: ${c.card}; --color-card-border: ${c.rule}; --color-card-shadow: transparent;
  --color-link: ${c.muted}; --color-header: ${c.ink}; --color-label: ${c.ink}; --color-input-border: ${c.rule};
  --color-input-text: ${c.ink}; --color-input-bg: ${c.field}; --color-focus-border: ${c.accent};
  --color-submit-btn-bg: ${c.accent}; --color-submit-btn-text: ${c.onAccent}; --color-required: ${c.accent};
  --color-error: ${c === L ? '#B42318' : '#FF9B8F'}; --color-html-text: ${c.muted}; --color-html-link: ${c.accent};
  --border-radius-card: 12px; --border-radius-input: 8px; --padding-card: 32px; --submit-btn-height: 52px;
  --hl-logo: ${logo(c.sun, c.ink)}; --hl-arc: ${arc(c.rule, c.muted, c.hot, c.warm, c.cold, c.bg)}; --hl-sun: ${bigSun(c.sun, c.ink)};
  --hl-ink: ${c.ink}; --hl-muted: ${c.muted}; --hl-rule: ${c.rule}; --hl-focus: ${c.focus};`;

const css = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
/* Halden Solar Co. quote form. Light by default, dark when the visitor's system is dark. */
:root {${vars(L)}
}
@media (prefers-color-scheme: dark) {
  :root {${vars(D)}
  }
  select option { background: ${D.card}; color: ${D.ink}; }
}

body { min-height: 100vh; line-height: 26px; }
.container {
  width: 100%; max-width: 1120px; margin: 0 auto; padding: 40px 40px 56px; text-align: left;
  display: grid; grid-template-columns: minmax(0, 1fr) 460px; column-gap: 72px;
  grid-template-areas: "logo logo" "head form" "steps form" "foot form"; align-items: start;
}
section { display: contents; }

/* Brand row */
.container::before {
  grid-area: logo; content: 'Halden Solar Co.'; display: block; margin-bottom: 56px;
  padding-left: 52px; min-height: 40px; line-height: 40px;
  background: var(--hl-logo) left center / 40px 40px no-repeat;
  font-family: 'DM Serif Display', Georgia, serif; font-size: 25px; color: var(--hl-ink);
}
/* Headline */
section::before {
  grid-area: head; content: 'Solar sized\\A to your bill.'; white-space: pre-line; display: block; margin-top: 24px;
  font-family: 'DM Serif Display', Georgia, serif; font-size: 61px; line-height: 64px; letter-spacing: -0.01em;
  color: var(--hl-ink); max-width: 520px;
}
/* What happens next, plus the sun-arc illustration */
section::after {
  grid-area: steps; display: block; margin-top: 24px; max-width: 520px; white-space: pre-line;
  content: 'Tell us about your roof and your monthly bill. You get a personal reply by email in under a minute, and a solar advisor calls you within one working hour.\\A\\A 1.  Share your bill, timeline and property\\A 2.  Get your reply and a rough estimate\\A 3.  Book a free site survey for an exact quote';
  font-size: 18px; line-height: 30px; color: var(--hl-muted);
  padding-bottom: 260px; background: var(--hl-arc) left bottom / 520px 250px no-repeat;
}

/* Form card */
form.card, #submitted-form { grid-area: form; grid-row: 2 / span 3; box-shadow: none; margin: 24px 0 0; }
.form-header h1 { font-family: 'DM Serif Display', Georgia, serif; line-height: 38px; text-align: left; }
.form-header p { text-align: left; line-height: 26px; color: var(--hl-muted); padding-top: 8px; }
.inputs-wrapper { padding-top: 24px; padding-bottom: 8px; }
form label { font-weight: 500; line-height: 20px; padding-bottom: 8px; }
form .form-input, form select { padding: 12px 14px; line-height: 24px; }
form textarea { min-height: 112px; }
form .form-input:focus, .select-input:focus-within { box-shadow: 0 0 0 4px var(--hl-focus); }
.error-hidden { padding-top: 4px; padding-bottom: 8px; line-height: 20px; }
#submit-btn { font-size: 16px; font-weight: 700; letter-spacing: 0.01em; }
#submit-btn:hover { opacity: 0.88; }
#submit-btn:focus-visible { outline: 3px solid var(--hl-focus); outline-offset: 2px; }
hr, .n8n-link { display: none; }
.test-notice { grid-column: 1 / -1; }

/* Thank-you card (replaces the default "Form Submitted") */
#submitted-form { padding: 40px 32px; text-align: left; }
#submitted-form::before {
  content: ''; display: block; width: 120px; height: 70px; margin-bottom: 24px;
  background: var(--hl-sun) left top / 120px 70px no-repeat;
}
#submitted-header { font-size: 0 !important; line-height: 0; }
#submitted-header::after {
  content: 'Thank you.\\A We are on it.'; white-space: pre-line; display: block;
  font-family: 'DM Serif Display', Georgia, serif; font-size: 39px; line-height: 44px; color: var(--hl-ink);
}
#submitted-content { padding-top: 16px; font-size: 18px; line-height: 30px; color: var(--hl-ink); }
#submitted-content::after {
  content: 'What happens next'; display: block; margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--hl-rule);
  font-size: 16px; line-height: 24px; font-weight: 700; color: var(--hl-ink);
}
#submitted-form .form-header::after {
  content: '1.  If you gave an email, your reply arrives in under a minute.\\A 2.  A solar advisor calls within one working hour, 9 am to 7 pm, Monday to Saturday.\\A 3.  Reply to that email with a photo of your latest bill to speed things up.';
  display: block; white-space: pre-line; margin-top: 8px; padding-left: 0;
  font-size: 16px; line-height: 28px; color: var(--hl-muted);
}

/* Phones and small tablets */
@media (max-width: 960px) {
  .container {
    max-width: 560px; padding: 24px 16px 40px; display: grid; grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "logo" "head" "form" "steps";
  }
  .container::before { margin-bottom: 24px; }
  section::before { font-size: 39px; line-height: 44px; margin-top: 0; margin-bottom: 8px; }
  form.card, #submitted-form { grid-row: auto; margin-top: 16px; padding: 24px !important; border: 1px solid var(--color-card-border) !important; border-radius: 12px !important; background-color: var(--color-card-bg) !important; }
  .container { width: 100% !important; min-height: 0 !important; }
  hr { display: none !important; }
  :root { --padding-card: 24px; }
  section::after { padding-bottom: 210px; background-size: 100% auto; margin-top: 32px; font-size: 16px; line-height: 28px; }
}
`;
fs.writeFileSync(__dirname + '/L1_form.css', css);
console.log('bytes', css.length);

function env(name: string) {
  return (process.env[name] || "").trim();
}

export function isMailerConfigured() {
  const hasResend = Boolean(env("RESEND_API_KEY") && env("MAIL_FROM"));
  const hasWebhook = Boolean(env("MAIL_WEBHOOK_URL"));
  return hasResend || hasWebhook;
}

export async function sendEmail(args: { to: string; subject: string; text: string; html?: string }) {
  const resendApiKey = env("RESEND_API_KEY");
  const from = env("MAIL_FROM");
  const webhookUrl = env("MAIL_WEBHOOK_URL");
  const webhookToken = env("MAIL_WEBHOOK_TOKEN");

  if (resendApiKey && from) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
        html: args.html
      })
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Resend failed: HTTP ${resp.status} ${text}`.trim());
    }
    return;
  }

  if (webhookUrl) {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {})
      },
      body: JSON.stringify(args)
    });
    if (!resp.ok) {
      throw new Error(`MAIL_WEBHOOK_URL failed with HTTP ${resp.status}`);
    }
    return;
  }

  throw new Error("Email service is not configured");
}


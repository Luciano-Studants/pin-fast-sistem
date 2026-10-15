import type { Env } from "../config/env.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  configured: boolean;
  send(mail: Mail): Promise<void>;
}

/** Envio via API HTTP do Resend (sem dependências extras). */
export function createMailer(env: Env): Mailer {
  const configured = Boolean(env.RESEND_API_KEY && env.MAIL_FROM && env.APP_URL);
  return {
    configured,
    async send(mail) {
      if (!configured) throw new Error("Mailer is not configured");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: mail.to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`Resend respondeu ${response.status}`);
      }
    },
  };
}

export function passwordResetMail(name: string, link: string): Omit<Mail, "to"> {
  const safeName = name.replace(/[<>&"]/g, "");
  return {
    subject: "PINFAST — redefinição de senha",
    text:
      `Olá, ${safeName}!\n\nRecebemos um pedido para redefinir a sua senha. ` +
      `Abra o link abaixo em até 60 minutos:\n\n${link}\n\n` +
      `Se não foi você, ignore este e-mail: sua senha continua a mesma.`,
    html:
      `<p>Olá, ${safeName}!</p><p>Recebemos um pedido para redefinir a sua senha. ` +
      `O link vale por 60 minutos:</p><p><a href="${link}">Redefinir minha senha</a></p>` +
      `<p>Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
  };
}

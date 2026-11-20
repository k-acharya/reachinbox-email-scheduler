import nodemailer from 'nodemailer';
import { Sender } from '@prisma/client';
import { decryptSecret } from '../utils/encryption';

export interface SendMailPayload {
  to: string;
  subject: string;
  text: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | null;
}

export interface SmtpTransportProvider {
  send(sender: Sender, payload: SendMailPayload): Promise<SendMailResult>;
}

export class NodemailerSmtpProvider implements SmtpTransportProvider {
  async send(sender: Sender, payload: SendMailPayload): Promise<SendMailResult> {
    const password = decryptSecret(sender.encryptedSmtpPassword);

    const transporter = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: {
        user: sender.smtpUsername,
        pass: password,
      },
    });

    const info = await transporter.sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    return {
      messageId: info.messageId,
      previewUrl: typeof preview === 'string' ? preview : null,
    };
  }
}

let activeSmtpProvider: SmtpTransportProvider = new NodemailerSmtpProvider();

export function setSmtpProvider(provider: SmtpTransportProvider): void {
  activeSmtpProvider = provider;
}

export async function sendViaSenderSmtp(
  sender: Sender,
  payload: SendMailPayload
): Promise<SendMailResult> {
  return activeSmtpProvider.send(sender, payload);
}
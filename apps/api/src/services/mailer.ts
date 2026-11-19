import { Resend } from "resend";
import { env } from "../env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendWelcomeEmail(to: string, username: string) {
  if (!resend) return console.log("[mail] RESEND_API_KEY not set, skipping welcome email");
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM,
    to,
    subject: "Welcome to InstaCloud",
    html: `<p>Hi ${username}, your InstaCloud account is ready. Share your first photo!</p>`,
  });
  if (error) throw new Error(error.message);
}

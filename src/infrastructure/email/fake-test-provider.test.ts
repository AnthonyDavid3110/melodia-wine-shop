import { beforeEach, describe, expect, it } from "vitest";
import { getSentTestEmails, resetSentTestEmails, sendEmail } from "./fake-test-provider";

const INPUT = {
  to: "jean@example.ch",
  subject: "Commande ECM-2026-0042 confirmée — Les Vins de Mélodia",
  html: "<p>Bonjour Jean</p>",
  text: "Bonjour Jean",
};

beforeEach(() => {
  resetSentTestEmails();
});

describe("fake email provider", () => {
  it("does not require RESEND_API_KEY or any environment configuration", async () => {
    // No env mocking anywhere in this file — the fake provider must
    // work with zero configuration, unlike the real Resend adapter.
    const result = await sendEmail(INPUT);
    expect(result.messageId).toBeTruthy();
  });

  it("deterministically captures the sent message for later inspection", async () => {
    await sendEmail(INPUT);
    const sent = getSentTestEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: INPUT.to,
      subject: INPUT.subject,
      html: INPUT.html,
      text: INPUT.text,
    });
    expect(sent[0]!.id).toBeTruthy();
    expect(sent[0]!.sentAt).toBeInstanceOf(Date);
  });

  it("captures multiple sends in order", async () => {
    await sendEmail({ ...INPUT, to: "a@example.ch" });
    await sendEmail({ ...INPUT, to: "b@example.ch" });
    const sent = getSentTestEmails();
    expect(sent.map((email) => email.to)).toEqual(["a@example.ch", "b@example.ch"]);
  });

  it("resetSentTestEmails clears previously captured sends", async () => {
    await sendEmail(INPUT);
    expect(getSentTestEmails()).toHaveLength(1);
    resetSentTestEmails();
    expect(getSentTestEmails()).toHaveLength(0);
  });

  it("returns a unique message ID per send", async () => {
    const first = await sendEmail(INPUT);
    const second = await sendEmail(INPUT);
    expect(first.messageId).not.toBe(second.messageId);
  });
});

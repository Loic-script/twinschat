/** Types minimaux du paquet « web-push » 4 (module ESM, exports nommés, sans types fournis) : ce qu'utilise lib/push.ts. */
declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  export type RequestOptions = {
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
    timeout?: number;
  };

  export type SendResult = { statusCode: number; body: string; headers: Record<string, string> };

  export class WebPushError extends Error {
    statusCode: number;
    body: string;
    endpoint: string;
  }

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: RequestOptions,
  ): Promise<SendResult>;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };

}

declare module 'resend' {
  export class Resend {
    constructor(apiKey: string);
    emails: {
      send(args: {
        from: string;
        to: string | string[];
        reply_to?: string;
        subject: string;
        html: string;
      }): Promise<{ id?: string; error?: { message?: string } }>;
    };
  }
}

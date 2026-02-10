import { Client as ConversationsClient } from '@twilio/conversations';

class TwilioChatService {
  constructor() {
    this.client = null;
    this.token = null;
  }

  async initClient(token, onTokenExpired) {
    if (this.client) {
      if (this.token !== token) {
        await this.client.updateToken(token);
        this.token = token;
      }
      return this.client;
    }

    this.client = await ConversationsClient.create(token);
    this.token = token;

    if (onTokenExpired) {
      this.client.on('tokenAboutToExpire', onTokenExpired);
      this.client.on('tokenExpired', onTokenExpired);
    }

    return this.client;
  }

  async shutdown() {
    if (this.client) {
      await this.client.shutdown();
      this.client = null;
      this.token = null;
    }
  }
}

const twilioChatService = new TwilioChatService();
export default twilioChatService;

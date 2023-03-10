import { DefaultMap, tinyassert } from "@hiogawa/utils";
import type { Remote } from "comlink";
import EventEmitter from "eventemitter3";
import { generateId, sleep } from "./misc";

/**
 * DIY event callback system since `comlink.proxy` would require transfering MessagePort through "renderer -> preload -> main"
 */

export class EventEmitterMain {
  private eventEmitter = new EventEmitter();
  private subscriptions = new DefaultMap<
    string,
    Map<string, { handler: any; port: Electron.MessagePortMain }>
  >(() => new Map());

  constructor(
    private receiveMessagePort: (
      callbackId: string
    ) => Promise<Electron.MessagePortMain>
  ) {}

  emit(event: string, data: unknown) {
    this.eventEmitter.emit(event, data);
  }

  async on(event: string, callbackId: string) {
    tinyassert(!this.subscriptions.get(event).has(callbackId));
    const port = await this.receiveMessagePort(callbackId);
    const handler = (e: unknown) => {
      port.postMessage(e);
    };
    this.eventEmitter.on(event, handler);
    this.subscriptions.get(event).set(callbackId, { handler, port });

    // force unsubscribe when port is closed e.g. when the page with the other end of the port is closed
    port.addListener("close", () => {
      this.off(event, callbackId);
    });
  }

  off(event: string, callbackId: string) {
    const subscription = this.subscriptions.get(event).get(callbackId);
    tinyassert(subscription);
    this.eventEmitter.off(event, subscription.handler);
    subscription.port.close();
  }
}

export class EventEmitterRenderer {
  constructor(
    private remote: Remote<EventEmitterMain>,
    private shareMessageChannelRenderer: (
      channel: string
    ) => Promise<MessagePort>
  ) {}

  // TODO: a bit clumsy to unsubscribe due to async
  async on(event: string, handler: (...args: any[]) => void) {
    const id = `EventEmitterRenderer.on:${generateId()}`;

    await sleep(0); // TODO: race condition?
    const [, port] = await Promise.all([
      this.remote.on(event, id),
      this.shareMessageChannelRenderer(id),
    ]);
    port.start();
    port.addEventListener("message", handler);

    return () => {
      port.close();
      port.removeEventListener("message", handler);
    };
  }
}

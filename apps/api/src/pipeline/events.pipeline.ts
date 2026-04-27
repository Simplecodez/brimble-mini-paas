import { EventEmitter } from "node:events";
import { singleton } from "tsyringe";
import {
  GlobalEventEnvelope,
  GlobalEventName,
  GlobalEventPayloads,
} from "../common/types";

@singleton()
export class DeploymentEvents {
  private readonly emitter = new EventEmitter();

  publish<K extends GlobalEventName>(
    type: K,
    payload: GlobalEventPayloads[K],
  ): void {
    this.emitter.emit("event", {
      type,
      payload,
    } satisfies GlobalEventEnvelope<K>);
  }

  subscribe(listener: (event: GlobalEventEnvelope) => void): () => void {
    this.emitter.on("event", listener);
    return () => {
      this.emitter.off("event", listener);
    };
  }
}

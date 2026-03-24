import { feedRelays, pool, eventsReceived, normalizeUrls } from "../store";
import { myWriteRelays } from "../profile";

export default {
  broadcastEventById,
};

export function broadcastEventById(id: string): void {
  const event = eventsReceived.value.get(id);
  if (event) {
    const relays = [...new Set(normalizeUrls([...feedRelays, ...myWriteRelays.value]))];
    const publishedEvent = ("rawEvent" in event && event.rawEvent) ? event.rawEvent : event;
    console.log("broadcastEventById", id, publishedEvent, relays);
    pool.publish(publishedEvent, relays);
  }
  return;
}

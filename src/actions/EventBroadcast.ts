import { feedRelays, pool, eventsReceived, normalizeUrls } from "../store";
import { myWriteRelays } from "../profile";

export default {
  broadcastEventById,
};

export function broadcastEventById(id: string): void {
  const event = eventsReceived.value.get(id);
  if (event) {
    const relays = [...new Set(normalizeUrls([...feedRelays, ...myWriteRelays.value]))];
    console.log("broadcastEventById", id, event, relays);
    pool.publish(event, relays);
  }
  return;
}

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "ignivox-erp",
  name: "Ignivox ERP",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
// @ts-ignore: JS domain engine intentionally shared with node:test.
import { report } from "../src/procurement.mjs";
export default defineAction({
 description:"Return a read-only, synthetic ALHARIR procurement status report. No supplier contact or real-world actions.",
 mcpTool:true,
 readOnly:true,
 schema:z.object({rfqId:z.literal("RFQ-POC-001")}),
 http:{method:"GET"},
 run:async ()=>report()
});

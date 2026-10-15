import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
// The procurement engine is deterministic; no model generates financial figures.
// @ts-ignore: JS domain engine intentionally shared with node:test.
import { compare } from "../src/procurement.mjs";
export default defineAction({
 description:"Compare synthetic supplier quotations using FOB, currency, completeness, specification, quantity, and integer-cent rules. Never send emails.",
 mcpTool:true,
 schema:z.object({rfqId:z.literal("RFQ-POC-001")}),
 http:{method:"GET"},
 run:async ({rfqId})=>({rfqId,...compare()})
});

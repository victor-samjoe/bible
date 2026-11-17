import { describe, expect, it } from "vitest";
import { FragmentSchema, RightsSchema } from "../../src/domain/bkf/contracts";
import { canAutomatedProcess, canQuote, canStore, canTransition } from "../../src/domain/bkf/policy";

const id = "11111111-1111-4111-8111-111111111111";
const valid = { id, edition_id:id, status:"APPROVED_FULL", permissions:{store:true,automated_processing:true,quote:true,public_distribution:true}, proof:"contract", verified_by:"editor", verified_at:"2026-01-01T00:00:00Z", valid_from:"2026-01-01T00:00:00Z", valid_until:"2027-01-01T00:00:00Z", territory:"BR", attribution:"Example", word_limits:{per_quote:30,per_work:300,per_document:100} } as const;
describe("BKF contracts",()=>{
 it("accepts a complete synthetic rights fixture and fails closed by date",()=>{ const rights=RightsSchema.parse(valid); expect(canStore(rights,new Date("2026-06-01Z"))).toBe(true); expect(canAutomatedProcess(rights,new Date("2027-01-01Z"))).toBe(false); expect(canQuote(rights,10,0,0,new Date("2026-06-01Z"))).toBe(true); });
 it("rejects missing permissions, proof and invalid fragments",()=>{ expect(RightsSchema.safeParse({...valid,permissions:{store:true}}).success).toBe(false); expect(RightsSchema.safeParse({...valid,proof:""}).success).toBe(false); expect(FragmentSchema.safeParse({id,manifest_id:id,locator:"x",start_offset:4,end_offset:4,text:"",previous_text:"",next_text:""}).success).toBe(false); });
 it("requires limits for quotation and explicit review chain",()=>{ const noLimits=RightsSchema.parse({...valid,word_limits:undefined}); expect(canQuote(noLimits,1,0,0,new Date("2026-06-01Z"))).toBe(false); expect(canTransition("RESEARCHED","PUBLISHED")).toBe(false); expect(canTransition("CRITICALLY_REVIEWED","HUMAN_APPROVAL")).toBe(true); expect(canTransition("HUMAN_APPROVAL","PUBLISHED")).toBe(true); });
});

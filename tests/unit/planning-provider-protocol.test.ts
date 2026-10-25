import { beforeEach,it,expect,vi } from 'vitest';
import { generateText,tool } from 'ai';
import { configuredModel } from '@/lib/ai/provider';
import { encryptProviderKey } from '@/lib/ai/secrets';
import { providerFetch } from '@/lib/ai/transport';
import { planningOutput } from '@/lib/ai/planning/contract';
vi.mock('@/lib/ai/transport',()=>({providerFetch:vi.fn()}));
const payload={plan:{name:'برنامه آزمایشی',description:'پیش‌نویس',goalType:'health',weeks:1,days:Array.from({length:7},(_,i)=>({name:`روز ${i+1}`,focusRegion:'full_body',isRest:![0,3].includes(i),exercises:[0,3].includes(i)?[{slug:'push-up',sets:2,repsMin:8,repsMax:12,rpe:6,rest:90}]:[]}))},reasons:['پیشنهاد آزمایشی برای بررسی قرارداد ارائه‌دهنده']};
beforeEach(()=>vi.clearAllMocks());
for(const kind of ['gemini','custom'] as const)it(`uses the installed ${kind} adapter for the structured planning protocol`,async()=>{
 let body:Record<string,unknown>={};
 vi.mocked(providerFetch).mockReturnValue(async(_url,init)=>{
   body=JSON.parse(String(init?.body));
   const response=kind==='gemini'?{candidates:[{content:{role:'model',parts:[{functionCall:{name:'submit_program',args:payload}}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:20,totalTokenCount:30}}:{id:'fixture',created:0,model:'fixture',choices:[{index:0,message:{role:'assistant',content:null,tool_calls:[{id:'call-1',type:'function',function:{name:'submit_program',arguments:JSON.stringify(payload)}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}};
   return Response.json(response);
 });
 const result=await generateText({model:configuredModel({kind,baseUrl:kind==='gemini'?'https://fixture.example/v1beta':'https://fixture.example/v1',model:'fixture',encryptedKey:encryptProviderKey('only-a-fixture')}),tools:{submit_program:tool({inputSchema:planningOutput})},toolChoice:{type:'tool',toolName:'submit_program'},prompt:'Return the reviewed fixture',maxRetries:0});
 expect(result.toolCalls[0].toolName).toBe('submit_program');expect(planningOutput.parse(result.toolCalls[0].input)).toEqual(payload);
 expect(JSON.stringify(body)).toContain('submit_program');expect(JSON.stringify(body)).not.toContain('only-a-fixture');
});

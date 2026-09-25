import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, providers } from "@/lib/db/schema";
import { createProviderAdapter } from "@/lib/providers";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requireOwner } from "@/lib/auth/require-owner";
import { requireSameOrigin } from "@/lib/security/csrf";

export async function POST(request: Request) {
  const limited=rateLimit(request,"order-status",30);
  if(!limited.allowed) return rateLimitResponse(limited.retryAfter);
  const denied=await requireOwner();
  if(denied) return denied;
  const originDenied = requireSameOrigin(request);
  if(originDenied) return originDenied;
  try {
    const body=(await request.json()) as {orderId?:string};
    const orderId=String(body.orderId??"").trim();
    const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if(!uuidPattern.test(orderId)) return NextResponse.json({error:"Invalid order ID."},{status:400});
    const order=(await db.select().from(orders).where(eq(orders.id,orderId))).at(0);
    if(!order||!order.providerOrderId||!order.providerId) return NextResponse.json({error:"Order or provider order ID not found."},{status:404});
    const providerRow=(await db.select().from(providers).where(eq(providers.id,order.providerId))).at(0);
    if(!providerRow?.enabled) return NextResponse.json({error:"The provider assigned to this order is unavailable."},{status:409});
    if(order.providerOrderId.length>256) return NextResponse.json({error:"Provider order ID is invalid."},{status:409});
    const provider=createProviderAdapter({name:providerRow.name,baseUrl:providerRow.baseUrl,apiKey:process.env.PROVIDER_API_KEY??""});
    const status=await provider.getOrderStatus(order.providerOrderId);
    const terminal=new Set(["completed","failed","cancelled"]);
    const nextStatus=status.status==="unknown"||terminal.has(order.status)&&order.status!==status.status?order.status:status.status;
    const changed=nextStatus!==order.status||status.startCount!==order.startCount||status.currentCount!==order.currentCount||status.completedQuantity!==order.completedQuantity||status.remains!==order.remains;
    const updated=(await db.update(orders).set({status:nextStatus,startCount:status.startCount,currentCount:status.currentCount,completedQuantity:status.completedQuantity,remains:status.remains,updatedAt:new Date()}).where(eq(orders.id,order.id)).returning()).at(0);
    if(changed){try{await db.insert(orderEvents).values({orderId:order.id,eventType:"status_check",message:"Provider status changed.",payload:{providerStatus:status.status}});}catch(eventError){console.error("Order status event logging failed:",eventError);}}
    return NextResponse.json({ok:true,order:updated,providerStatus:status.status},{headers:{"Cache-Control":"no-store, max-age=0"}});
  } catch(error){console.error("Order status check failed:",error);return NextResponse.json({ok:false,error:"Unable to update order status."},{status:502});}
}

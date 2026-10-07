// Internal: not re-exported from the package. Shared payload-equality rule for
// research evidence, so pivot detection and trendline derivation agree on what
// an "identical re-delivery" is (every field, including knownAt, must match).

function canonicalJson(value:unknown):string{
  if(Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if(value!==null&&typeof value==="object"){
    const record=value as Record<string,unknown>;
    return `{${Object.keys(record).filter(key=>record[key]!==undefined).sort()
      .map(key=>`${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sameJson(a:unknown,b:unknown):boolean{
  return canonicalJson(a)===canonicalJson(b);
}

/**
 * Identical re-deliveries of the same fact collapse to one; two different
 * payloads under one id are an evidence-integrity failure and fail closed.
 */
export function dedupeById<T>(items:readonly T[],idOf:(item:T)=>string,label:string):readonly T[]{
  const byId=new Map<string,T>();
  for(const item of items){
    const id=idOf(item);
    const existing=byId.get(id);
    if(existing===undefined){ byId.set(id,item); continue; }
    if(!sameJson(existing,item)) throw new Error(`conflicting ${label} payloads share id: ${id}`);
  }
  return [...byId.values()];
}

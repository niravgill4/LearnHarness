import type { GraphStore } from '../core/ports.ts';
import type { GraphNode, GraphChain, CoverageEntry, SessionCheckpoint, NotesSource, Position } from '../core/contracts.ts';

export interface AccountGraphState {
 nodes: GraphNode[]; chains: GraphChain[]; coverage: CoverageEntry[];
 checkpoints: SessionCheckpoint[]; sources: NotesSource[]; positions: Record<string, Position>;
}
export function createAccountGraph(initial: Partial<AccountGraphState> = {}) {
 const state: AccountGraphState = structuredClone({nodes:[],chains:[],coverage:[],checkpoints:[],sources:[],positions:{},...initial});
 let dirty=false;
 const copy=<T>(value:T):T=>structuredClone(value);
 const store: GraphStore = {
  readNodes:()=>copy(state.nodes), readChains:()=>copy(state.chains),
  readCoverage:()=>copy(state.coverage), readCheckpoints:()=>copy(state.checkpoints),
  readSources:()=>copy(state.sources), readPositions:()=>copy(state.positions),
  appendNode(value){state.nodes.push(copy(value));dirty=true;},
  appendChain(value){state.chains.push(copy(value));dirty=true;},
  appendCoverage(value){state.coverage.push(copy(value));dirty=true;},
  appendCheckpoint(value){state.checkpoints.push(copy(value));dirty=true;},
  upsertSource(value){const i=state.sources.findIndex(s=>s.id===value.id);if(i<0)state.sources.push(copy(value));else state.sources[i]={...copy(value),extractions:state.sources[i]?.extractions};dirty=true;},
  deleteSources(ids){const before=state.sources.length;state.sources=state.sources.filter(s=>!ids.has(s.id));dirty ||=before!==state.sources.length;return before-state.sources.length;},
  appendSourceUsage(id,entry){const source=state.sources.find(s=>s.id===id);if(!source)return;if(source.extractions?.some(e=>e.startedAt===entry.startedAt))return;source.extractions=[...(source.extractions??[]),copy(entry)];dirty=true;},
  writePositions(value){state.positions=copy(value);dirty=true;},
  rewriteLedgers(next){if(next.nodes)state.nodes=copy(next.nodes);if(next.chains)state.chains=copy(next.chains);if(next.coverage)state.coverage=copy(next.coverage);if(next.checkpoints)state.checkpoints=copy(next.checkpoints);dirty=true;},
 };
 return {store,snapshot:()=>copy(state),isDirty:()=>dirty,markClean:()=>{dirty=false;}};
}

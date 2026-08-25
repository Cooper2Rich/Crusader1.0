import type {AnalysisStore,EscalationEvent,Finding,StageRun} from './types.ts';

export class MemoryAnalysisStore implements AnalysisStore {
  readonly runs:StageRun[]=[];
  readonly findings:Array<{runId:string;finding:Finding}>=[];
  readonly escalations:EscalationEvent[]=[];

  async recordStage(run:StageRun){this.runs.push(run)}
  async recordFindings(runId:string,findings:Finding[]){
    this.findings.push(...findings.map(finding=>({runId,finding})));
  }
  async recordEscalation(event:EscalationEvent){this.escalations.push(event)}
}

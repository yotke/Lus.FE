/**
 * Frontend mirror of Lus.Application/Documents/Builder/Agents/DocumentBuilderAgentCatalog.cs.
 *
 * Names, icons and display keys are copied 1:1 from the C# catalog — that file stays the
 * single source of truth, this one exists so the canvas ticker and the progress toast can
 * render a named, ordered pipeline without a round-trip before the first AgentStatus event
 * arrives. (ArmyLuz does the same in org-canvas-agent-ticker's AGENT_META.)
 *
 * `order` is the pipeline position the user sees, derived from the C# Wave plus the
 * non-content agents' natural place in a turn: the planner asks, the content waves fill,
 * the validator checks, the advisor comments.
 */
export interface DocumentAgentMeta {
  /** Agent name exactly as runner.py's alias table spells it. */
  name: string;
  icon: string;
  order: number;
  nameKey: string;
  descKey: string;
  /** Mirrors the C# Enabled flag — disabled agents never appear in the pipeline. */
  enabled: boolean;
}

export const DOCUMENT_AGENTS: readonly DocumentAgentMeta[] = [
  { name: 'doc.template_reader',  icon: 'upload_file',        order: 0,
    nameKey: 'docBuilder.agents.templateReader.name',  descKey: 'docBuilder.agents.templateReader.desc',  enabled: true },
  { name: 'doc.carry_forward',    icon: 'redo',               order: 1,
    nameKey: 'docBuilder.agents.carryForward.name',    descKey: 'docBuilder.agents.carryForward.desc',    enabled: false },
  { name: 'doc.echo',             icon: 'record_voice_over',  order: 2,
    nameKey: 'docBuilder.agents.echo.name',            descKey: 'docBuilder.agents.echo.desc',            enabled: false },
  { name: 'doc.schema_planner',   icon: 'schema',             order: 3,
    nameKey: 'docBuilder.agents.schemaPlanner.name',   descKey: 'docBuilder.agents.schemaPlanner.desc',   enabled: true },
  { name: 'doc.row_extractor',    icon: 'table_rows',         order: 4,
    nameKey: 'docBuilder.agents.rowExtractor.name',    descKey: 'docBuilder.agents.rowExtractor.desc',    enabled: true },
  { name: 'doc.formatter',        icon: 'calculate',          order: 5,
    nameKey: 'docBuilder.agents.formatter.name',       descKey: 'docBuilder.agents.formatter.desc',       enabled: true },
  { name: 'doc.reviewer',         icon: 'rate_review',        order: 6,
    nameKey: 'docBuilder.agents.reviewer.name',        descKey: 'docBuilder.agents.reviewer.desc',        enabled: true },
  { name: 'doc.validator',        icon: 'verified',           order: 7,
    nameKey: 'docBuilder.agents.validator.name',       descKey: 'docBuilder.agents.validator.desc',       enabled: true },
  { name: 'doc.question_planner', icon: 'help',               order: 8,
    nameKey: 'docBuilder.agents.questionPlanner.name', descKey: 'docBuilder.agents.questionPlanner.desc', enabled: true },
  { name: 'doc.advisor',          icon: 'support_agent',      order: 9,
    nameKey: 'docBuilder.agents.advisor.name',         descKey: 'docBuilder.agents.advisor.desc',         enabled: true },
  { name: 'doc.router',           icon: 'alt_route',          order: 10,
    nameKey: 'docBuilder.agents.router.name',          descKey: 'docBuilder.agents.router.desc',          enabled: false },
];

const BY_NAME = new Map(DOCUMENT_AGENTS.map(a => [a.name, a]));

/** Unknown agent names still render — a new backend agent must not blank the ticker. */
export const UNKNOWN_AGENT_ICON = 'smart_toy';

export function findDocumentAgent(name: string): DocumentAgentMeta | undefined {
  return BY_NAME.get(name);
}

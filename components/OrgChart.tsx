'use client';

import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentStatusBadge } from './StatusBadge';
import { Play } from 'lucide-react';
import { toast } from 'sonner';

interface Agent {
  id: string;
  name: string;
  status: string;
  last_action: string;
  runs_today: number;
}

interface OrgChartProps {
  agents: Agent[];
  onSelectAgent: (agentId: string) => void;
  selectedAgent: string | null;
}

function HumanNode({ data }: NodeProps) {
  return (
    <div style={{
      background: '#1A2A38', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '8px', padding: '10px 16px', textAlign: 'center', minWidth: '120px',
    }}>
      <Handle type="source" position={Position.Bottom} style={{ background: '#667788' }} />
      <div style={{ fontSize: '11px', color: '#667788', marginBottom: '2px' }}>{String(data.role || '')}</div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>{String(data.label || '')}</div>
    </div>
  );
}

function CSONode({ data }: NodeProps) {
  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const tid = toast.loading('Starter CSO Agent...');
    try {
      const res = await fetch('/api/agents/cso/run', { method: 'POST' });
      const json = await res.json();
      toast.dismiss(tid);
      if (json.success) { toast.success('CSO Agent kørt'); } else { toast.error(json.message); }
    } catch {
      toast.dismiss(tid);
      toast.error('Fejl ved start af agent');
    }
  };

  const agent = data.agent as Agent | undefined;
  const onClick = data.onClick as ((id: string) => void) | undefined;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1A2A38 0%, #0F2235 100%)',
        border: '1px solid #185FA5', borderRadius: '10px',
        padding: '12px 16px', minWidth: '160px', cursor: 'pointer',
      }}
      onClick={() => onClick?.('cso')}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#185FA5' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#185FA5' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#ECF0F1' }}>CSO Agent</div>
        <button onClick={handleRun} style={{
          background: 'rgba(24,95,165,0.3)', border: '1px solid rgba(24,95,165,0.5)',
          borderRadius: '4px', padding: '2px 4px', cursor: 'pointer', color: '#ECF0F1',
        }}>
          <Play size={10} />
        </button>
      </div>
      {agent && <AgentStatusBadge status={agent.status} />}
      {agent?.last_action && (
        <div style={{ fontSize: '10px', color: '#667788', marginTop: '4px', lineHeight: 1.3 }}>
          {agent.last_action.substring(0, 45)}
        </div>
      )}
    </div>
  );
}

function DeptNode({ data }: NodeProps) {
  const isActive = data.active !== false;
  return (
    <div style={{
      background: isActive ? 'rgba(24,95,165,0.1)' : 'rgba(15,110,86,0.08)',
      border: `1px solid ${isActive ? 'rgba(24,95,165,0.4)' : 'rgba(15,110,86,0.3)'}`,
      borderRadius: '8px', padding: '8px 20px', textAlign: 'center',
      opacity: isActive ? 1 : 0.6,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: isActive ? '#185FA5' : '#0F6E56' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: isActive ? '#185FA5' : '#0F6E56' }} />
      <div style={{ fontSize: '12px', fontWeight: 600, color: isActive ? '#185FA5' : '#0F6E56' }}>
        {String(data.label || '')}
      </div>
      <div style={{ fontSize: '10px', color: '#667788', marginTop: '2px' }}>
        {String(data.sub || '')}
      </div>
    </div>
  );
}

function AgentNode({ data }: NodeProps) {
  const agent = data.agent as Agent | undefined;
  const isComingSoon = Boolean(data.comingSoon);
  const agentId = String(data.agentId || '');
  const onClick = data.onClick as ((id: string) => void) | undefined;

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isComingSoon) return;
    const tid = toast.loading(`Starter ${agent?.name || agentId}...`);
    try {
      const res = await fetch(`/api/agents/${agentId}/run`, { method: 'POST' });
      const json = await res.json();
      toast.dismiss(tid);
      if (json.success) { toast.success('Agent kørt'); } else { toast.error(json.message || 'Fejl'); }
    } catch {
      toast.dismiss(tid);
      toast.error('Fejl ved kørsel');
    }
  };

  return (
    <div
      style={{
        background: isComingSoon ? 'rgba(26,42,56,0.5)' : '#1A2A38',
        border: `1px solid ${isComingSoon ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '10px', padding: '10px 14px', minWidth: '148px',
        cursor: isComingSoon ? 'default' : 'pointer',
        opacity: isComingSoon ? 0.5 : 1,
      }}
      onClick={() => { if (!isComingSoon) onClick?.(agentId); }}
    >
      <Handle type="target" position={Position.Top} style={{ background: isComingSoon ? '#667788' : '#185FA5' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: isComingSoon ? '#667788' : '#ECF0F1' }}>
          {agent?.name || String(data.label || '')}
        </div>
        {!isComingSoon && (
          <button onClick={handleRun} style={{
            background: 'rgba(24,95,165,0.2)', border: '1px solid rgba(24,95,165,0.4)',
            borderRadius: '4px', padding: '2px 4px', cursor: 'pointer', color: '#ECF0F1',
          }}>
            <Play size={9} />
          </button>
        )}
      </div>
      {agent && !isComingSoon && <AgentStatusBadge status={agent.status} />}
      {isComingSoon && <span style={{ fontSize: '10px', color: '#667788' }}>Kommer snart</span>}
      {agent && !isComingSoon && agent.last_action && (
        <div style={{ fontSize: '10px', color: '#667788', marginTop: '4px', lineHeight: 1.3 }}>
          {agent.last_action.substring(0, 40)}
        </div>
      )}
      {agent && !isComingSoon && (
        <div style={{ fontSize: '10px', color: '#185FA5', marginTop: '3px' }}>
          {agent.runs_today} kørsler i dag
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  human: HumanNode,
  cso: CSONode,
  dept: DeptNode,
  agent: AgentNode,
};

function buildGraph(
  agents: Agent[],
  onSelect: (id: string) => void,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _selectedId: string | null
): { nodes: Node[]; edges: Edge[] } {
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

  const nodes: Node[] = [
    { id: 'ceo', type: 'human', position: { x: 100, y: 0 }, data: { label: 'CEO / Founder', role: 'Human' } },
    { id: 'coo', type: 'human', position: { x: 380, y: 0 }, data: { label: 'COO', role: 'Human' } },
    { id: 'cso-node', type: 'cso', position: { x: 200, y: 100 }, data: { agent: agentMap['cso'], onClick: onSelect } },
    { id: 'dept-se', type: 'dept', position: { x: 20, y: 220 }, data: { label: 'Sverige · International', sub: 'Fuldt automatisk', active: true } },
    { id: 'dept-dk', type: 'dept', position: { x: 430, y: 220 }, data: { label: 'Danmark · Godkendt', sub: 'Menneskegodkendt', active: false } },
    { id: 'node-se-prospecting', type: 'agent', position: { x: -140, y: 340 }, data: { agentId: 'se-prospecting', agent: agentMap['se-prospecting'], onClick: onSelect } },
    { id: 'node-se-outreach', type: 'agent', position: { x: 20, y: 340 }, data: { agentId: 'se-outreach', agent: agentMap['se-outreach'], onClick: onSelect } },
    { id: 'node-se-followup', type: 'agent', position: { x: 180, y: 340 }, data: { agentId: 'se-followup', agent: agentMap['se-followup'], onClick: onSelect } },
    { id: 'node-se-booking', type: 'agent', position: { x: 340, y: 340 }, data: { agentId: 'se-booking', agent: agentMap['se-booking'], onClick: onSelect } },
    { id: 'node-dk-prospect', type: 'agent', position: { x: 360, y: 340 }, data: { label: 'Prospecting DK', comingSoon: true, agentId: 'dk-prospecting' } },
    { id: 'node-dk-moede', type: 'agent', position: { x: 520, y: 340 }, data: { label: 'Møde-prep', comingSoon: true, agentId: 'dk-moede' } },
    { id: 'node-dk-pipeline', type: 'agent', position: { x: 680, y: 340 }, data: { label: 'Pipeline', comingSoon: true, agentId: 'dk-pipeline' } },
  ];

  const edges: Edge[] = [
    { id: 'ceo-cso', source: 'ceo', target: 'cso-node', style: { stroke: '#667788', strokeWidth: 1.5 } },
    { id: 'coo-cso', source: 'coo', target: 'cso-node', style: { stroke: '#667788', strokeWidth: 1.5 } },
    { id: 'cso-se', source: 'cso-node', target: 'dept-se', style: { stroke: '#185FA5', strokeWidth: 1.5 } },
    { id: 'cso-dk', source: 'cso-node', target: 'dept-dk', style: { stroke: '#0F6E56', strokeWidth: 1.5, strokeDasharray: '4 3' } },
    { id: 'se-prosp', source: 'dept-se', target: 'node-se-prospecting', style: { stroke: '#185FA5', strokeWidth: 1 } },
    { id: 'se-out', source: 'dept-se', target: 'node-se-outreach', style: { stroke: '#185FA5', strokeWidth: 1 } },
    { id: 'se-fol', source: 'dept-se', target: 'node-se-followup', style: { stroke: '#185FA5', strokeWidth: 1 } },
    { id: 'se-book', source: 'dept-se', target: 'node-se-booking', style: { stroke: '#185FA5', strokeWidth: 1 } },
    { id: 'dk-p', source: 'dept-dk', target: 'node-dk-prospect', style: { stroke: '#0F6E56', strokeWidth: 1 } },
    { id: 'dk-m', source: 'dept-dk', target: 'node-dk-moede', style: { stroke: '#0F6E56', strokeWidth: 1 } },
    { id: 'dk-pl', source: 'dept-dk', target: 'node-dk-pipeline', style: { stroke: '#0F6E56', strokeWidth: 1 } },
  ];

  return { nodes, edges };
}

export default function OrgChart({ agents, onSelectAgent, selectedAgent }: OrgChartProps) {
  const { nodes: initNodes, edges: initEdges } = buildGraph(agents, onSelectAgent, selectedAgent);
  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  return (
    <div style={{ width: '100%', height: '480px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.4}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1A2A38" gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

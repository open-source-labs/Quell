import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Controls, Background, applyEdgeChanges, applyNodeChanges, MiniMap, NodeChange, EdgeChange, Edge, Node, MarkerType, XYPosition } from 'reactflow';
import { parse, DocumentNode, FieldNode, SelectionNode, OperationDefinitionNode } from 'graphql';

// Type for NodeData
// data describes the content of the node
interface NodeData {
  id: string;
  data?: { label: string } ;
  position?: {
    x: number;
    y: number;
  };
  style?: any;
  type?: string;
}

// Type for FlowElement
interface FlowElement extends NodeData {
  id: string;
  position?: Position;
  target: string;
  source: string;
  animated?: boolean | undefined;
  label?: any;
  markerEnd?: {
    type: MarkerType;
    width?: number;
    height?: number;
    color?: string;
  } | string;
  style?: any;
  labelStyle?: any;
  labelBgBorderRadius?: any;
}

interface Position {
  x: number;
  y: number;
}

// Declares prop x on Position
interface PositionWithX extends Position {
  x: number;
}

// Convert AST field to React Flow node
const getNode = (
  node: FieldNode | SelectionNode | OperationDefinitionNode,
  depth: number,
  siblingIndex: number,
  numSiblings: number,
  numNodes: number,
  parentPosition?: Position,
): NodeData => {
  const label = node.kind === 'Field' ? node.name.value : node.kind;
  const id = `${node.loc?.start}-${node.loc?.end}`;
  const parentX = parentPosition ? (parentPosition as PositionWithX).x : 0;
  const x = ((siblingIndex + 0.3) / 3) * 400 + 230 ;
  return {
    id: id!,
    data: {label},
    position: {
      y: 100 + depth * 100,
      x: parentX + x - (numSiblings / 2) * 290,
    },
    style:  {
      width: 125, 
      height: 30, 
      fontSize: 18, 
      border: `none`, 
      borderRadius: 12, 
      boxShadow: `0px 0px 3px #11262C`,
      padding: `2px 0px 0px 0px`
    }
  };
};

// Gets edge connection between parent and child nodes
// edge is the line that visually connects the parent and child node

const getEdge = (parent: FieldNode, child: SelectionNode, elapsed: any): FlowElement => {
  const parentId = `${parent.loc?.start}-${parent.loc?.end}`;
  const childId = `${child.loc?.start}-${child.loc?.end}`;
  const edgeProps : FlowElement = {
    id: `${parentId}-${childId}`,
    source: parentId,
    target: childId,
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 10,
      height: 10,
      color: '#03C6FF'
    },
    style: {
      strokeWidth: 2,
      stroke: '#03C6FF'
    },
    labelStyle: {
      fontSize: 14,
    },
    labelBgBorderRadius: 10,
  };

  const childNode = child as FieldNode;
  if(elapsed[childNode.name.value]){
    edgeProps.label = `${elapsed[childNode.name.value]}ms`;
  }
  return edgeProps;
};

// Recursively constructs a tree structure from GraphQL AST
const buildTree = (
  node: FieldNode | SelectionNode,
  nodes: NodeData[],
  edges: FlowElement[],
  elapsed: {}, 
  depth = 0,
  siblingIndex = 0,
  numSiblings = 1,
  parentPosition?: Position
): void => {
  // Gets the parent node and pushes it into the nodes array
  const parent = getNode(node, depth, siblingIndex, numSiblings, numSiblings, parentPosition);
  nodes.push(parent);
  // The selectionSet means that it has child nodes
  if (node.kind === 'Field' && node.selectionSet) {
    const numChildren = node.selectionSet.selections.length;
    // Call getNode for each child node
    node.selectionSet.selections.forEach((childNode, i) => {
      const child = getNode(childNode, depth + 1, i, numChildren, numSiblings, parent.position);
      // Pushes the child node and edge into the respective arrays
      edges.push(getEdge(node as FieldNode, childNode, elapsed));
      buildTree(childNode, nodes, edges, elapsed, depth + 1, i, numChildren, parent.position);
    });
  }
};



// Takes the AST and returns nodes and edges as arrays for ReactFlow to render
const astToTree = (query: string, elapsed: {}): { nodes: NodeData[]; edges: FlowElement[] } => {
  const ast: DocumentNode = parse(query);
  const operation = ast.definitions.find(
    (def) => def.kind === 'OperationDefinition' && def.selectionSet
  );
  if (!operation) {
    throw new Error('No operation definition found in query');
  }
  const selections = (operation as OperationDefinitionNode).selectionSet.selections;
  const nodes: NodeData[] = [];
  const edges: FlowElement[] = [];
  let currentX = 0; // Adjust the initial x position for the first tree
  let currentY = 0; // Adjust the initial y position for the first tree

  selections.forEach((selection, index) => {
    const numSiblings = selections.length;
    const siblingIndex = index;
    const x = ((siblingIndex + 0.5) / numSiblings) * 900 + currentX;
    const y = 100 + currentY;

    buildTree(selection, nodes, edges, elapsed, 0, siblingIndex, numSiblings, { x, y });

  });

  return { nodes, edges };
};

// Render a tree graph from GraphQL AST
const FlowTree: React.FC<{query: string, elapsed: {}}> = ({query, elapsed}) => {
  const [currentQuery, setCurrentQuery] = useState(query);
  const [elapsedTime, setElapsedTime] = useState(elapsed);

// update the state of nodes and edges when query changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = astToTree(query, elapsedTime);
    const nodes = newNodes.map(node => ({
      id: node.id,
      data: node.data,
      position: node.position!,
      style: node.style
    }));
    setNodes(nodes);
    setEdges(newEdges);
    setCurrentQuery(query);
    setElapsedTime(elapsed);
} , [query, currentQuery, elapsed, elapsedTime]);

  const { nodes, edges } = astToTree(query, elapsedTime);
  // storing the initial values of the nodes and edges
  const [newNodes, setNodes] = useState<NodeData[]>(nodes);
  const [newEdges, setEdges] = useState<FlowElement[]>(edges);

  // setNodes/setEdges updates the state of the component causing it to re-render
  const onNodesChange = useCallback( (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),[] );
  const onEdgesChange = useCallback( (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),[] );

  // Remove React Flow watermark
  const proOptions = { hideAttribution: true };
  
  return (
    <ReactFlow  
    nodes={newNodes as Node<any, string | undefined>[]} 
    edges={newEdges as Edge<any>[]} 
    onNodesChange={onNodesChange}
    onEdgesChange={onEdgesChange}
    fitView
    proOptions={proOptions}
    >
          <Background />
          <Controls />  
          <MiniMap style={{height: 30, width: 30}}/>
    </ReactFlow>
  );
};


export default FlowTree;

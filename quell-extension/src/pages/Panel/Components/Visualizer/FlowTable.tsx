import React, { useState, useEffect, useRef } from 'react';
import { parse, DocumentNode, SelectionSetNode, OperationDefinitionNode } from 'graphql';
import { Controlled as CodeMirror } from 'react-codemirror2-react-17';
import styles from './Visualizer.modules.css';

// defining the expected type
interface Props {
  query: string;
  elapsed: { [key: string]: number };
}

// The FC stands for Function Component
const FlowTable: React.FC<Props> = ({ query, elapsed }) => {
  const [queryOperations, setQueryOperations] = useState<string[]>([]);
  const [elapsedTime, setElapsedTime] = useState<{ [key: string]: number }>(elapsed);
  const editorRef = useRef<any>(null);

  // Set elapsed time
  useEffect(() => {
    setElapsedTime(elapsed);
  }, [query, elapsed]);
  
  // The useEffect parse the query and generate the operation order
  useEffect(() => {
    const operation = parseQuery(query);
    if (operation) {
      setElapsedTime(elapsed);
      const operationOrder = generateOperationOrder(operation);
      setQueryOperations(operationOrder);
    }
  }, [elapsedTime]);


  // Parses the query, returning the selection set
  const parseQuery = (query: string): SelectionSetNode | OperationDefinitionNode | undefined => {
    const ast: DocumentNode = parse(query);

    if (ast.definitions.length === 1) {
        const definition = ast.definitions[0];
        if (definition.kind === 'OperationDefinition') {
          return definition.selectionSet;
        } else if (definition.kind === 'FragmentDefinition') {
          return definition.selectionSet;
        }
      }
    
    return undefined;
  };

  // Function that takes the query and returns an array of operations in order of the query
  const generateOperationOrder = (operation: SelectionSetNode | OperationDefinitionNode | any, parentName = ''): string[] => {
    const operationOrder: string[] = [];
    if (!operation) {
      return operationOrder;
    }
    // Iterate over the selection in the operation
    operation.selections.forEach((selection: { name: { value: any; }; selectionSet: OperationDefinitionNode | SelectionSetNode; }) => {
      if ('name' in selection) {
        let fieldName = parentName ? `${parentName}.${selection.name.value}` : selection.name.value;
        if (elapsedTime[selection.name.value] && operationOrder.length > 1) {
          const newName = fieldName + ` [resolved in ${elapsedTime[selection.name.value]}ms]`;
          operationOrder.push(newName);
        } else{
          operationOrder.push(fieldName)
        };
        // Recursively generate the operation order for nested selection
        if ('selectionSet' in selection) {
          const nestedSelections = generateOperationOrder(selection.selectionSet, fieldName);
          operationOrder.push(...nestedSelections);
        }
      }
    });

    return operationOrder;
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  return (
    <div>
      <CodeMirror
      className={styles.codemirror}
        value={queryOperations.join('\n')}
        options={{
          mode: 'xml',
          theme: 'material',
          readOnly: true,
          lineNumbers: true,
        }}
      />
    </div>
  );
};

export default FlowTable;